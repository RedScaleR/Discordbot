const config = require('../config');
const db = require('../database');

/**
 * Takes a bet from someone's wallet. Returns null if it worked,
 * or a friendly reason if it didn't (over the limit, or not enough coins).
 */
function placeBet(interaction, bet) {
  const { maxBet, currency } = config.economy;
  if (maxBet > 0 && bet > maxBet) return `The biggest bet allowed is **${maxBet.toLocaleString()} ${currency}**`;
  if (db.takeCoins(interaction.guildId, interaction.user.id, bet)) return null;
  const { coins } = db.getMember(interaction.guildId, interaction.user.id);
  return `You only have **${coins.toLocaleString()} ${currency}** to bet`;
}

module.exports = { placeBet };
