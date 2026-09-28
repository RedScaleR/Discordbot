const config = require('../config');
const { cuteEmbed } = require('./cute');
const { record } = require('../activity');

/** Sends an embed to the server's log channel (if one is set up in config.json). */
async function sendLog(guild, embedOptions) {
  if (!config.logChannelId) return;
  const channel = guild.channels.cache.get(config.logChannelId);
  if (!channel?.isTextBased()) return;

  const embed = cuteEmbed({ color: 'lavender', ...embedOptions }).setTimestamp();
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch((err) => {
    console.warn(`[log] Couldn't post in the log channel: ${err.message}`);
  });
}

/** Logs a moderation action with who did it and why. */
function logModAction(guild, { action, emoji, target, moderator, reason, extra = [] }) {
  record(guild.id, 'mod', `${moderator.username}: ${action.toLowerCase()} for ${target.username} (${reason})`);
  return sendLog(guild, {
    title: `${emoji} ${action}`,
    color: 'peach',
    fields: [
      { name: 'User', value: `${target} (${target.id})`, inline: true },
      { name: 'Moderator', value: `${moderator}`, inline: true },
      ...extra,
      { name: 'Reason', value: reason },
    ],
  });
}

// Mochi logs its own bans/unbans in the command (with the moderator and reason), so the
// ban event listeners use this to skip those and only log bans done some other way.
const expectedEvents = new Set();

function expectEvent(key) {
  expectedEvents.add(key);
  setTimeout(() => expectedEvents.delete(key), 60_000).unref();
}

const wasExpected = (key) => expectedEvents.delete(key);

/** Finds who did something from the audit log (needs the View Audit Log permission). */
async function findAuditEntry(guild, type, targetId) {
  // The audit log entry can show up a moment after the event itself.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  return logs?.entries.find((entry) => entry.targetId === targetId && Date.now() - entry.createdTimestamp < 30_000) ?? null;
}

module.exports = { sendLog, logModAction, expectEvent, wasExpected, findAuditEntry };
