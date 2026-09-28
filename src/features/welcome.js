const { escapeMarkdown, time, TimestampStyles } = require('discord.js');
const config = require('../config');
const { cuteEmbed } = require('../util/cute');
const { sendLog } = require('../util/logger');

/** Fills in {user}, {username}, {server} and {count} in a welcome/goodbye message. */
function fill(template, member) {
  return template
    .replaceAll('{user}', `${member}`)
    .replaceAll('{username}', escapeMarkdown(member.user.username))
    .replaceAll('{server}', escapeMarkdown(member.guild.name))
    .replaceAll('{count}', member.guild.memberCount.toLocaleString());
}

async function welcome(member) {
  const channel = member.guild.channels.cache.get(config.welcome.channelId);
  if (channel?.isTextBased()) {
    await channel
      .send({
        content: `${member}`,
        embeds: [
          cuteEmbed({
            title: '🌸 A new friend appeared!',
            description: fill(config.welcome.message, member),
            thumbnail: member.user.displayAvatarURL({ size: 256 }),
          }),
        ],
        allowedMentions: { users: [member.id] },
      })
      .catch((err) => console.warn(`[welcome] ${err.message}`));
  }

  await sendLog(member.guild, {
    title: '📥 Member joined',
    color: 'mint',
    description: `${member} (${escapeMarkdown(member.user.username)})`,
    thumbnail: member.user.displayAvatarURL(),
    fields: [{ name: 'Account created', value: time(member.user.createdAt, TimestampStyles.RelativeTime) }],
    footer: `User ID: ${member.id}`,
  });
}

async function goodbye(member) {
  const channel = member.guild.channels.cache.get(config.goodbye.channelId);
  if (channel?.isTextBased()) {
    await channel
      .send({
        embeds: [cuteEmbed({ description: `👋 ${fill(config.goodbye.message, member)}`, color: 'lavender' })],
        allowedMentions: { parse: [] },
      })
      .catch((err) => console.warn(`[goodbye] ${err.message}`));
  }

  await sendLog(member.guild, {
    title: '📤 Member left',
    color: 'peach',
    description: `${member} (${escapeMarkdown(member.user.username)})`,
    thumbnail: member.user.displayAvatarURL(),
    fields: member.joinedAt ? [{ name: 'Joined', value: time(member.joinedAt, TimestampStyles.RelativeTime) }] : [],
    footer: `User ID: ${member.id}`,
  });
}

module.exports = { welcome, goodbye };
