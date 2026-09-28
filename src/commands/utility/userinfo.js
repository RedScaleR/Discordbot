const { SlashCommandBuilder, time, TimestampStyles } = require('discord.js');
const { cuteEmbed, truncate } = require('../../util/cute');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Info about someone')
    .addUserOption((o) => o.setName('user').setDescription('Who? (defaults to you)')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.options.getMember('user') ?? (user.id === interaction.user.id ? interaction.member : null);

    const fields = [
      { name: 'Username', value: user.username, inline: true },
      { name: 'Account created', value: time(user.createdAt, TimestampStyles.RelativeTime), inline: true },
    ];
    if (member) {
      const roles = member.roles.cache
        .filter((role) => role.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => `${role}`);
      fields.push(
        { name: 'Joined server', value: time(member.joinedAt, TimestampStyles.RelativeTime), inline: true },
        { name: `Roles (${roles.length})`, value: truncate(roles.join(' ') || 'None', 1024) },
      );
    }

    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: `${user.bot ? '🤖' : '🌸'} ${member?.displayName ?? user.displayName}`,
          thumbnail: user.displayAvatarURL({ size: 256 }),
          fields,
          color: member?.displayColor || 'pink',
          footer: `User ID: ${user.id}`,
        }),
      ],
      allowedMentions: { parse: [] },
    });
  },
};
