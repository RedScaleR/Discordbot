const { SlashCommandBuilder, MessageFlags, time, TimestampStyles } = require('discord.js');
const { cuteEmbed, success, oops, kao } = require('../../util/cute');
const { currentRound, buyTickets, nextDrawAfter } = require('../../features/lottery');
const { priceText } = require('../../features/shop');
const { record } = require('../../activity');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lottery')
    .setDescription('The weekly lottery: one lucky person wins the whole pot')
    .addSubcommand((sub) =>
      sub
        .setName('buy')
        .setDescription('Buy lottery tickets')
        .addIntegerOption((o) => o.setName('tickets').setDescription('How many tickets (default 1)').setMinValue(1).setMaxValue(100)),
    )
    .addSubcommand((sub) => sub.setName('info').setDescription("See the pot, your tickets and when it's drawn")),

  async execute(interaction) {
    const { guildId, user } = interaction;
    const price = config.economy.lotteryTicketPrice;

    if (interaction.options.getSubcommand() === 'buy') {
      const count = interaction.options.getInteger('tickets') ?? 1;
      const problem = buyTickets(interaction, count);
      if (problem) return interaction.reply({ embeds: [oops(problem)], flags: MessageFlags.Ephemeral });
      record(guildId, 'lottery', `${user.username} bought ${count} lottery ticket${count === 1 ? '' : 's'}`);
      const round = currentRound(guildId);
      return interaction.reply({
        embeds: [
          success(
            `You bought **${count} ticket${count === 1 ? '' : 's'}** for **${priceText(count * price)}**! ` +
              `You have ${db.ticketsOf(guildId, user.id)} now.\n` +
              `The pot is **${priceText(round.pot)}**, drawn ${time(new Date(round.drawAt), TimestampStyles.RelativeTime)}`,
          ),
        ],
      });
    }

    const round = currentRound(guildId);
    if (!round) {
      return interaction.reply({
        embeds: [
          cuteEmbed({
            title: '🎟️ Lottery',
            description:
              `No round running yet! Buy a ticket with \`/lottery buy\` to start one ${kao('happy')}\n` +
              `Tickets cost **${priceText(price)}**. The next draw would be ${time(new Date(nextDrawAfter(Date.now())), TimestampStyles.LongDateTime)}.`,
            color: 'lavender',
          }),
        ],
      });
    }

    const mine = db.ticketsOf(guildId, user.id);
    const chance = mine ? `${Math.round((mine / round.totalTickets) * 1000) / 10}%` : '0%';
    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: '🎟️ Lottery',
          fields: [
            { name: 'Pot', value: `**${priceText(round.pot)}**`, inline: true },
            { name: 'Tickets sold', value: `${round.totalTickets} (${round.players} ${round.players === 1 ? 'person' : 'people'})`, inline: true },
            { name: 'Your tickets', value: `${mine} · ${chance} chance`, inline: true },
            { name: 'Draw', value: `${time(new Date(round.drawAt), TimestampStyles.LongDateTime)} (${time(new Date(round.drawAt), TimestampStyles.RelativeTime)})` },
          ],
          footer: `Tickets cost ${priceText(price)} · /lottery buy`,
          color: 'lavender',
        }),
      ],
    });
  },
};
