const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { ChannelType } = require('discord.js');
const config = require('../config');
const db = require('../database');
const { levelFromXp } = require('../util/levels');
const { sendLog } = require('../util/logger');
const { feed, record, recentActivity } = require('../activity');
const { SECTIONS, sanitize } = require('./settingsSchema');
const { chat, listModels, AiError } = require('../ai/providers');
const { systemPrompt } = require('../ai/personalities');
const { selfRoleProblem } = require('../util/moderation');
const { version } = require('../../package.json');

const PUBLIC_DIR = path.join(__dirname, 'public');
const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
};
const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
const MAX_BODY = 100 * 1024;

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: https://cdn.discordapp.com https://media.discordapp.net; " +
    "style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'That request is too big');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, "That request isn't valid JSON");
  }
}

function userInfo(client, guild, userId) {
  const member = guild.members.cache.get(userId);
  const user = member?.user ?? client.users.cache.get(userId);
  return {
    id: userId,
    name: member?.displayName ?? user?.globalName ?? user?.username ?? 'Unknown user',
    username: user?.username ?? userId,
    avatar: (member ?? user)?.displayAvatarURL({ size: 64, extension: 'png' }) ?? DEFAULT_AVATAR,
    bot: user?.bot ?? false,
  };
}

function memberSummary(client, guild, userId, row, warningCount) {
  const xp = row?.xp ?? 0;
  return { ...userInfo(client, guild, userId), xp, level: levelFromXp(xp).level, coins: row?.coins ?? 0, warnings: warningCount ?? 0 };
}

function pickGuild(client, url) {
  const guild = client.guilds.cache.get(url.searchParams.get('guild')) ?? client.guilds.cache.first();
  if (!guild) throw new HttpError(409, "Mochi isn't in any servers yet");
  return guild;
}

function overview(client, guild) {
  const days = db.recentStats(guild.id, 14);
  const [yesterday, today] = days.slice(-2);
  const lastWeek = days.slice(-7);
  const totals = db.totals(guild.id);

  return {
    currency: config.economy.currency,
    guild: { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 64, extension: 'png' }), memberCount: guild.memberCount },
    kpis: {
      members: guild.memberCount,
      messagesToday: today.messages,
      messagesYesterday: yesterday.messages,
      commandsToday: today.commands,
      commandsYesterday: yesterday.commands,
      joinsWeek: lastWeek.reduce((sum, day) => sum + day.joins, 0),
      leavesWeek: lastWeek.reduce((sum, day) => sum + day.leaves, 0),
      coins: totals.coins,
      warnings: db.totalWarnings(guild.id),
      automodToday: today.automod,
    },
    days,
    topCommands: db.topCommands(guild.id, 8),
    topXp: db.topXp(guild.id, 10).map((row) => memberSummary(client, guild, row.user_id, row)),
    topCoins: db.topCoins(guild.id, 10).map((row) => memberSummary(client, guild, row.user_id, row)),
    recentWarnings: db.recentWarnings(guild.id, 8).map((warning) => ({
      id: warning.id,
      user: userInfo(client, guild, warning.user_id),
      moderator: userInfo(client, guild, warning.moderator_id),
      reason: warning.reason,
      time: warning.created_at,
    })),
    feed: recentActivity(guild.id).slice(-40),
  };
}

