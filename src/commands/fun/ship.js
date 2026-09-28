const { SlashCommandBuilder, escapeMarkdown } = require('discord.js');
const { cuteEmbed } = require('../../util/cute');
const { progressBar } = require('../../util/levels');
const { stableNumber } = require('../../util/random');

function verdict(percent) {
  if (percent >= 90) return 'Soulmates!! (´｡• ᵕ •｡`) ♡';
  if (percent >= 70) return 'Ooh, a great match! (≧◡≦) ♡';
  if (percent >= 50) return 'There might be something there :3';
  if (percent >= 30) return 'Maybe just friends? :>';
  if (percent >= 10) return 'Hmm... not looking great (・・?)';
  return 'Absolutely not :V';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('Check how compatible two people are')
    .addUserOption((o) => o.setName('first').setDescription('First person').setRequired(true))
    .addUserOption((o) => o.setName('second').setDescription('Second person (defaults to you)')),

  async execute(interaction) {
    const first = interaction.options.getUser('first');
    const second = interaction.options.getUser('second') ?? interaction.user;

    // Same pair always gets the same score, no rerolling for a better one :3
    const percent = first.id === second.id ? 100 : stableNumber([first.id, second.id].sort().join(':'), 101);
    const shipName =
      first.username.slice(0, Math.ceil(first.username.length / 2)) + second.username.slice(Math.floor(second.username.length / 2));

    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: `💘 ${escapeMarkdown(shipName)}`,
          description: `${first} + ${second}\n\n${progressBar(percent, 100)} **${percent}%**\n${first.id === second.id ? 'Self-love is the best love! (✿◠‿◠)' : verdict(percent)}`,
        }),
      ],
    });
  },
};
