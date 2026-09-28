const { SlashCommandBuilder } = require('discord.js');
const { cuteEmbed, bold, kao } = require('../../util/cute');
const { priceText } = require('../../features/shop');
const db = require('../../database');

const SECTIONS = [
  ['badge', '🏅 Badges'],
  ['role', '🎭 Roles'],
  ['item', '🎒 Items'],
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('See what you (or someone else) own')
    .addUserOption((o) => o.setName('user').setDescription('Whose stuff? (defaults to you)')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const owned = db.inventory(interaction.guildId, user.id);
    const { coins } = db.getMember(interaction.guildId, user.id);

    const fields = SECTIONS.map(([kind, title]) => {
      const lines = owned
        .filter((item) => item.kind === kind)
        .map((item) => `${item.emoji} ${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`);
      return { name: title, value: lines.join('\n'), inline: true };
    }).filter((field) => field.value);

    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: `🎒 ${user.displayName}'s inventory`,
          description: `${bold(user)} has **${priceText(coins)}**` + (fields.length ? '' : `\nNothing else yet! Check out /shop ${kao('happy')}`),
          fields,
          thumbnail: user.displayAvatarURL(),
          color: 'peach',
        }),
      ],
    });
  },
};
