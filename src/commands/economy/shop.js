const { SlashCommandBuilder } = require('discord.js');
const { cuteEmbed, truncate, kao } = require('../../util/cute');
const { KINDS, priceText, stockText } = require('../../features/shop');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('shop').setDescription('See what you can buy with your coins'),

  async execute(interaction) {
    const items = db.shopItems(interaction.guildId);
    const { coins } = db.getMember(interaction.guildId, interaction.user.id);

    const description = items.length
      ? items
          .map(
            (item) =>
              `${item.emoji} **${item.name}** · ${priceText(item.price)}${stockText(item)}\n` +
              `-# ${KINDS[item.kind]}${item.description ? ` · ${item.description}` : ''}`,
          )
          .join('\n')
      : `The shop is empty right now ${kao('sad')}\nAdmins can add things in the dashboard's **Shop** tab.`;

    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: '🛍️ Mochi Shop',
          description: truncate(description, 4000),
          footer: `You have ${priceText(coins)} · Buy with /buy`,
          color: 'peach',
        }),
      ],
    });
  },
};
