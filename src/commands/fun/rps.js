const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { cuteEmbed, pick } = require('../../util/cute');

const MOVES = {
  rock: { emoji: '🪨', beats: 'scissors' },
  paper: { emoji: '📄', beats: 'rock' },
  scissors: { emoji: '✂️', beats: 'paper' },
};

module.exports = {
  data: new SlashCommandBuilder().setName('rps').setDescription('Play rock paper scissors against Mochi'),

  async execute(interaction) {
    const row = new ActionRowBuilder().addComponents(
      Object.entries(MOVES).map(([move, { emoji }]) =>
        new ButtonBuilder()
          .setCustomId(`rps:${move}`)
          .setLabel(move[0].toUpperCase() + move.slice(1))
          .setEmoji(emoji)
          .setStyle(ButtonStyle.Primary),
      ),
    );

    const response = await interaction.reply({
      embeds: [cuteEmbed({ description: 'Rock, paper, scissors... pick one! (ง •̀\\_•́)ง' })],
      components: [row],
    });

    const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30_000 });

    collector.on('collect', async (click) => {
      if (click.user.id !== interaction.user.id) {
        return click.reply({ content: "This isn't your game! Start your own with /rps :3", flags: MessageFlags.Ephemeral });
      }
      collector.stop('played');

      const yours = click.customId.split(':')[1];
      const mine = pick(Object.keys(MOVES));
      let outcome;
      if (yours === mine) outcome = "It's a tie! Great minds think alike \\*.\\*";
      else if (MOVES[yours].beats === mine) outcome = 'You win! Nooo (╥﹏╥)';
      else outcome = 'I win! Hehe (≧◡≦)';

      await click.update({
        embeds: [
          cuteEmbed({
            description: `You picked ${MOVES[yours].emoji} **${yours}**\nI picked ${MOVES[mine].emoji} **${mine}**\n\n${outcome}`,
            color: 'mint',
          }),
        ],
        components: [],
      });
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'played') return;
      await interaction
        .editReply({ embeds: [cuteEmbed({ description: 'Too slow! I win by default :V', color: 'peach' })], components: [] })
        .catch(() => {});
    });
  },
};
