'use strict';

// Everything from Discord (names, reasons, messages) goes in with textContent, never innerHTML.

const $ = (selector) => document.querySelector(selector);
const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
const MEDALS = ['🥇', '🥈', '🥉'];
const FEED_ICONS = { command: '✨', automod: '🛡️', join: '📥', leave: '📤', level: '🎉', mod: '🔨', dashboard: '🎛️', ai: '🤖' };
const TABS = ['overview', 'members', 'settings'];

const state = {
  guildId: null,
  tab: 'overview',
  overview: null,
  feedLoaded: false,
  events: null,
  settings: null,
  draft: null,
  rewardRows: [],
  selectedMember: null,
  refreshTimer: null,
};

// ---------- Small helpers ----------

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

const number = new Intl.NumberFormat();
const compactNumber = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const formatNumber = (value) => (Math.abs(value) >= 10000 ? compactNumber.format(value) : number.format(value));
const plural = (count, word) => `${number.format(count)} ${word}${count === 1 ? '' : 's'}`;

function timeAgo(timestamp) {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatUptime(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

const parseDay = (day) => new Date(`${day}T12:00:00`);
const shortDay = (day) => parseDay(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const longDay = (day) => parseDay(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const shortDate = (timestamp) => new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function avatar(url, className = 'avatar') {
  const img = el('img', { className, src: url || DEFAULT_AVATAR, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => {
    if (img.src !== DEFAULT_AVATAR) img.src = DEFAULT_AVATAR;
  }, { once: true });
  return img;
}

function who(user) {
  return el('span', { className: 'who' }, avatar(user.avatar), el('span', { text: user.name, title: `@${user.username}` }));
}

async function api(path, { method = 'GET', body } = {}) {
  const url = new URL(path, location.origin);
  if (state.guildId) url.searchParams.set('guild', state.guildId);
  const response = await fetch(url, {
    method,
    headers: body !== undefined || method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.error || `Request failed (${response.status})`), { status: response.status, field: data.field, detail: data.detail });
  }
  return data;
}

let toastTimer;
function toast(message, isError = false) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.toggle('error', isError);
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.hidden = true), isError ? 6000 : 3000);
}

// ---------- Tooltip ----------

function showTooltip(lines, anchor) {
  const tip = $('#tooltip');
  tip.replaceChildren(el('strong', { text: lines[0] }), ...lines.slice(1).map((line) => el('span', { text: line })));
  tip.hidden = false;
  const rect = anchor instanceof Element ? anchor.getBoundingClientRect() : null;
  const x = rect ? rect.left + rect.width / 2 : anchor.clientX;
  const y = rect ? rect.top : anchor.clientY;
  const { width, height } = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(window.innerWidth - width - 8, Math.max(8, x - width / 2))}px`;
  tip.style.top = `${y - height - 12 < 8 ? y + 16 : y - height - 12}px`;
}

const hideTooltip = () => ($('#tooltip').hidden = true);

// ---------- Theme ----------

function storedTheme() {
  try {
    return localStorage.getItem('mochi-theme');
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  $('#theme-toggle').textContent = dark ? '☀️' : '🌙';
}

function toggleTheme() {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  try {
    localStorage.setItem('mochi-theme', next);
  } catch {
    // Private windows can block storage; the toggle still works for this visit.
  }
  applyTheme(next);
}

// ---------- Tabs ----------

function selectTab(name, { focus = false } = {}) {
  if (!TABS.includes(name)) name = 'overview';
  state.tab = name;
  for (const tab of TABS) {
    const button = $(`#tab-btn-${tab}`);
    const selected = tab === name;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    $(`#tab-${tab}`).hidden = !selected;
    if (selected && focus) button.focus();
  }
  if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
  if (name === 'overview') loadOverview();
  if (name === 'members' && !$('#member-results').children.length) searchMembers();
  if (name === 'settings' && !state.settings) loadSettings();
}

function setupTabs() {
  for (const tab of TABS) $(`#tab-btn-${tab}`).addEventListener('click', () => selectTab(tab));
  $('.tabs').addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    const index = (TABS.indexOf(state.tab) + step + TABS.length) % TABS.length;
    selectTab(TABS[index], { focus: true });
  });
}

// ---------- Startup & status ----------

