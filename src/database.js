const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'mochi.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS members (
    guild_id      TEXT    NOT NULL,
    user_id       TEXT    NOT NULL,
    xp            INTEGER NOT NULL DEFAULT 0,
    coins         INTEGER NOT NULL DEFAULT 0,
    last_xp_at    INTEGER NOT NULL DEFAULT 0,
    last_daily_at INTEGER NOT NULL DEFAULT 0,
    daily_streak  INTEGER NOT NULL DEFAULT 0,
    last_work_at  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT    NOT NULL,
    user_id      TEXT    NOT NULL,
    moderator_id TEXT    NOT NULL,
    reason       TEXT    NOT NULL,
    created_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS warnings_by_member ON warnings (guild_id, user_id);

  CREATE TABLE IF NOT EXISTS reminders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL,
    channel_id TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    remind_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS reminders_by_time ON reminders (remind_at);
`);

const stmt = {
  ensureMember: db.prepare('INSERT INTO members (guild_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING'),
  getMember: db.prepare('SELECT * FROM members WHERE guild_id = ? AND user_id = ?'),
  addXp: db.prepare(`
    UPDATE members SET xp = xp + ?, last_xp_at = ?
    WHERE guild_id = ? AND user_id = ? AND last_xp_at <= ?`),
  addCoins: db.prepare('UPDATE members SET coins = coins + ? WHERE guild_id = ? AND user_id = ?'),
  takeCoins: db.prepare(`
    UPDATE members SET coins = coins - ?
    WHERE guild_id = ? AND user_id = ? AND coins >= ?`),
  setDaily: db.prepare(`
    UPDATE members SET coins = coins + ?, last_daily_at = ?, daily_streak = ?
    WHERE guild_id = ? AND user_id = ?`),
  setWork: db.prepare(`
    UPDATE members SET coins = coins + ?, last_work_at = ?
    WHERE guild_id = ? AND user_id = ?`),
  topXp: db.prepare('SELECT user_id, xp FROM members WHERE guild_id = ? AND xp > 0 ORDER BY xp DESC LIMIT ?'),
  topCoins: db.prepare('SELECT user_id, coins FROM members WHERE guild_id = ? AND coins > 0 ORDER BY coins DESC LIMIT ?'),
  xpRank: db.prepare('SELECT COUNT(*) + 1 AS rank FROM members WHERE guild_id = ? AND xp > ?'),

  addWarning: db.prepare(`
    INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?)`),
  listWarnings: db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY id'),
  countWarnings: db.prepare('SELECT COUNT(*) AS count FROM warnings WHERE guild_id = ? AND user_id = ?'),
  deleteWarning: db.prepare('DELETE FROM warnings WHERE id = ? AND guild_id = ?'),
  clearWarnings: db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?'),

  addReminder: db.prepare('INSERT INTO reminders (user_id, channel_id, message, remind_at) VALUES (?, ?, ?, ?)'),
  dueReminders: db.prepare('SELECT * FROM reminders WHERE remind_at <= ? ORDER BY remind_at'),
  countReminders: db.prepare('SELECT COUNT(*) AS count FROM reminders WHERE user_id = ?'),
  deleteReminder: db.prepare('DELETE FROM reminders WHERE id = ?'),
};

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function getMember(guildId, userId) {
  stmt.ensureMember.run(guildId, userId);
  return stmt.getMember.get(guildId, userId);
}

/** Adds XP unless the member is still on cooldown. Returns the new total, or null if on cooldown. */
function addXp(guildId, userId, amount, cooldownMs, now = Date.now()) {
  stmt.ensureMember.run(guildId, userId);
  const { changes } = stmt.addXp.run(amount, now, guildId, userId, now - cooldownMs);
  return changes ? stmt.getMember.get(guildId, userId).xp : null;
}

function addCoins(guildId, userId, amount) {
  stmt.ensureMember.run(guildId, userId);
  stmt.addCoins.run(amount, guildId, userId);
}

/** Removes coins only if the member can afford it. Returns true on success. */
function takeCoins(guildId, userId, amount) {
  stmt.ensureMember.run(guildId, userId);
  return stmt.takeCoins.run(amount, guildId, userId, amount).changes === 1;
}

function transferCoins(guildId, fromId, toId, amount) {
  return transaction(() => {
    if (!takeCoins(guildId, fromId, amount)) return false;
    addCoins(guildId, toId, amount);
    return true;
  });
}

module.exports = {
  db,
  transaction,
  getMember,
  addXp,
  addCoins,
  takeCoins,
  transferCoins,
  claimDaily: (guildId, userId, amount, streak, now) => stmt.setDaily.run(amount, now, streak, guildId, userId),
  claimWork: (guildId, userId, amount, now) => stmt.setWork.run(amount, now, guildId, userId),
  topXp: (guildId, limit = 10) => stmt.topXp.all(guildId, limit),
  topCoins: (guildId, limit = 10) => stmt.topCoins.all(guildId, limit),
  xpRank: (guildId, xp) => stmt.xpRank.get(guildId, xp).rank,

  addWarning: (guildId, userId, moderatorId, reason) =>
    Number(stmt.addWarning.run(guildId, userId, moderatorId, reason, Date.now()).lastInsertRowid),
  listWarnings: (guildId, userId) => stmt.listWarnings.all(guildId, userId),
  countWarnings: (guildId, userId) => stmt.countWarnings.get(guildId, userId).count,
  deleteWarning: (guildId, id) => stmt.deleteWarning.run(id, guildId).changes === 1,
  clearWarnings: (guildId, userId) => stmt.clearWarnings.run(guildId, userId).changes,

  addReminder: (userId, channelId, message, remindAt) => stmt.addReminder.run(userId, channelId, message, remindAt),
  dueReminders: (now = Date.now()) => stmt.dueReminders.all(now),
  countReminders: (userId) => stmt.countReminders.get(userId).count,
  deleteReminder: (id) => stmt.deleteReminder.run(id),
};
