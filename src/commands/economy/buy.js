const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { success, oops } = require('../../util/cute');
const { findItem, purchase } = require('../../features/shop');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy something from the shop')
    .addStringOption((o) => o.setName('item').setDescription('What do you want?').setRequired(true).setAutocomplete(true))
    .addIntegerOption((o) => o.setName('amount').setDescription('How many (items only)').setMinValue(1).setMaxValue(100)),

  async execute(interaction) {
    const item = findItem(interaction.guildId, interaction.options.getString('item'));
    if (!item) {
      return interaction.reply({ embeds: [oops("I can't find that in the shop. Check /shop")], flags: MessageFlags.Ephemeral });
    }
    const { ok, message } = await purchase(interaction, item, interaction.options.getInteger('amount') ?? 1);
    await interaction.reply(ok ? { embeds: [success(message)] } : { embeds: [oops(message)], flags: MessageFlags.Ephemeral });
  },

  /** Suggests shop items as you type. */
  async autocomplete(interaction) {
    const typed = interaction.options.getFocused().toLowerCase();
    const items = db
      .shopItems(interaction.guildId)
      .filter((item) => item.name.toLowerCase().includes(typed))
      .slice(0, 25);
    await interaction.respond(
      items.map((item) => ({ name: `${item.emoji} ${item.name} · ${item.price.toLocaleString()}`.slice(0, 100), value: String(item.id) })),
    );
  },
};