async function boot() {
  let status;
  try {
    status = await api('/api/status');
  } catch {
    return waiting("Can't reach Mochi. Is it still running? This page will keep trying.");
  }
  if (!status.ready) return waiting('Mochi is waking up… this page will refresh itself.');
  if (!status.guilds.length) return waiting("Mochi isn't in any servers yet. Use the invite link in Mochi's window to add it :3");

  renderStatus(status);
  const picker = $('#guild-picker');
  if (!state.guildId || !status.guilds.some((guild) => guild.id === state.guildId)) state.guildId = status.guilds[0].id;
  picker.replaceChildren(...status.guilds.map((guild) => el('option', { value: guild.id, text: guild.name })));
  picker.value = state.guildId;
  picker.closest('label').hidden = status.guilds.length < 2;

  $('#waking').hidden = true;
  $('#main').hidden = false;
  connectEvents();
  selectTab(location.hash.slice(1) || 'overview');
  setInterval(refreshStatus, 30_000);
}

function waiting(message) {
  $('#waking-text').textContent = message;
  $('#waking').hidden = false;
  $('#main').hidden = true;
  $('#bot-status').classList.remove('online');
  $('#bot-status-text').textContent = 'Offline';
  setTimeout(boot, 3000);
}

function renderStatus(status) {
  $('#bot-avatar').src = status.bot.avatar;
  $('#bot-status').classList.add('online');
  $('#bot-status-text').textContent = `Online · up ${formatUptime(status.bot.uptime)} · v${status.version}`;
}

async function refreshStatus() {
  try {
    const status = await api('/api/status');
    if (status.ready) renderStatus(status);
    if (state.tab === 'overview' && !document.hidden) loadOverview();
  } catch {
    $('#bot-status').classList.remove('online');
    $('#bot-status-text').textContent = "Can't reach Mochi";
  }
}

// ---------- Overview ----------

async function loadOverview() {
  try {
    state.overview = await api('/api/overview');
  } catch (err) {
    return toast(err.message, true);
  }
  const data = state.overview;
  renderKpis(data.kpis, data.currency);
  renderMessagesChart();
  renderMessagesTable(data.days);
  renderCommandsChart(data.topCommands);
  renderRanking($('#top-xp'), data.topXp, (user) => `Lv ${user.level} · ${formatNumber(user.xp)} XP`);
  renderRanking($('#top-coins'), data.topCoins, (user) => `${formatNumber(user.coins)} ${data.currency}`);
  renderRecentWarnings(data.recentWarnings);
  if (!state.feedLoaded) {
    state.feedLoaded = true;
    $('#feed').replaceChildren();
    data.feed.forEach((event) => addFeedEvent(event, false));
    if (!data.feed.length) $('#feed').append(el('li', { className: 'empty-feed' }, el('span', { className: 'icon', text: '🌙' }), el('span', { text: 'Quiet so far. Things will show up here as they happen.' })));
  }
}

function deltaNote(today, yesterday) {
  const diff = today - yesterday;
  if (diff === 0) return { text: 'Same as yesterday' };
  return { text: `${diff > 0 ? '▲' : '▼'} ${number.format(Math.abs(diff))} vs yesterday`, className: diff > 0 ? 'up' : 'down' };
}

function renderKpis(k, currency) {
  const tiles = [
    { label: 'Members', value: formatNumber(k.members), note: { text: `+${k.joinsWeek} joined, ${k.leavesWeek} left this week` } },
    { label: 'Messages today', value: formatNumber(k.messagesToday), note: deltaNote(k.messagesToday, k.messagesYesterday) },
    { label: 'Commands today', value: formatNumber(k.commandsToday), note: deltaNote(k.commandsToday, k.commandsYesterday) },
    { label: 'Auto-mod today', value: formatNumber(k.automodToday), note: { text: 'messages removed' } },
    { label: 'Coins in circulation', value: formatNumber(k.coins), note: { text: `${currency} across everyone` } },
    { label: 'Warnings', value: formatNumber(k.warnings), note: { text: 'all time' } },
  ];
  $('#kpis').replaceChildren(
    ...tiles.map((tile) =>
      el(
        'div',
        { className: 'card tile' },
        el('p', { className: 'tile-label', text: tile.label }),
        el('p', { className: 'tile-value', text: tile.value }),
        el('p', { className: `tile-note ${tile.note.className ?? ''}`, text: tile.note.text }),
      ),
    ),
  );
}

/** Rounds a max value up to a clean axis top (1, 2, 5 × 10^n per step). */
function niceScale(max, steps = 4) {
  if (max <= 0) return { top: steps, step: 1 };
  const rough = max / steps;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough);
  return { top: step * Math.ceil(max / step), step };
}

