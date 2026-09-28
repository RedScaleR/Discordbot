const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { cuteEmbed, oops, shuffle, kao } = require('../../util/cute');
const { placeBet } = require('../../util/bets');
const { priceText } = require('../../features/shop');
const db = require('../../database');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const TIME_LIMIT = 120_000;

const newDeck = () => shuffle(SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit }))));

/** Best total for a hand, counting aces as 11 unless that would bust. */
function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const { rank } of cards) {
    if (rank === 'A') {
      total += 11;
      aces++;
    } else {
      total += ['J', 'Q', 'K'].includes(rank) ? 10 : Number(rank);
    }
  }
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return total;
}

const showHand = (cards, hideSecond = false) =>
  cards.map((card, i) => (hideSecond && i === 1 ? '`??`' : `\`${card.rank}${card.suit}\``)).join(' ');

const isBlackjack = (cards) => cards.length === 2 && handValue(cards) === 21;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play blackjack against Mochi')
    .addIntegerOption((o) => o.setName('bet').setDescription('How many coins to bet').setRequired(true).setMinValue(10)),

  async execute(interaction) {
    let bet = interaction.options.getInteger('bet');
    const problem = placeBet(interaction, bet);
    if (problem) return interaction.reply({ embeds: [oops(problem)], flags: MessageFlags.Ephemeral });

    const deck = newDeck();
    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];
    const { guildId } = interaction;
    const userId = interaction.user.id;

    const view = ({ result, color = 'pink', reveal = false, buttons = [] }) => ({
      embeds: [
        cuteEmbed({
          title: '🃏 Blackjack',
          description: result ?? 'Hit to take a card, stand to keep your hand.',
          fields: [
            { name: `Your hand (${handValue(player)})`, value: showHand(player), inline: true },
            { name: `Mochi's hand (${reveal ? handValue(dealer) : '?'})`, value: showHand(dealer, !reveal), inline: true },
          ],
          footer: `Bet: ${priceText(bet)}`,
          color,
        }),
      ],
      components: buttons.length ? [new ActionRowBuilder().addComponents(buttons)] : [],
    });

    /** Pays out and returns the final screen. `payout` is what goes back into the wallet (bet included). */
    const finish = (text, payout, color) => {
      if (payout) db.addCoins(guildId, userId, payout);
      return view({ result: text, color, reveal: true });
    };

    const settle = () => {
      // Mochi draws until it has at least 17.
      while (handValue(dealer) < 17) dealer.push(deck.pop());
      const mine = handValue(player);
      const theirs = handValue(dealer);
      if (theirs > 21) return finish(`Mochi busts! You win **${priceText(bet * 2)}** ${kao('happy')}`, bet * 2, 'mint');
      if (mine > theirs) return finish(`You win **${priceText(bet * 2)}** ${kao('happy')}`, bet * 2, 'mint');
      if (mine === theirs) return finish(`It's a tie, you get your **${priceText(bet)}** back`, bet, 'lavender');
      return finish(`Mochi wins... you lost **${priceText(bet)}** ${kao('sad')}`, 0, 'red');
    };

    // Natural blackjacks end the game right away.
    if (isBlackjack(player) || isBlackjack(dealer)) {
      if (isBlackjack(player) && isBlackjack(dealer)) return interaction.reply(finish('Both blackjack! You get your bet back', bet, 'lavender'));
      if (isBlackjack(player)) {
        const payout = bet + Math.floor(bet * 1.5);
        return interaction.reply(finish(`BLACKJACK!! You win **${priceText(payout)}** ${kao('shock')}`, payout, 'mint'));
      }
      return interaction.reply(finish(`Mochi has blackjack! You lost **${priceText(bet)}** ${kao('sad')}`, 0, 'red'));
    }

    const buttons = (canDouble) =>
      [
        new ButtonBuilder().setCustomId('bj:hit').setLabel('Hit').setEmoji('🃏').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj:stand').setLabel('Stand').setEmoji('✋').setStyle(ButtonStyle.Secondary),
        canDouble ? new ButtonBuilder().setCustomId('bj:double').setLabel('Double').setEmoji('💰').setStyle(ButtonStyle.Success) : null,
      ].filter(Boolean);

    const response = await interaction.reply(view({ buttons: buttons(true) }));
    const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: TIME_LIMIT });
    let finished = false;

    collector.on('collect', async (click) => {
      if (click.user.id !== userId) {
        return click.reply({ content: "This isn't your game! Start your own with /blackjack :3", flags: MessageFlags.Ephemeral });
      }
      const action = click.customId.split(':')[1];

      if (action === 'double') {
        const doubleProblem = placeBet(interaction, bet);
        if (doubleProblem) return click.reply({ embeds: [oops(doubleProblem)], flags: MessageFlags.Ephemeral });
        bet *= 2;
        player.push(deck.pop());
        finished = true;
        collector.stop();
        const bust = handValue(player) > 21;
        return click.update(bust ? finish(`Bust! You lost **${priceText(bet)}** ${kao('sad')}`, 0, 'red') : settle());
      }

      if (action === 'hit') {
        player.push(deck.pop());
        const total = handValue(player);
        if (total > 21) {
          finished = true;
          collector.stop();
          return click.update(finish(`Bust! You lost **${priceText(bet)}** ${kao('sad')}`, 0, 'red'));
        }
        if (total < 21) return click.update(view({ buttons: buttons(false) }));
      }

      // Standing, or hitting to exactly 21.
      finished = true;
      collector.stop();
      return click.update(settle());
    });

    // Walked away? Mochi stands for you.
    collector.on('end', async () => {
      if (finished) return;
      await interaction.editReply(settle()).catch(() => {});
    });
  },
};

module.exports.handValue = handValue;
