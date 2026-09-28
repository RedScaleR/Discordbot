const config = require('../config');
const db = require('../database');
const { cuteEmbed, kao } = require('../util/cute');
const { record } = require('../activity');

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** The first draw time (set day and hour, in the PC's local time) after `time`. */
function nextDrawAfter(time) {
  const { lotteryDrawDay, lotteryDrawHour } = config.economy;
  const date = new Date(time);
  date.setHours(lotteryDrawHour, 0, 0, 0);
  date.setDate(date.getDate() + ((DAYS.indexOf(lotteryDrawDay) - date.getDay() + 7) % 7));
  if (date.getTime() <= time) date.setDate(date.getDate() + 7);
  return date.getTime();
}

/** Everything about the current round, or null if nobody has bought a ticket yet. */
function currentRound(guildId) {
  const since = db.getMeta(guildId, 'lottery.since');
  if (!since) return null;
  const tickets = db.allTickets(guildId);
  return {
    pot: Number(db.getMeta(guildId, 'lottery.pot') ?? 0),
    totalTickets: tickets.reduce((sum, row) => sum + row.tickets, 0),
    players: tickets.length,
    drawAt: nextDrawAfter(Number(since)),
  };
}

/** Buys tickets. Returns an error message, or null if it worked. */
function buyTickets(interaction, count) {
  const { guildId, user } = interaction;
  const cost = count * config.economy.lotteryTicketPrice;
  return db.transaction(() => {
    if (!db.takeCoins(guildId, user.id, cost)) {
      const { coins } = db.getMember(guildId, user.id);
      return `${count} ticket${count === 1 ? '' : 's'} cost **${cost.toLocaleString()} ${config.economy.currency}**, but you only have **${coins.toLocaleString()}**`;
    }
    if (!db.getMeta(guildId, 'lottery.since')) {
      db.setMeta(guildId, 'lottery.since', Date.now());
      db.setMeta(guildId, 'lottery.channel', interaction.channelId);
    }
    db.setMeta(guildId, 'lottery.pot', Number(db.getMeta(guildId, 'lottery.pot') ?? 0) + cost);
    db.addTickets(guildId, user.id, count);
    return null;
  });
}

/** Picks a winner (more tickets, better odds), pays out the pot and announces it. */
async function draw(client, guildId) {
  const tickets = db.allTickets(guildId);
  const pot = Number(db.getMeta(guildId, 'lottery.pot') ?? 0);
  const channelId = config.economy.lotteryChannelId || db.getMeta(guildId, 'lottery.channel');
  const total = tickets.reduce((sum, row) => sum + row.tickets, 0);

  let winner = null;
  let roll = Math.random() * total;
  for (const row of tickets) {
    roll -= row.tickets;
    if (roll < 0) {
      winner = row;
      break;
    }
  }
  winner ??= tickets[tickets.length - 1];

  db.transaction(() => {
    if (winner && pot) db.addCoins(guildId, winner.user_id, pot);
    db.clearTickets(guildId);
    for (const key of ['lottery.since', 'lottery.pot', 'lottery.channel']) db.deleteMeta(guildId, key);
  });
  if (!winner) return;

  const guild = client.guilds.cache.get(guildId);
  const user = await client.users.fetch(winner.user_id).catch(() => null);
  record(guildId, 'lottery', `${user?.username ?? 'Someone'} won the lottery: ${pot.toLocaleString()} coins`);

  const channel = guild?.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return;
  const chance = Math.round((winner.tickets / total) * 1000) / 10;
  await channel
    .send({
      content: `<@${winner.user_id}>`,
      embeds: [
        cuteEmbed({
          title: '🎟️ Lottery results!',
          description:
            `<@${winner.user_id}> won the pot of **${pot.toLocaleString()} ${config.economy.currency}** ${kao('shock')}\n` +
            `They had ${winner.tickets} of ${total} tickets (a ${chance}% chance). A new round starts with the next ticket!`,
          color: 'mint',
        }),
      ],
      allowedMentions: { users: [winner.user_id] },
    })
    .catch((err) => console.warn(`[lottery] Couldn't announce the winner: ${err.message}`));
}

/** Checks every minute for rounds that are due (including ones missed while Mochi was off). */
function startLottery(client) {
  const tick = async () => {
    for (const { guild_id: guildId, value } of db.lotteryRounds()) {
      if (Date.now() >= nextDrawAfter(Number(value))) {
        await draw(client, guildId).catch((err) => console.error('[lottery]', err));
      }
    }
  };
  tick();
  setInterval(tick, 60_000);
}

module.exports = { nextDrawAfter, currentRound, buyTickets, draw, startLottery };
