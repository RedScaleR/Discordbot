const { SlashCommandBuilder } = require('discord.js');
const { cuteEmbed } = require('../../util/cute');

module.exports = {
  data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),

  async execute(interaction) {
    const roll = Math.random();
    // A tiny chance the coin lands on its edge :V
    const result = roll < 0.001 ? 'its **EDGE**?! Σ(°△°|||)' : roll < 0.5005 ? '**Heads**! :3' : '**Tails**! :>';
    await interaction.reply({ embeds: [cuteEmbed({ description: `🪙 The coin spins and lands on... ${result}`, color: 'peach' })] });
  },
};