function settingsPayload(guild) {
  const channels = guild.channels.cache
    .filter((channel) => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
    .sort((a, b) => (a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1) || a.rawPosition - b.rawPosition)
    .map((channel) => ({ id: channel.id, name: channel.name, category: channel.parent?.name ?? '' }));
  const roles = guild.roles.cache
    .filter((role) => role.id !== guild.id && !role.managed)
    .sort((a, b) => b.position - a.position)
    .map((role) => ({ id: role.id, name: role.name, color: role.hexColor }));
  return { sections: SECTIONS, values: JSON.parse(JSON.stringify(config)), channels, roles };
}

function listMembers(client, guild, query) {
  const rows = db.allMembers(guild.id);
  const warnings = db.warningCounts(guild.id);
  const needle = query.trim().toLowerCase();
  const matches = guild.members.cache.filter(
    (member) =>
      !member.user.bot &&
      (!needle || member.displayName.toLowerCase().includes(needle) || member.user.username.toLowerCase().includes(needle)),
  );
  return [...matches.values()]
    .map((member) => memberSummary(client, guild, member.id, rows.get(member.id), warnings.get(member.id)))
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
    .slice(0, 30);
}

function memberDetail(client, guild, userId) {
  const row = db.allMembers(guild.id).get(userId);
  const member = guild.members.cache.get(userId);
  if (!row && !member) throw new HttpError(404, "Can't find that member");
  const warnings = db.listWarnings(guild.id, userId);
  return {
    ...memberSummary(client, guild, userId, row, warnings.length),
    progress: levelFromXp(row?.xp ?? 0),
    streak: row?.daily_streak ?? 0,
    inventory: db.inventory(guild.id, userId).map((item) => ({ emoji: item.emoji, name: item.name, kind: item.kind, quantity: item.quantity })),
    joinedAt: member?.joinedTimestamp ?? null,
    inServer: Boolean(member),
    warningList: warnings.map((warning) => ({
      id: warning.id,
      moderator: userInfo(client, guild, warning.moderator_id),
      reason: warning.reason,
      time: warning.created_at,
    })),
  };
}

const ITEM_KINDS = ['item', 'badge', 'role'];

function shopPayload(guild) {
  const items = db.shopItems(guild.id).map((item) => ({
    id: item.id,
    name: item.name,
    emoji: item.emoji,
    description: item.description,
    price: item.price,
    kind: item.kind,
    roleId: item.role_id,
    stock: item.stock,
    sold: item.sold,
  }));
  // Every role, with the reason it can't be sold (if any), so the page can grey those out.
  const roles = guild.roles.cache
    .filter((role) => role.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((role) => ({ id: role.id, name: role.name, color: role.hexColor, problem: selfRoleProblem(role)?.replace(/<@&\d+>/g, role.name) ?? null }));
  return { items, roles, currency: config.economy.currency };
}

/** Checks a shop item from the page. Throws a 400 with a friendly message if something's off. */
function cleanItem(guild, input = {}) {
  const fail = (message) => {
    throw new HttpError(400, message);
  };
  const name = String(input.name ?? '').trim();
  if (!name || name.length > 50) fail('The name needs to be 1 to 50 characters');
  const emoji = String(input.emoji ?? '').trim() || '🎁';
  if (emoji.length > 40) fail('The emoji is too long');
  const description = String(input.description ?? '').trim();
  if (description.length > 200) fail('The description can be 200 characters at most');
  if (!Number.isSafeInteger(input.price) || input.price < 0 || input.price > 1_000_000_000) fail('The price must be a whole number of 0 or more');
  if (!ITEM_KINDS.includes(input.kind)) fail('Pick what kind of thing it is');
  const stock = input.stock === null || input.stock === '' || input.stock === undefined ? null : input.stock;
  if (stock !== null && (!Number.isSafeInteger(stock) || stock < 0 || stock > 1_000_000)) fail('Stock must be empty (unlimited) or a whole number');

  let roleId = null;
  if (input.kind === 'role') {
    const role = guild.roles.cache.get(String(input.roleId ?? ''));
    const problem = selfRoleProblem(role);
    if (problem) fail(role ? `${role.name}: ${problem.replace(/<@&\d+>/g, 'this role')}` : 'Pick a role to sell');
    roleId = role.id;
  }
  return { name, emoji, description, price: input.price, kind: input.kind, roleId, stock };
}

function wholeNumber(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new HttpError(400, `${label} must be a whole number of 0 or more`);
  return value;
}

/** Checks AI settings sent from the page (which may not be saved yet) with the same rules as saving. */
function draftAi(body) {
  return sanitize({ ...JSON.parse(JSON.stringify(config)), ai: body.ai }, config).ai;
}

async function aiRequest(work) {
  try {
    return await work();
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    throw Object.assign(new HttpError(400, err.userMessage), { detail: err.message });
  }
}

/** Posts dashboard edits in the log channel and the live feed, so changes are never secret. */
function announce(guild, text) {
  record(guild.id, 'dashboard', text);
  // The change already happened, so a hiccup posting the log shouldn't show up as a failed save.
  return sendLog(guild, { title: '🎛️ Changed from the dashboard', description: text }).catch((err) =>
    console.warn(`[dashboard] Couldn't post to the log channel: ${err.message}`),
  );
}

async function updateMember(client, guild, userId, body) {
  const before = memberDetail(client, guild, userId);
  // Check everything first so a bad value never leaves a half-saved change behind.
  const xp = body.xp === undefined ? before.xp : wholeNumber(body.xp, 'XP');
  const coins = body.coins === undefined ? before.coins : wholeNumber(body.coins, 'Coins');

  const changes = [];
  if (xp !== before.xp) {
    db.setXp(guild.id, userId, xp);
    changes.push(`XP ${before.xp.toLocaleString()} → ${xp.toLocaleString()}`);
  }
  if (coins !== before.coins) {
    db.setCoins(guild.id, userId, coins);
    changes.push(`coins ${before.coins.toLocaleString()} → ${coins.toLocaleString()}`);
  }
  if (changes.length) await announce(guild, `${before.username}: ${changes.join(', ')}`);
  return memberDetail(client, guild, userId);
}

function streamEvents(req, res, guild) {
  res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  res.write('retry: 3000\n\n');
  const listener = (event) => {
    if (event.guildId === guild.id) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  feed.on('event', listener);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    feed.off('event', listener);
    clearInterval(keepAlive);
  });
}

async function handleApi(client, req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // drop "api"
  const route = `${req.method} /${parts.map((part) => (/^\d+$/.test(part) ? ':id' : part)).join('/')}`;

  if (route === 'GET /status') {
    return sendJson(res, 200, {
      ready: client.isReady(),
      version,
      bot: client.isReady()
        ? { name: client.user.username, avatar: client.user.displayAvatarURL({ size: 64, extension: 'png' }), ping: client.ws.ping, uptime: client.uptime }
        : null,
      guilds: client.guilds.cache.map((guild) => ({ id: guild.id, name: guild.name })),
    });
  }
  if (!client.isReady()) throw new HttpError(503, 'Mochi is still waking up');

  const guild = pickGuild(client, url);
  const id = parts.find((part) => /^\d+$/.test(part));

  switch (route) {
    case 'GET /overview':
      return sendJson(res, 200, overview(client, guild));
    case 'GET /events':
      return streamEvents(req, res, guild);
    case 'GET /settings':
      return sendJson(res, 200, settingsPayload(guild));
    case 'PUT /settings': {
      const body = await readJson(req);
      config.save(sanitize(body.values ?? {}, config));
      await announce(guild, 'Settings were updated');
      return sendJson(res, 200, settingsPayload(guild));
    }
    case 'POST /ai/models': {
      const ai = draftAi(await readJson(req));
      return sendJson(res, 200, { models: await aiRequest(() => listModels(ai)) });
    }
    case 'POST /ai/test': {
      const body = await readJson(req);
      const ai = draftAi(body);
      const message = String(body.message ?? '').trim().slice(0, 500) || 'Hi Mochi! Introduce yourself in one sentence.';
      const { text, model } = await aiRequest(() =>
        chat(ai, [
          { role: 'system', content: systemPrompt(ai, guild.name) },
          { role: 'user', content: `Friend: ${message}` },
        ]),
      );
      return sendJson(res, 200, { reply: text, model });
    }
    case 'GET /shop':
      return sendJson(res, 200, shopPayload(guild));
    case 'POST /shop': {
      const item = cleanItem(guild, (await readJson(req)).item);
      db.addShopItem(guild.id, item);
      await announce(guild, `Added ${item.emoji} ${item.name} to the shop for ${item.price.toLocaleString()} coins`);
      return sendJson(res, 200, shopPayload(guild));
    }
    case 'PUT /shop/:id': {
      const item = cleanItem(guild, (await readJson(req)).item);
      if (!db.updateShopItem(guild.id, Number(id), item)) throw new HttpError(404, 'That item is gone');
      await announce(guild, `Changed the shop item ${item.emoji} ${item.name}`);
      return sendJson(res, 200, shopPayload(guild));
    }
    case 'DELETE /shop/:id': {
      const item = db.shopItem(guild.id, Number(id));
      if (!item || !db.removeShopItem(guild.id, Number(id))) throw new HttpError(404, 'That item is already gone');
      await announce(guild, `Removed ${item.emoji} ${item.name} from the shop`);
      return sendJson(res, 200, shopPayload(guild));
    }
    case 'GET /members':
      return sendJson(res, 200, listMembers(client, guild, url.searchParams.get('q') ?? ''));
    case 'GET /members/:id':
      return sendJson(res, 200, memberDetail(client, guild, id));
    case 'PATCH /members/:id':
      return sendJson(res, 200, await updateMember(client, guild, id, await readJson(req)));
    case 'DELETE /members/:id/warnings': {
      const { username } = memberDetail(client, guild, id);
      const removed = db.clearWarnings(guild.id, id);
      if (removed) await announce(guild, `Cleared ${removed} warning${removed === 1 ? '' : 's'} for ${username}`);
      return sendJson(res, 200, memberDetail(client, guild, id));
    }
    case 'DELETE /warnings/:id':
      if (!db.deleteWarning(guild.id, Number(id))) throw new HttpError(404, 'That warning is already gone');
      await announce(guild, `Removed warning #${id}`);
      return sendJson(res, 200, { ok: true });
    default:
      throw new HttpError(404, 'Not found');
  }
}

/** Starts the dashboard website. It only listens on this PC (127.0.0.1), never on the network. */
function startDashboard(client, port) {
  const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
  const allowedOrigins = new Set([...allowedHosts].map((host) => `http://${host}`));

  const server = http.createServer(async (req, res) => {
    try {
      // Only answer requests addressed to this PC by name, which blocks "DNS rebinding" tricks.
      if (!allowedHosts.has(req.headers.host)) throw new HttpError(403, 'Forbidden');
      // Changes must come from the dashboard page itself, never from some other website you visit.
      if (req.method !== 'GET' && (!allowedOrigins.has(req.headers.origin) || !req.headers['content-type']?.startsWith('application/json'))) {
        throw new HttpError(403, 'Forbidden');
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/api/')) return await handleApi(client, req, res, url);

      const file = STATIC_FILES[url.pathname];
      if (req.method !== 'GET' || !file) throw new HttpError(404, 'Not found');
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': file[1], 'Cache-Control': 'no-cache' });
      fs.createReadStream(path.join(PUBLIC_DIR, file[0])).pipe(res);
    } catch (err) {
      if (!err.status) console.error('[dashboard]', err);
      if (res.headersSent) return res.end();
      sendJson(res, err.status ?? 500, { error: err.status ? err.message : 'Something went wrong', field: err.field, detail: err.detail });
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[dashboard] Port ${port} is already in use. Set DASHBOARD_PORT=3001 (or another number) in .env to use a different one.`);
    } else {
      console.error('[dashboard]', err);
    }
  });
  server.listen(port, '127.0.0.1');
  return server;
}

module.exports = { startDashboard };