function roundedColumn(x, y, width, height, radius) {
  const r = Math.min(radius, height, width / 2);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

function renderMessagesChart() {
  const days = state.overview?.days;
  const container = $('#messages-chart');
  if (!days || $('#messages-chart').hidden) return;

  const width = Math.max(280, container.clientWidth);
  const height = 280;
  const margin = { top: 22, right: 4, bottom: 26, left: 40 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = days.map((day) => day.messages);
  const max = Math.max(...values);
  const { top, step } = niceScale(max);
  const y = (value) => margin.top + plotHeight - (value / top) * plotHeight;
  const slot = plotWidth / days.length;
  const barWidth = Math.min(24, slot * 0.62);

  const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, height, role: 'group', 'aria-label': 'Messages per day for the last 14 days' });

  for (let value = step; value <= top; value += step) {
    chart.append(svg('line', { class: 'gridline', x1: margin.left, x2: width - margin.right, y1: y(value), y2: y(value) }));
  }
  for (let value = 0; value <= top; value += step) {
    const tick = svg('text', { class: 'tick', x: margin.left - 8, y: y(value) + 4, 'text-anchor': 'end' });
    tick.textContent = formatNumber(value);
    chart.append(tick);
  }

  const labelEvery = Math.max(1, Math.ceil(52 / slot));
  const peak = values.indexOf(max);
  const bars = [];

  days.forEach((day, i) => {
    const x = margin.left + i * slot + (slot - barWidth) / 2;
    const barHeight = (day.messages / top) * plotHeight;
    const bar = barHeight > 0 ? svg('path', { class: 'bar', d: roundedColumn(x, y(day.messages), barWidth, barHeight, 4) }) : null;
    if (bar) chart.append(bar);
    bars.push(bar);

    const last = i === days.length - 1;
    // Label only today and the busiest day, not every bar.
    if (day.messages > 0 && (last || (i === peak && peak < days.length - 2))) {
      const label = svg('text', { class: 'value-label', x: x + barWidth / 2, y: y(day.messages) - 6, 'text-anchor': 'middle' });
      label.textContent = formatNumber(day.messages);
      chart.append(label);
    }
    if ((days.length - 1 - i) % labelEvery === 0) {
      const tick = svg('text', { class: 'tick', x: x + barWidth / 2, y: height - 6, 'text-anchor': 'middle' });
      tick.textContent = last ? 'Today' : shortDay(day.day);
      chart.append(tick);
    }
  });

  chart.append(svg('line', { class: 'baseline', x1: margin.left, x2: width - margin.right, y1: y(0), y2: y(0) }));

  // Invisible full-height targets so each day is easy to hover or tab to.
  days.forEach((day, i) => {
    const lines = [plural(day.messages, 'message'), longDay(day.day), `${plural(day.commands, 'command')} · ${number.format(day.joins)} joined`];
    const hit = svg('rect', {
      class: 'hit',
      x: margin.left + i * slot,
      y: margin.top,
      width: slot,
      height: plotHeight,
      tabindex: 0,
      role: 'img',
      'aria-label': `${longDay(day.day)}: ${lines[0]}, ${lines[2]}`,
    });
    const enter = (event) => {
      container.classList.add('hovering');
      bars[i]?.classList.add('active');
      showTooltip(lines, event.type === 'focus' ? hit : event);
    };
    const leave = () => {
      container.classList.remove('hovering');
      bars[i]?.classList.remove('active');
      hideTooltip();
    };
    hit.addEventListener('pointermove', enter);
    hit.addEventListener('focus', enter);
    hit.addEventListener('pointerleave', leave);
    hit.addEventListener('blur', leave);
    chart.append(hit);
  });

  const children = [chart];
  if (max === 0) {
    children.push(el('div', { className: 'chart-empty', text: 'No messages counted yet. Mochi starts counting from now, so check back soon :3' }));
  }
  container.replaceChildren(...children);
}

function renderMessagesTable(days) {
  const rows = [...days].reverse().map((day) =>
    el(
      'tr',
      {},
      el('td', { text: longDay(day.day) }),
      el('td', { className: 'num', text: number.format(day.messages) }),
      el('td', { className: 'num', text: number.format(day.commands) }),
      el('td', { className: 'num', text: number.format(day.joins) }),
      el('td', { className: 'num', text: number.format(day.leaves) }),
    ),
  );
  $('#messages-table').replaceChildren(
    el(
      'table',
      {},
      el('thead', {}, el('tr', {}, ...['Day', 'Messages', 'Commands', 'Joined', 'Left'].map((h, i) => el('th', { className: i ? 'num' : '', text: h })))),
      el('tbody', {}, rows),
    ),
  );
}

