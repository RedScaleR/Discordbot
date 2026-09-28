const config = require('../config');
const { chat, AiError } = require('../ai/providers');
const { systemPrompt } = require('../ai/personalities');
const { record } = require('../activity');

const cooldowns = new Map();
// One reply at a time per channel, so answers come out in order.
const channelQueues = new Map();
const MAX_QUEUED = 3;

function isForMochi(message) {
  const me = message.client.user.id;
  if (config.ai.channelIds.includes(message.channelId)) return true;
  if (message.mentions.repliedUser?.id === me) return true;
  return message.mentions.users.has(me);
}

/** Turns recent channel messages into a conversation the AI can follow. */
async function buildConversation(message) {
  const me = message.client.user.id;
  const limit = config.ai.contextMessages;
  const history = limit > 0 ? await message.channel.messages.fetch({ limit, before: message.id }).catch(() => null) : null;
  const recent = [...(history?.values() ?? [])].reverse();

  const turns = [];
  for (const msg of [...recent, message]) {
    if (msg.author.bot && msg.author.id !== me) continue;
    const text = msg.cleanContent.replace(new RegExp(`^@${message.client.user.username}\\b[,:]?\\s*`, 'i'), '').trim();
    if (!text) continue;
    const role = msg.author.id === me ? 'assistant' : 'user';
    const content = role === 'user' ? `${msg.member?.displayName ?? msg.author.username}: ${text}` : text;
    // Merge back-to-back messages from the same side; some AI services require alternating turns.
    const last = turns[turns.length - 1];
    if (last?.role === role) last.content += `\n${content}`;
    else turns.push({ role, content });
  }
  // A conversation has to start with a person talking.
  while (turns[0]?.role === 'assistant') turns.shift();
  return [{ role: 'system', content: systemPrompt(config.ai, message.guild.name) }, ...turns];
}

async function answer(message) {
  // Discord's "Mochi is typing..." only lasts about 10 seconds, so keep refreshing it.
  const typing = setInterval(() => message.channel.sendTyping().catch(() => {}), 8000);
  message.channel.sendTyping().catch(() => {});
  try {
    const { text: reply } = await chat(config.ai, await buildConversation(message));
    const text = reply.length > 1900 ? `${reply.slice(0, 1900)}…` : reply || '(´・ω・`) ...I lost my words';
    await message.reply({ content: text, allowedMentions: { parse: [], repliedUser: false } });
    record(message.guildId, 'ai', `${message.author.username} chatted with Mochi in #${message.channel.name}`);
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    console.warn(`[ai] ${err.message}`);
    await message.reply({ content: `${err.userMessage} >_<`, allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
  } finally {
    clearInterval(typing);
  }
}

/** Lets Mochi answer with AI when someone @mentions it, replies to it, or talks in an AI channel. */
async function replyWithAi(message) {
  if (!config.ai.enabled || !isForMochi(message)) return;

  const now = Date.now();
  const key = `${message.guildId}:${message.author.id}`;
  if (now < (cooldowns.get(key) ?? 0)) return;
  cooldowns.set(key, now + config.ai.cooldownSeconds * 1000);

  const queue = channelQueues.get(message.channelId) ?? { tail: Promise.resolve(), size: 0 };
  if (queue.size >= MAX_QUEUED) return;
  queue.size++;
  queue.tail = queue.tail
    .then(() => answer(message))
    .catch((err) => console.error('[ai]', err))
    .finally(() => {
      queue.size--;
      if (!queue.size) channelQueues.delete(message.channelId);
    });
  channelQueues.set(message.channelId, queue);
  await queue.tail;
}

module.exports = { replyWithAi, buildConversation };
