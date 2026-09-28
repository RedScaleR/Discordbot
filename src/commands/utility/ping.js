const { SlashCommandBuilder } = require('discord.js');
const { cuteEmbed } = require('../../util/cute');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription("Check if Mochi's awake"),

  async execute(interaction) {
    const started = Date.now();
    await interaction.deferReply();
    const roundTrip = Date.now() - started;
    const ws = interaction.client.ws.ping;

    await interaction.editReply({
      embeds: [
        cuteEmbed({
          description: `🏓 Pong! :3\nRound trip: **${roundTrip}ms** · Heartbeat: **${ws >= 0 ? `${ws}ms` : 'measuring…'}**`,
          color: 'mint',
        }),
      ],
    });
  },
};
