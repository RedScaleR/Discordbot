const config = require('../config');
const db = require('../database');
const { selfRoleProblem } = require('../util/moderation');
const { record } = require('../activity');

const KINDS = {
  item: 'Item',
  badge: 'Badge (shows on /profile)',
  role: 'Role',
};

function priceText(amount) {
  return `${amount.toLocaleString()} ${config.economy.currency}`;
}

function stockText(item) {
  if (item.stock === null) return '';
  return item.stock > 0 ? ` · ${item.stock} left` : ' · **sold out**';
}

/** Finds a shop item from what someone typed or picked: an item ID or a name. */
function findItem(guildId, input) {
  const items = db.shopItems(guildId);
  const text = String(input ?? '').trim().toLowerCase();
  return items.find((item) => String(item.id) === text) ?? items.find((item) => item.name.toLowerCase() === text) ?? null;
}

/**
 * Buys an item for the person using the command. Returns { ok, message } where message is
 * what to tell them. Role items also give the role, and refund the coins if that fails.
 */
async function purchase(interaction, item, requested) {
  const { guildId, member, user } = interaction;
  // Badges and roles can only be owned once.
  const quantity = item.kind === 'item' ? requested : 1;
  const owned = db.ownedQuantity(guildId, user.id, item.id);

  let role = null;
  if (item.kind === 'role') {
    role = interaction.guild.roles.cache.get(item.role_id);
    const problem = selfRoleProblem(role);
    if (problem) return { ok: false, message: `This role can't be sold right now (${problem}). Tell an admin!` };
    if (member.roles.cache.has(role.id)) return { ok: false, message: `You already have ${role}` };
  } else if (item.kind === 'badge' && owned > 0) {
    return { ok: false, message: `You already have the **${item.name}** badge` };
  }

  const result = db.buyItem(guildId, user.id, item, quantity);
  if (result === 'coins') {
    const { coins } = db.getMember(guildId, user.id);
    return { ok: false, message: `That costs **${priceText(item.price * quantity)}**, but you only have **${priceText(coins)}**` };
  }
  if (result === 'stock') return { ok: false, message: `Sorry, **${item.name}** is sold out` };

  if (role) {
    try {
      await member.roles.add(role, 'Bought in the Mochi shop');
    } catch (err) {
      db.refundItem(guildId, user.id, item, quantity);
      console.warn(`[shop] Couldn't give ${role.name}: ${err.message}`);
      return { ok: false, message: "I couldn't give you that role, so you got your coins back" };
    }
  }

  record(guildId, 'shop', `${user.username} bought ${quantity > 1 ? `${quantity}× ` : ''}${item.name}`);
  const what = quantity > 1 ? `**${quantity}× ${item.emoji} ${item.name}**` : `**${item.emoji} ${item.name}**`;
  const extra = role ? `\nYou now have ${role}!` : item.kind === 'badge' ? '\nIt shows on your `/profile` now!' : '';
  return { ok: true, message: `You bought ${what} for **${priceText(item.price * quantity)}**!${extra}` };
}

module.exports = { KINDS, priceText, stockText, findItem, purchase };
