const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { oops } = require('../../util/cute');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Start a poll')
    .addStringOption((o) => o.setName('question').setDescription('What are you asking?').setRequired(true).setMaxLength(300))
    .addStringOption((o) =>
      o.setName('answers').setDescription('Answers separated by | like: Pizza | Sushi | Tacos (2 to 10)').setRequired(true),
    )
    .addIntegerOption((o) =>
      o.setName('hours').setDescription('How long the poll runs (default 24 hours, max 768)').setMinValue(1).setMaxValue(768),
    )
    .addBooleanOption((o) => o.setName('multiple').setDescription('Let people pick more than one answer?')),

  async execute(interaction) {
    const answers = interaction.options
      .getString('answers')
      .split('|')
      .map((answer) => answer.trim())
      .filter(Boolean);

    if (answers.length < 2 || answers.length > 10) {
      return interaction.reply({
        embeds: [oops('Give me 2 to 10 answers separated by `|`, like `Pizza | Sushi | Tacos`')],
        flags: MessageFlags.Ephemeral,
      });
    }
    if (answers.some((answer) => answer.length > 55)) {
      return interaction.reply({ embeds: [oops('Each answer can be 55 characters at most')], flags: MessageFlags.Ephemeral });
    }

    await interaction.reply({
      poll: {
        question: { text: interaction.options.getString('question') },
        answers: answers.map((text) => ({ text })),
        duration: interaction.options.getInteger('hours') ?? 24,
        allowMultiselect: interaction.options.getBoolean('multiple') ?? false,
      },
    });
  },
};
