const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  time,
  TimestampStyles,
} = require('discord.js');
const { cuteEmbed, pick, shuffle, kao } = require('../../util/cute');
const config = require('../../config');
const db = require('../../database');
const QUESTIONS = require('../../data/trivia');

const TIME_LIMIT = 20_000;
const LETTERS = ['A', 'B', 'C', 'D'];

function answerButtons(answers, { reveal = null } = {}) {
  return new ActionRowBuilder().addComponents(
    answers.map((answer, i) => {
      const button = new ButtonBuilder().setCustomId(`trivia:${i}`).setLabel(`${LETTERS[i]}. ${answer}`);
      if (reveal === null) return button.setStyle(ButtonStyle.Primary);
      return button.setStyle(answer === reveal ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(true);
    }),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Answer a trivia question! First correct answer wins coins'),

  async execute(interaction) {
    const { question, correct, wrong } = pick(QUESTIONS);
    const answers = shuffle([correct, ...wrong]);
    const { triviaReward: reward, currency } = config.economy;
    const endsAt = new Date(Date.now() + TIME_LIMIT);

    const response = await interaction.reply({
      embeds: [
        cuteEmbed({
          title: '🧠 Trivia time!',
          description: `**${question}**\n\nFirst correct answer wins **${reward} ${currency}**! One guess each.\nTime runs out ${time(endsAt, TimestampStyles.RelativeTime)}`,
          color: 'sky',
        }),
      ],
      components: [answerButtons(answers)],
    });

    const guessed = new Set();
    let winner = null;
    const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: TIME_LIMIT });

    collector.on('collect', async (click) => {
      if (guessed.has(click.user.id)) {
        return click.reply({ content: 'You already guessed! No take-backsies :3', flags: MessageFlags.Ephemeral });
      }
      guessed.add(click.user.id);

      const choice = answers[Number(click.customId.split(':')[1])];
      if (choice !== correct) {
        return click.reply({ content: `Nope, it's not **${choice}** ${kao('sad')}`, flags: MessageFlags.Ephemeral });
      }

      winner = click.user;
      db.addCoins(interaction.guildId, winner.id, reward);
      await click.deferUpdate();
      collector.stop('won');
    });

    collector.on('end', async () => {
      const result = winner
        ? `${winner} got it first and wins **${reward} ${currency}**! ${kao('happy')}`
        : `Time's up! Nobody got it ${kao('sad')}`;
      await interaction
        .editReply({
          embeds: [
            cuteEmbed({
              title: '🧠 Trivia time!',
              description: `**${question}**\n\nThe answer was **${correct}**.\n${result}`,
              color: winner ? 'mint' : 'peach',
            }),
          ],
          components: [answerButtons(answers, { reveal: correct })],
        })
        .catch(() => {});
    });
  },
};
