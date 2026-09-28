const { SlashCommandBuilder, ChannelType, time, TimestampStyles } = require('discord.js');
const { cuteEmbed } = require('../../util/cute');

module.exports = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Info about this server'),

  async execute(interaction) {
    const { guild } = interaction;
    const channels = guild.channels.cache;
    const textCount = channels.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceCount = channels.filter((c) => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size;

    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: `🏠 ${guild.name}`,
          description: guild.description ?? undefined,
          thumbnail: guild.iconURL({ size: 256 }) ?? undefined,
          fields: [
            { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
            { name: 'Members', value: guild.memberCount.toLocaleString(), inline: true },
            { name: 'Created', value: time(guild.createdAt, TimestampStyles.RelativeTime), inline: true },
            { name: 'Channels', value: `💬 ${textCount} text · 🔊 ${voiceCount} voice`, inline: true },
            { name: 'Roles', value: String(guild.roles.cache.size - 1), inline: true },
            { name: 'Boosts', value: `${guild.premiumSubscriptionCount ?? 0} (tier ${guild.premiumTier})`, inline: true },
          ],
          footer: `Server ID: ${guild.id}`,
        }),
      ],
    });
  },
};