function renderCommandsChart(commands) {
  const container = $('#commands-chart');
  if (!commands.length) {
    container.replaceChildren(el('p', { className: 'empty', text: 'No commands used yet. Try /help in your server!' }));
    return;
  }
  const max = commands[0].uses;
  container.replaceChildren(
    ...commands.flatMap((command) => {
      const fill = el('div', { className: 'hbar-fill' });
      fill.style.width = `calc((100% - 48px) * ${command.uses / max})`;
      const row = el(
        'div',
        { className: 'hbar-row', tabindex: 0, role: 'img', 'aria-label': `/${command.command}: ${plural(command.uses, 'use')}` },
        fill,
        el('span', { className: 'hbar-value', text: formatNumber(command.uses) }),
      );
      const lines = [plural(command.uses, 'use'), `/${command.command}`];
      const enter = (event) => {
        container.classList.add('hovering');
        fill.classList.add('active');
        showTooltip(lines, event.type === 'focus' ? fill : event);
      };
      const leave = () => {
        container.classList.remove('hovering');
        fill.classList.remove('active');
        hideTooltip();
      };
      row.addEventListener('pointermove', enter);
      row.addEventListener('focus', enter);
      row.addEventListener('pointerleave', leave);
      row.addEventListener('blur', leave);
      return [el('span', { className: 'hbar-label', text: `/${command.command}` }), row];
    }),
  );
}

function renderRanking(list, users, score) {
  if (!users.length) {
    list.replaceChildren(el('li', { className: 'empty' }, el('span', { text: 'Nobody yet! Start chatting :3' })));
    return;
  }
  list.replaceChildren(
    ...users.map((user, i) =>
      el(
        'li',
        {},
        el('span', { className: 'rank', text: MEDALS[i] ?? String(i + 1) }),
        who(user),
        el('span', { className: 'score', text: score(user) }),
      ),
    ),
  );
}

function renderRecentWarnings(warnings) {
  const container = $('#recent-warnings');
  if (!warnings.length) {
    container.replaceChildren(el('p', { className: 'empty', text: 'No warnings. What a lovely server (✿◠‿◠)' }));
    return;
  }
  container.replaceChildren(
    el(
      'table',
      {},
      el('thead', {}, el('tr', {}, ...['#', 'When', 'Member', 'Reason', 'By'].map((h) => el('th', { text: h })))),
      el(
        'tbody',
        {},
        warnings.map((warning) =>
          el(
            'tr',
            {},
            el('td', { text: String(warning.id) }),
            el('td', { text: timeAgo(warning.time), title: new Date(warning.time).toLocaleString() }),
            el('td', {}, who(warning.user)),
            el('td', { text: warning.reason }),
            el('td', {}, who(warning.moderator)),
          ),
        ),
      ),
    ),
  );
}

function setChartView(showTable) {
  $('#messages-chart').hidden = showTable;
  $('#messages-table').hidden = !showTable;
  const toggle = $('#messages-view-toggle');
  toggle.setAttribute('aria-pressed', String(showTable));
  toggle.textContent = showTable ? 'Show as chart' : 'Show as table';
  if (!showTable) renderMessagesChart();
}

// ---------- Live feed ----------

function addFeedEvent(event, isNew) {
  const list = $('#feed');
  list.querySelector('.empty-feed')?.remove();
  const item = el(
    'li',
    { className: isNew ? 'new' : '' },
    el('span', { className: 'icon', 'aria-hidden': 'true', text: FEED_ICONS[event.kind] ?? '•' }),
    el('span', { className: 'text', text: event.text }),
    el('time', { datetime: new Date(event.time).toISOString(), 'data-time': event.time, text: timeAgo(event.time) }),
  );
  list.prepend(item);
  while (list.children.length > 60) list.lastElementChild.remove();
}

function connectEvents() {
  state.events?.close();
  const badge = $('#live-badge');
  const url = new URL('/api/events', location.origin);
  url.searchParams.set('guild', state.guildId);
  const source = new EventSource(url);
  source.addEventListener('open', () => {
    badge.classList.add('live');
    $('#live-text').textContent = 'Live';
  });
  source.addEventListener('error', () => {
    badge.classList.remove('live');
    $('#live-text').textContent = 'Reconnecting…';
  });
  source.addEventListener('message', (message) => {
    addFeedEvent(JSON.parse(message.data), true);
    // Keep the numbers fresh too, without hammering the bot during busy moments.
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => state.tab === 'overview' && loadOverview(), 2000);
  });
  state.events = source;
}

// ---------- Members ----------

