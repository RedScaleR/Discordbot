const { SlashCommandBuilder, MessageFlags, escapeMarkdown } = require('discord.js');
const { cuteEmbed, oops, pick } = require('../../util/cute');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('choose')
    .setDescription("Can't decide? Let Mochi pick for you")
    .addStringOption((o) =>
      o.setName('options').setDescription('Things to pick from, separated by commas (pizza, sushi, tacos)').setRequired(true),
    ),

  async execute(interaction) {
    const options = interaction.options
      .getString('options')
      .split(/[,|]/)
      .map((option) => option.trim())
      .filter(Boolean);

    if (options.length < 2) {
      return interaction.reply({ embeds: [oops('Give me at least two things, separated by commas')], flags: MessageFlags.Ephemeral });
    }

    await interaction.reply({
      embeds: [cuteEmbed({ description: `🤔 Hmm... I choose **${escapeMarkdown(pick(options))}**! :3`, color: 'lavender' })],
    });
  },
};
