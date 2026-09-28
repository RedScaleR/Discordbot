const { SlashCommandBuilder } = require('discord.js');
const { cuteEmbed } = require('../../util/cute');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Show someone's profile picture, nice and big")
    .addUserOption((o) => o.setName('user').setDescription('Whose avatar? (defaults to you)')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.options.getMember('user') ?? (user.id === interaction.user.id ? interaction.member : null);
    // Show their server-specific avatar if they have one.
    const url = (member ?? user).displayAvatarURL({ size: 1024 });

    await interaction.reply({
      embeds: [cuteEmbed({ title: `${member?.displayName ?? user.displayName}'s avatar :3` }).setImage(url).setURL(url)],
    });
  },
};