let searchTimer;
async function searchMembers() {
  const query = $('#member-search').value;
  let members;
  try {
    members = await api(`/api/members?q=${encodeURIComponent(query)}`);
  } catch (err) {
    return toast(err.message, true);
  }
  const list = $('#member-results');
  if (!members.length) {
    list.replaceChildren(el('li', { className: 'empty', text: query ? `Nobody matches "${query}"` : 'No members found' }));
    return;
  }
  list.replaceChildren(
    ...members.map((member) =>
      el(
        'li',
        {},
        el(
          'button',
          { type: 'button', 'data-id': member.id, 'aria-current': String(member.id === state.selectedMember), onClick: () => selectMember(member.id) },
          avatar(member.avatar),
          el('span', {}, el('span', { className: 'name', text: member.name }), el('span', { className: 'meta', text: `Lv ${member.level} · ${formatNumber(member.coins)} coins` })),
          member.warnings ? el('span', { className: 'badge', text: `⚠ ${member.warnings}` }) : null,
        ),
      ),
    ),
  );
}

async function selectMember(id) {
  state.selectedMember = id;
  for (const button of document.querySelectorAll('#member-results button')) button.setAttribute('aria-current', String(button.dataset.id === id));
  try {
    renderMemberDetail(await api(`/api/members/${id}`));
  } catch (err) {
    toast(err.message, true);
  }
}

function renderMemberDetail(member) {
  const currency = state.overview?.currency ?? 'coins';
  const xpInput = el('input', { type: 'number', min: 0, step: 1, value: member.xp, id: 'member-xp' });
  const coinsInput = el('input', { type: 'number', min: 0, step: 1, value: member.coins, id: 'member-coins' });
  const save = el('button', { type: 'button', className: 'btn btn-primary', text: 'Save' });

  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      const updated = await api(`/api/members/${member.id}`, { method: 'PATCH', body: { xp: xpInput.valueAsNumber, coins: coinsInput.valueAsNumber } });
      renderMemberDetail(updated);
      toast(`Saved ${updated.name}'s stats :3`);
      searchMembers();
    } catch (err) {
      toast(err.message, true);
    } finally {
      save.disabled = false;
    }
  });

  const percent = Math.round((member.progress.current / member.progress.needed) * 100);
  const meterFill = el('div', { className: 'meter-fill' });
  meterFill.style.width = `${percent}%`;

  const clearAll = el('button', { type: 'button', className: 'btn btn-danger', text: 'Clear all' });
  clearAll.addEventListener('click', async () => {
    if (!confirm(`Remove all of ${member.name}'s warnings?`)) return;
    try {
      renderMemberDetail(await api(`/api/members/${member.id}/warnings`, { method: 'DELETE' }));
      toast('Warnings cleared. Fresh start!');
      searchMembers();
    } catch (err) {
      toast(err.message, true);
    }
  });

  const warnings = member.warningList.length
    ? el(
        'ul',
        { className: 'warning-list' },
        member.warningList.map((warning) => {
          const remove = el('button', { type: 'button', className: 'btn btn-danger', text: 'Remove' });
          remove.addEventListener('click', async () => {
            try {
              await api(`/api/warnings/${warning.id}`, { method: 'DELETE' });
              toast(`Warning #${warning.id} removed`);
              selectMember(member.id);
              searchMembers();
            } catch (err) {
              toast(err.message, true);
            }
          });
          return el(
            'li',
            {},
            el('div', {}, el('p', { text: warning.reason }), el('p', { className: 'meta', text: `#${warning.id} · by ${warning.moderator.name} · ${shortDate(warning.time)}` })),
            remove,
          );
        }),
      )
    : el('p', { className: 'sub', text: 'No warnings. A perfect angel (˶ᵔ ᵕ ᵔ˶)' });

  $('#member-detail').replaceChildren(
    el(
      'div',
      { className: 'member-head' },
      avatar(member.avatar, 'avatar avatar-xl'),
      el(
        'div',
        {},
        el('h2', { text: member.name }),
        el('p', { className: 'sub', text: `@${member.username}` }),
        el('p', { className: 'sub', text: member.inServer ? (member.joinedAt ? `Joined ${shortDate(member.joinedAt)}` : '') : 'Not in the server anymore' }),
      ),
    ),
    el('p', {}, el('strong', { text: `Level ${member.level}` })),
    el('div', { className: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent, 'aria-label': 'Progress to next level' }, meterFill),
    el('p', { className: 'sub', text: `${number.format(member.progress.current)} / ${number.format(member.progress.needed)} XP to level ${member.level + 1}` }),
    el(
      'div',
      { className: 'fields' },
      el('label', {}, el('span', { className: 'field-label', text: 'Total XP' }), xpInput),
      el('label', {}, el('span', { className: 'field-label', text: `Coins (${currency})` }), coinsInput),
      el('div', {}, el('span', { className: 'field-label', text: 'Daily streak' }), el('p', { text: `🔥 ${plural(member.streak, 'day')}` })),
    ),
    save,
    el('h3', { className: 'section-title' }, el('span', { text: `Warnings (${member.warningList.length})` }), member.warningList.length ? clearAll : null),
    warnings,
  );
}

