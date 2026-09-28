const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { cuteEmbed, oops, pick, kao } = require('../../util/cute');
const config = require('../../config');
const db = require('../../database');
const { placeBet } = require('../../util/bets');

const SYMBOLS = ['🍡', '🍓', '🍒', '🍋', '⭐', '💎'];

/** How many times the bet you get back for a spin. */
function multiplier([a, b, c]) {
  if (a === b && b === c) return a === '💎' ? 10 : 5;
  if (a === b || b === c || a === c) return 2;
  return 0;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Bet coins on the slot machine')
    .addIntegerOption((o) => o.setName('bet').setDescription('How many coins to bet').setRequired(true).setMinValue(10)),

  async execute(interaction) {
    const bet = interaction.options.getInteger('bet');
    const { currency } = config.economy;

    const problem = placeBet(interaction, bet);
    if (problem) return interaction.reply({ embeds: [oops(problem)], flags: MessageFlags.Ephemeral });

    const reels = [pick(SYMBOLS), pick(SYMBOLS), pick(SYMBOLS)];
    const times = multiplier(reels);
    const winnings = bet * times;
    if (winnings) db.addCoins(interaction.guildId, interaction.user.id, winnings);

    let result;
    if (times >= 10) result = `💎 JACKPOT!!! You won **${winnings.toLocaleString()} ${currency}** ${kao('shock')}`;
    else if (times >= 5) result = `Three in a row! You won **${winnings.toLocaleString()} ${currency}** ${kao('happy')}`;
    else if (times) result = `A pair! You won **${winnings.toLocaleString()} ${currency}** ${kao('happy')}`;
    else result = `No luck this time... you lost **${bet.toLocaleString()} ${currency}** ${kao('sad')}`;

    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: '🎰 Slots',
          description: `**[ ${reels.join(' | ')} ]**\n\n${result}`,
          color: times ? 'mint' : 'red',
        }),
      ],
    });
  },
};
