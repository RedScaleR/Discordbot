const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { cuteEmbed, oops, kao } = require('../../util/cute');
const { placeBet } = require('../../util/bets');
const { priceText } = require('../../features/shop');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin, and bet on it if you like')
    .addStringOption((o) =>
      o
        .setName('call')
        .setDescription('Heads or tails?')
        .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' }),
    )
    .addIntegerOption((o) => o.setName('bet').setDescription('Coins to bet (you need to pick heads or tails)').setMinValue(1)),

  async execute(interaction) {
    const call = interaction.options.getString('call');
    const bet = interaction.options.getInteger('bet');

    if (bet && !call) {
      return interaction.reply({ embeds: [oops('Pick heads or tails to bet on!')], flags: MessageFlags.Ephemeral });
    }
    if (bet) {
      const problem = placeBet(interaction, bet);
      if (problem) return interaction.reply({ embeds: [oops(problem)], flags: MessageFlags.Ephemeral });
    }

    const roll = Math.random();
    // A tiny chance the coin lands on its edge :V
    const side = roll < 0.001 ? 'edge' : roll < 0.5005 ? 'heads' : 'tails';
    const landed = { edge: 'its **EDGE**?! Σ(°△°|||)', heads: '**Heads**! :3', tails: '**Tails**! :>' }[side];

    let outcome = '';
    if (side === 'edge') {
      if (bet) db.addCoins(interaction.guildId, interaction.user.id, bet);
      outcome = bet ? `\nNobody saw that coming, so you get your **${priceText(bet)}** back` : '';
    } else if (call && side === call) {
      if (bet) db.addCoins(interaction.guildId, interaction.user.id, bet * 2);
      outcome = bet ? `\nYou called it and won **${priceText(bet * 2)}**! ${kao('happy')}` : `\nYou called it! ${kao('happy')}`;
    } else if (call) {
      outcome = bet ? `\nWrong call... you lost **${priceText(bet)}** ${kao('sad')}` : `\nWrong call ${kao('sad')}`;
    }

    await interaction.reply({
      embeds: [cuteEmbed({ description: `🪙 The coin spins and lands on... ${landed}${outcome}`, color: call && side === call ? 'mint' : 'peach' })],
    });
  },
};
