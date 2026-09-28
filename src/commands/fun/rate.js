const { SlashCommandBuilder, escapeMarkdown } = require('discord.js');
const { cuteEmbed } = require('../../util/cute');
const { stableNumber } = require('../../util/random');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rate')
    .setDescription('Mochi rates anything out of 10')
    .addStringOption((o) => o.setName('thing').setDescription('What should I rate?').setRequired(true).setMaxLength(100)),

  async execute(interaction) {
    const thing = interaction.options.getString('thing');
    const key = thing.trim().toLowerCase();
    const score = key === 'mochi' ? 11 : stableNumber(key, 11);
    const reaction = score === 11 ? 'obviously (≧◡≦)' : score >= 8 ? 'love it! ♡' : score >= 5 ? 'pretty good :>' : score >= 2 ? 'meh :<' : 'yikes :V';

    await interaction.reply({
      embeds: [cuteEmbed({ description: `⭐ I rate **${escapeMarkdown(thing)}** a **${score}/10**, ${reaction}` })],
    });
  },
};