// ---------- Settings ----------

const getPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((node, key) => node[key], object)[last] = value;
}

async function loadSettings() {
  try {
    state.settings = await api('/api/settings');
  } catch (err) {
    return toast(err.message, true);
  }
  resetDraft();
}

function resetDraft() {
  state.draft = structuredClone(state.settings.values);
  state.rewardRows = Object.entries(state.draft.levels.roleRewards).map(([level, roleId]) => ({ level, roleId }));
  renderSettingsForm();
  updateDirty();
}

function syncRewards() {
  setPath(state.draft, 'levels.roleRewards', Object.fromEntries(state.rewardRows.map((row) => [String(row.level), row.roleId])));
}

const isDirty = () => JSON.stringify(state.draft) !== JSON.stringify(state.settings.values);

function updateDirty() {
  $('#save-bar').hidden = !isDirty();
}

// Settings other fields depend on (for showIf or default hints), so changing them redraws the form.
const REDRAW_ON = new Set(['ai.provider', 'ai.personality']);

function change(path, value) {
  setPath(state.draft, path, value);
  updateDirty();
  if (REDRAW_ON.has(path)) renderSettingsForm();
}

function channelSelect(value, emptyLabel, onChange) {
  const { channels } = state.settings;
  const select = el('select', { onChange: () => onChange(select.value) }, el('option', { value: '', text: emptyLabel }));
  const groups = new Map();
  for (const channel of channels) {
    if (!groups.has(channel.category)) groups.set(channel.category, []);
    groups.get(channel.category).push(channel);
  }
  for (const [category, list] of groups) {
    const options = list.map((channel) => el('option', { value: channel.id, text: `# ${channel.name}` }));
    select.append(...(category ? [el('optgroup', { label: category }, options)] : options));
  }
  if (value && !channels.some((channel) => channel.id === value)) select.append(el('option', { value, text: `Unknown channel (${value})` }));
  select.value = value;
  return select;
}

function roleSelect(value, placeholder, onChange, exclude = []) {
  const select = el('select', { onChange: () => onChange(select.value) }, el('option', { value: '', text: placeholder }));
  for (const role of state.settings.roles) {
    if (!exclude.includes(role.id)) select.append(el('option', { value: role.id, text: `@ ${role.name}` }));
  }
  if (value && !state.settings.roles.some((role) => role.id === value)) select.append(el('option', { value, text: `Unknown role (${value})` }));
  select.value = value;
  return select;
}

function chipPicker(path, kind) {
  const lookup = kind === 'roles' ? state.settings.roles : state.settings.channels;
  const wrap = el('div');
  const render = () => {
    const current = getPath(state.draft, path);
    const chips = el(
      'div',
      { className: 'chips' },
      current.map((id) => {
        const item = lookup.find((entry) => entry.id === id);
        const swatch = el('span', { className: 'swatch', 'aria-hidden': 'true' });
        if (kind === 'roles' && item?.color && item.color !== '#000000') swatch.style.background = item.color;
        const name = item ? `${kind === 'roles' ? '@' : '#'} ${item.name}` : `Unknown (${id})`;
        return el(
          'span',
          { className: 'chip' },
          kind === 'roles' ? swatch : null,
          el('span', { text: name }),
          el('button', {
            type: 'button',
            'aria-label': `Remove ${name}`,
            text: '×',
            onClick: () => {
              change(path, getPath(state.draft, path).filter((other) => other !== id));
              render();
            },
          }),
        );
      }),
    );
    const add = (id) => {
      if (!id) return;
      change(path, [...getPath(state.draft, path), id]);
      render();
    };
    const picker =
      kind === 'roles'
        ? roleSelect('', 'Add a role…', add, current)
        : (() => {
            const select = channelSelect('', 'Add a channel…', add);
            for (const option of select.querySelectorAll('option')) if (current.includes(option.value)) option.remove();
            return select;
          })();
    wrap.replaceChildren(current.length ? chips : el('p', { className: 'setting-help', text: 'None yet' }), picker);
  };
  render();
  return wrap;
}

