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

  -- Daily counters for the dashboard charts. "day" is YYYY-MM-DD in the PC's local time.
  CREATE TABLE IF NOT EXISTS daily_stats (
    guild_id TEXT    NOT NULL,
    day      TEXT    NOT NULL,
    messages INTEGER NOT NULL DEFAULT 0,
    commands INTEGER NOT NULL DEFAULT 0,
    joins    INTEGER NOT NULL DEFAULT 0,
    leaves   INTEGER NOT NULL DEFAULT 0,
    automod  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, day)
  );

  CREATE TABLE IF NOT EXISTS command_stats (
    guild_id TEXT    NOT NULL,
    command  TEXT    NOT NULL,
    uses     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, command)
  );
`);

const STAT_FIELDS = ['messages', 'commands', 'joins', 'leaves', 'automod'];

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

  setXp: db.prepare('UPDATE members SET xp = ? WHERE guild_id = ? AND user_id = ?'),
  setCoins: db.prepare('UPDATE members SET coins = ? WHERE guild_id = ? AND user_id = ?'),
  totals: db.prepare('SELECT COALESCE(SUM(coins), 0) AS coins, COALESCE(SUM(xp), 0) AS xp FROM members WHERE guild_id = ?'),
  warningCounts: db.prepare(`
    SELECT user_id, COUNT(*) AS count FROM warnings WHERE guild_id = ? GROUP BY user_id`),
  totalWarnings: db.prepare('SELECT COUNT(*) AS count FROM warnings WHERE guild_id = ?'),
  recentWarnings: db.prepare('SELECT * FROM warnings WHERE guild_id = ? ORDER BY id DESC LIMIT ?'),
  allMembers: db.prepare('SELECT * FROM members WHERE guild_id = ?'),
  bumpStat: Object.fromEntries(
    STAT_FIELDS.map((field) => [
      field,
      db.prepare(`
        INSERT INTO daily_stats (guild_id, day, ${field}) VALUES (?, ?, 1)
        ON CONFLICT (guild_id, day) DO UPDATE SET ${field} = ${field} + 1`),
    ]),
  ),
  statsSince: db.prepare('SELECT * FROM daily_stats WHERE guild_id = ? AND day >= ? ORDER BY day'),
  bumpCommand: db.prepare(`
    INSERT INTO command_stats (guild_id, command, uses) VALUES (?, ?, 1)
    ON CONFLICT (guild_id, command) DO UPDATE SET uses = uses + 1`),
  topCommands: db.prepare('SELECT command, uses FROM command_stats WHERE guild_id = ? ORDER BY uses DESC LIMIT ?'),
};

/** A date as YYYY-MM-DD in local time. */
function dayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Daily counters for the last `days` days (oldest first), with empty days filled in as zeros. */
function recentStats(guildId, days) {
  const keys = Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    return dayKey(date);
  });
  const rows = new Map(stmt.statsSince.all(guildId, keys[0]).map((row) => [row.day, row]));
  return keys.map((day) => {
    const row = rows.get(day);
    return { day, ...Object.fromEntries(STAT_FIELDS.map((field) => [field, row?.[field] ?? 0])) };
  });
}

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

  /** Adds one to today's counter, like bumpStat(guildId, 'messages'). */
  bumpStat: (guildId, field) => stmt.bumpStat[field].run(guildId, dayKey()),
  bumpCommand: (guildId, command) => stmt.bumpCommand.run(guildId, command),
  recentStats,
  topCommands: (guildId, limit = 8) => stmt.topCommands.all(guildId, limit),
  totals: (guildId) => stmt.totals.get(guildId),
  totalWarnings: (guildId) => stmt.totalWarnings.get(guildId).count,
  warningCounts: (guildId) => new Map(stmt.warningCounts.all(guildId).map((row) => [row.user_id, row.count])),
  recentWarnings: (guildId, limit = 10) => stmt.recentWarnings.all(guildId, limit),
  /** Every stored member row for a server, by user ID (read-only, unlike getMember). */
  allMembers: (guildId) => new Map(stmt.allMembers.all(guildId).map((row) => [row.user_id, row])),
  setXp: (guildId, userId, xp) => {
    stmt.ensureMember.run(guildId, userId);
    stmt.setXp.run(xp, guildId, userId);
  },
  setCoins: (guildId, userId, coins) => {
    stmt.ensureMember.run(guildId, userId);
    stmt.setCoins.run(coins, guildId, userId);
  },
};
