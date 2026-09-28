const { EventEmitter } = require('node:events');

// A small in-memory feed of what Mochi is up to, streamed live to the dashboard.
const feed = new EventEmitter();
const recent = [];
const MAX_RECENT = 100;
let nextId = 1;

/**
 * Records something that happened, like a command or an auto-mod hit.
 * `kind` picks the icon on the dashboard: command, automod, join, leave, level, mod, dashboard.
 */
function record(guildId, kind, text) {
  const event = { id: nextId++, time: Date.now(), guildId, kind, text };
  recent.push(event);
  if (recent.length > MAX_RECENT) recent.shift();
  feed.emit('event', event);
}

const recentActivity = (guildId) => recent.filter((event) => event.guildId === guildId);

module.exports = { feed, record, recentActivity };
