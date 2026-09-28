const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const { findBannedWord, hasInvite, SpamTracker } = require('../util/automod');
const { sendLog } = require('../util/logger');
const { kao, truncate } = require('../util/cute');

const spam = new SpamTracker();
setInterval(() => spam.sweep(60_000), 60_000).unref();

/** Messages automod removed, so the "message deleted" logger doesn't log them a second time. */
const deletedByAutomod = new Set();

function rememberDeleted(ids) {
  for (const id of ids) {
    deletedByAutomod.add(id);
    setTimeout(() => deletedByAutomod.delete(id), 30_000).unref();
  }
}

function isExempt(message) {
  const { member } = message;
  if (!member) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  if (config.automod.exemptChannelIds.includes(message.channelId)) return true;
  return config.automod.exemptRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

function findProblem(message, { countSpam }) {
  const { bannedWords, blockInvites, maxMentions } = config.automod;

  const word = findBannedWord(message.content, bannedWords);
  if (word) return { reason: `Banned word (${word})`, notice: 'please watch your language!' };

  if (blockInvites && hasInvite(message.content)) return { reason: 'Invite link', notice: 'no server invites here, please!' };

  const mentions = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0);
  if (maxMentions > 0 && mentions > maxMentions) {
    return { reason: `Mass mention (${mentions} pings)`, notice: "that's way too many pings!", timeout: true };
  }

  if (countSpam && spam.hit(`${message.guildId}:${message.author.id}`, config.automod.spam)) {
    return { reason: 'Spam', notice: "you're sending messages too fast!", timeout: true, spam: true };
  }
  return null;
}

/** Clears out the spammer's burst of messages, not just the one that tripped the limit. */
async function deleteSpamBurst(message) {
  const since = Date.now() - config.automod.spam.perSeconds * 1000 - 2000;
  const recent = await message.channel.messages.fetch({ limit: 25 }).catch(() => null);
  const burst = recent?.filter((m) => m.author.id === message.author.id && m.createdTimestamp >= since);
  if (!burst?.size) {
    rememberDeleted([message.id]);
    await message.delete().catch(() => {});
    return;
  }
  rememberDeleted(burst.keys());
  await message.channel.bulkDelete(burst, true).catch(() => {});
}

/**
 * Checks a message against the automod rules and cleans up if it breaks one.
 * Returns true if the message was removed. Edited messages skip the spam check.
 */
async function runAutomod(message, { edited = false } = {}) {
  if (!config.automod.enabled || isExempt(message)) return false;

  const problem = findProblem(message, { countSpam: !edited });
  if (!problem) return false;

  if (problem.spam) {
    await deleteSpamBurst(message);
  } else {
    rememberDeleted([message.id]);
    await message.delete().catch(() => {});
  }

  const minutes = config.automod.spam.timeoutMinutes;
  let timedOut = false;
  if (problem.timeout && minutes > 0 && message.member.moderatable) {
    timedOut = await message.member
      .timeout(minutes * 60 * 1000, `Automod: ${problem.reason}`)
      .then(() => true)
      .catch(() => false);
  }

  const warning = await message.channel
    .send(`${message.author}, ${problem.notice} ${kao('angry')}${timedOut ? ` (timed out for ${minutes} min)` : ''}`)
    .catch(() => null);
  if (warning) setTimeout(() => warning.delete().catch(() => {}), 8000).unref();

  await sendLog(message.guild, {
    title: '🛡️ Automod',
    color: 'red',
    fields: [
      { name: 'User', value: `${message.author} (${message.author.id})`, inline: true },
      { name: 'Channel', value: `${message.channel}`, inline: true },
      { name: 'Rule', value: problem.reason + (edited ? ' (in an edit)' : ''), inline: true },
      { name: 'Message', value: truncate(message.content) },
      ...(timedOut ? [{ name: 'Action', value: `Timed out for ${minutes} min` }] : []),
    ],
  });
  return true;
}

module.exports = { runAutomod, deletedByAutomod };