function rewardsEditor() {
  const wrap = el('div');
  const render = () => {
    const rows = state.rewardRows.map((row, i) => {
      const level = el('input', {
        type: 'number',
        min: 1,
        max: 1000,
        value: row.level,
        'aria-label': 'Level',
        onInput: () => {
          row.level = level.value;
          syncRewards();
          updateDirty();
        },
      });
      const role = roleSelect(row.roleId, 'Pick a role…', (value) => {
        row.roleId = value;
        syncRewards();
        updateDirty();
      });
      const remove = el('button', {
        type: 'button',
        className: 'btn btn-danger',
        text: 'Remove',
        onClick: () => {
          state.rewardRows.splice(i, 1);
          syncRewards();
          updateDirty();
          render();
        },
      });
      return el('div', { className: 'reward-row' }, el('span', { className: 'setting-help', text: 'Level' }), level, role, remove);
    });
    const add = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      text: '+ Add a level role',
      onClick: () => {
        const highest = Math.max(0, ...state.rewardRows.map((row) => Number(row.level) || 0));
        state.rewardRows.push({ level: String(highest + 5), roleId: '' });
        syncRewards();
        updateDirty();
        render();
      },
    });
    wrap.replaceChildren(...rows, add);
  };
  render();
  return wrap;
}

function settingControl(field) {
  const value = field.path ? getPath(state.draft, field.path) : undefined;
  const id = `setting-${(field.path ?? field.type).replaceAll('.', '-')}`;
  switch (field.type) {
    case 'bool': {
      const input = el('input', { type: 'checkbox', id, onChange: () => change(field.path, input.checked) });
      input.checked = value;
      return el('label', { className: 'switch' }, input, el('span'));
    }
    case 'int': {
      const input = el('input', { type: 'number', id, min: field.min, max: field.max, step: 1, value, onInput: () => change(field.path, input.valueAsNumber) });
      return input;
    }
    case 'text': {
      const props = { id, maxlength: field.max, onInput: () => change(field.path, input.value) };
      const input = field.multiline ? el('textarea', { ...props, rows: 2 }) : el('input', { ...props, type: 'text' });
      input.value = value;
      return input;
    }
    case 'channel': {
      const select = channelSelect(value, field.emptyLabel ?? 'Off', (next) => change(field.path, next));
      select.id = id;
      return select;
    }
    case 'roles':
    case 'channels':
      return chipPicker(field.path, field.type);
    case 'words': {
      const input = el('textarea', {
        id,
        rows: 4,
        placeholder: 'one word per line',
        onInput: () => change(field.path, input.value.split(/[\n,]/).map((word) => word.trim()).filter(Boolean)),
      });
      input.value = value.join('\n');
      return input;
    }
    case 'roleRewards':
      return rewardsEditor();
    case 'select':
    case 'personality': {
      const select = el(
        'select',
        { id, onChange: () => change(field.path, select.value) },
        field.options.map((option) => el('option', { value: option.value, text: option.label })),
      );
      select.value = value;
      const chosen = field.options.find((option) => option.value === value);
      if (field.type === 'select') return el('div', {}, select, chosen?.help ? el('p', { className: 'option-help', text: chosen.help }) : null);
      return el('div', {}, select, chosen?.prompt ? el('blockquote', { className: 'preview', text: chosen.prompt }) : null);
    }
    case 'secret': {
      const input = el('input', { type: 'password', id, maxlength: field.max, autocomplete: 'off', spellcheck: 'false', onInput: () => change(field.path, input.value) });
      input.value = value;
      const toggle = el('button', {
        type: 'button',
        className: 'btn btn-ghost btn-small',
        text: 'Show',
        onClick: () => {
          input.type = input.type === 'password' ? 'text' : 'password';
          toggle.textContent = input.type === 'password' ? 'Show' : 'Hide';
        },
      });
      return el('div', { className: 'inline-row' }, input, toggle);
    }
    case 'url': {
      const input = el('input', { type: 'text', id, placeholder: 'http://localhost:1234/v1', spellcheck: 'false', onInput: () => change(field.path, input.value) });
      input.value = value;
      return input;
    }
    case 'model':
      return modelPicker(field, id, value);
    case 'aiTest':
      return aiTester();
    default:
      return el('span', { text: 'Unsupported setting' });
  }
}

function modelPicker(field, id, value) {
  const provider = getPath(state.draft, 'ai.provider');
  const listId = `${id}-list`;
  const input = el('input', {
    type: 'text',
    id,
    list: listId,
    maxlength: field.max,
    spellcheck: 'false',
    placeholder: field.defaults[provider] ? `Default: ${field.defaults[provider]}` : 'Model name',
    onInput: () => change(field.path, input.value),
  });
  input.value = value;
  const list = el('datalist', { id: listId });
  const status = el('p', { className: 'option-help' });
  const load = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-small',
    text: 'Load models',
    onClick: async () => {
      load.disabled = true;
      status.textContent = 'Asking for the list…';
      try {
        const { models } = await api('/api/ai/models', { method: 'POST', body: { ai: state.draft.ai } });
        list.replaceChildren(...models.map((model) => el('option', { value: model })));
        status.textContent = models.length
          ? `Found ${plural(models.length, 'model')}. Click the box to pick one.`
          : 'No models found. With Ollama, run "ollama pull llama3.2" first.';
      } catch (err) {
        status.textContent = err.message;
      } finally {
        load.disabled = false;
      }
    },
  });
  return el('div', {}, el('div', { className: 'inline-row' }, input, load), list, status);
}

