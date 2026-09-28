const config = require('../config');
const db = require('../database');
const { levelFromXp } = require('../util/levels');
const { cuteEmbed, kao, randomInt } = require('../util/cute');

/** Gives any reward roles for levels the member has reached but doesn't have yet. */
async function giveRoleRewards(member, level) {
  const roles = Object.entries(config.levels.roleRewards)
    .filter(([requiredLevel, roleId]) => roleId && Number(requiredLevel) <= level && !member.roles.cache.has(roleId))
    .map(([, roleId]) => member.guild.roles.cache.get(roleId))
    .filter((role) => role?.editable);
  if (!roles.length) return [];

  try {
    await member.roles.add(roles, `Reached level ${level}`);
    return roles;
  } catch (err) {
    console.warn(`[levels] Couldn't give level roles to ${member.user.username}: ${err.message}`);
    return [];
  }
}

/** Gives XP for a chat message and announces level ups. */
async function giveXp(message) {
  const { levels } = config;
  if (!levels.enabled) return;

  const amount = randomInt(levels.xpMin, levels.xpMax);
  const totalXp = db.addXp(message.guildId, message.author.id, amount, levels.cooldownSeconds * 1000);
  if (totalXp === null) return;

  const before = levelFromXp(totalXp - amount).level;
  const after = levelFromXp(totalXp).level;
  if (after <= before) return;

  const coins = levels.coinsPerLevel * after;
  if (coins) db.addCoins(message.guildId, message.author.id, coins);
  const roles = await giveRoleRewards(message.member, after);

  const lines = [`${message.author} just reached **level ${after}**! ${kao('happy')}`];
  if (coins) lines.push(`+${coins.toLocaleString()} ${config.economy.currency} level-up bonus`);
  if (roles.length) lines.push(`New role${roles.length === 1 ? '' : 's'}: ${roles.join(' ')}`);

  const channel = message.guild.channels.cache.get(levels.announceChannelId) ?? message.channel;
  await channel
    .send({ embeds: [cuteEmbed({ title: '🎉 Level up!', description: lines.join('\n'), thumbnail: message.author.displayAvatarURL() })] })
    .catch(() => {});
}

module.exports = { giveXp };
