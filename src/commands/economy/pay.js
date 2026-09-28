const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { success, oops, bold } = require('../../util/cute');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Give some of your coins to someone')
    .addUserOption((o) => o.setName('user').setDescription('Who gets the coins?').setRequired(true))
    .addIntegerOption((o) => o.setName('amount').setDescription('How many coins?').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const { currency } = config.economy;

    if (user.id === interaction.user.id) {
      return interaction.reply({ embeds: [oops("You can't pay yourself, silly")], flags: MessageFlags.Ephemeral });
    }
    if (user.bot) return interaction.reply({ embeds: [oops("Bots don't need coins")], flags: MessageFlags.Ephemeral });

    if (!db.transferCoins(interaction.guildId, interaction.user.id, user.id, amount)) {
      const { coins } = db.getMember(interaction.guildId, interaction.user.id);
      return interaction.reply({
        embeds: [oops(`You only have **${coins.toLocaleString()} ${currency}**`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({ embeds: [success(`You gave ${bold(user)} **${amount.toLocaleString()} ${currency}**. So generous`)] });
  },
};