function aiTester() {
  const output = el('div', { className: 'ai-reply', 'aria-live': 'polite' });
  const send = el('button', { type: 'button', className: 'btn btn-primary btn-small', text: 'Send' });
  const input = el('input', { type: 'text', maxlength: 500, placeholder: 'Say something to Mochi…', 'aria-label': 'Message to test the AI' });

  const run = async () => {
    send.disabled = true;
    output.className = 'ai-reply thinking';
    output.textContent = 'Mochi is thinking… (the first reply from Ollama can take a minute)';
    try {
      const { reply } = await api('/api/ai/test', { method: 'POST', body: { ai: state.draft.ai, message: input.value } });
      output.className = 'ai-reply';
      output.replaceChildren(el('strong', { text: 'Mochi: ' }), el('span', { text: reply || '(no answer)' }));
    } catch (err) {
      output.className = 'ai-reply error';
      output.replaceChildren(el('span', { text: err.message }), err.detail ? el('small', { text: err.detail }) : null);
    } finally {
      send.disabled = false;
    }
  };
  send.addEventListener('click', run);
  // Enter sends the test message instead of saving the whole settings form.
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!send.disabled) run();
  });
  return el('div', {}, el('div', { className: 'inline-row' }, input, send), output);
}

function renderSettingsForm() {
  const form = $('#settings-form');
  form.replaceChildren(
    ...state.settings.sections.map((section) =>
      el(
        'fieldset',
        {},
        el('legend', { text: section.title }),
        section.fields.map((field) => {
          if (field.showIf && getPath(state.draft, field.showIf.path) !== field.showIf.equals) return null;
          const id = `setting-${(field.path ?? field.type).replaceAll('.', '-')}`;
          const labelTag = ['roles', 'channels', 'roleRewards', 'aiTest', 'model'].includes(field.type) ? 'p' : 'label';
          return el(
            'div',
            { className: 'setting', 'data-path': field.path },
            el(
              'div',
              {},
              el(labelTag, { className: 'field-label', for: labelTag === 'label' ? id : null, text: field.label }),
              field.help ? el('p', { className: 'setting-help', text: field.help }) : null,
            ),
            el('div', { className: 'control' }, settingControl(field)),
          );
        }),
      ),
    ),
  );
}

function showFieldError(path, message) {
  for (const row of document.querySelectorAll('.setting.invalid')) {
    row.classList.remove('invalid');
    row.querySelector('.setting-error')?.remove();
  }
  const row = path && document.querySelector(`.setting[data-path="${CSS.escape(path)}"]`);
  if (!row) return;
  row.classList.add('invalid');
  row.querySelector('.control').append(el('p', { className: 'setting-error', text: message }));
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveSettings(event) {
  event.preventDefault();
  const button = $('#settings-save');
  button.disabled = true;
  try {
    state.settings = await api('/api/settings', { method: 'PUT', body: { values: state.draft } });
    resetDraft();
    showFieldError(null);
    toast('Saved! Your changes are live :3');
  } catch (err) {
    showFieldError(err.field, err.message);
    toast(err.message, true);
  } finally {
    button.disabled = false;
  }
}

// ---------- Wire it all up ----------

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(storedTheme());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(storedTheme()));
  $('#theme-toggle').addEventListener('click', toggleTheme);
  setupTabs();

  $('#messages-view-toggle').addEventListener('click', () => setChartView($('#messages-table').hidden));
  new ResizeObserver(() => requestAnimationFrame(renderMessagesChart)).observe($('#messages-card'));

  $('#member-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(searchMembers, 250);
  });

  $('#settings-form').addEventListener('submit', saveSettings);
  $('#settings-reset').addEventListener('click', resetDraft);
  window.addEventListener('beforeunload', (event) => {
    if (state.draft && isDirty()) event.preventDefault();
  });

  $('#guild-picker').addEventListener('change', (event) => {
    state.guildId = event.target.value;
    state.feedLoaded = false;
    state.settings = null;
    state.selectedMember = null;
    $('#member-results').replaceChildren();
    connectEvents();
    selectTab(state.tab);
  });

  // Keep "5m ago" labels fresh.
  setInterval(() => {
    for (const node of document.querySelectorAll('#feed time')) node.textContent = timeAgo(Number(node.dataset.time));
  }, 30_000);

  boot();
});
