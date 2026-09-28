const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { oops } = require('../../util/cute');
const { levelFromXp } = require('../../util/levels');
const { renderProfileCard } = require('../../features/profileCard');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show off your profile card')
    .addUserOption((o) => o.setName('user').setDescription('Whose profile? (defaults to you)')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    if (user.bot) return interaction.reply({ embeds: [oops("Bots don't have profiles")], flags: MessageFlags.Ephemeral });
    const member = interaction.options.getMember('user') ?? (user.id === interaction.user.id ? interaction.member : null);

    // Drawing the card takes a moment.
    await interaction.deferReply();
    const stats = db.getMember(interaction.guildId, user.id);
    const { level, current, needed } = levelFromXp(stats.xp);
    const badges = db
      .inventory(interaction.guildId, user.id)
      .filter((item) => item.kind === 'badge')
      .map((item) => ({ emoji: item.emoji, name: item.name }));

    const png = await renderProfileCard({
      name: member?.displayName ?? user.displayName,
      username: user.username,
      avatarUrl: (member ?? user).displayAvatarURL({ extension: 'png', size: 256 }),
      level,
      current,
      needed,
      rank: stats.xp ? db.xpRank(interaction.guildId, stats.xp) : null,
      coins: stats.coins,
      currency: config.economy.currency,
      // A streak only counts while it's still alive (claimed within the last 2 days).
      streak: Date.now() - stats.last_daily_at < 2 * 24 * 60 * 60 * 1000 ? stats.daily_streak : 0,
      badges,
    });
    await interaction.editReply({ files: [new AttachmentBuilder(png, { name: 'profile.png' })] });
  },
};
