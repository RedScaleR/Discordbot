const { SlashCommandBuilder, MessageFlags, time, TimestampStyles } = require('discord.js');
const { cuteEmbed, oops, kao } = require('../../util/cute');
const config = require('../../config');
const db = require('../../database');

const DAY = 24 * 60 * 60 * 1000;
const MAX_STREAK_BONUS_DAYS = 7;

module.exports = {
  data: new SlashCommandBuilder().setName('daily').setDescription('Claim your daily coins (keep a streak for bonus coins!)'),

  async execute(interaction) {
    const { dailyAmount, dailyStreakBonus, currency } = config.economy;
    const member = db.getMember(interaction.guildId, interaction.user.id);
    const now = Date.now();
    const nextClaim = member.last_daily_at + DAY;

    if (now < nextClaim) {
      return interaction.reply({
        embeds: [oops(`You already claimed today! Come back ${time(new Date(nextClaim), TimestampStyles.RelativeTime)}`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Claiming within 48 hours of the last one keeps the streak going.
    const streak = now - member.last_daily_at < 2 * DAY ? member.daily_streak + 1 : 1;
    const bonus = (Math.min(streak, MAX_STREAK_BONUS_DAYS) - 1) * dailyStreakBonus;
    const amount = dailyAmount + bonus;
    db.claimDaily(interaction.guildId, interaction.user.id, amount, streak, now);

    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: '🎁 Daily reward!',
          description:
            `You got **${amount.toLocaleString()} ${currency}** ${kao('happy')}\n` +
            `🔥 Streak: **${streak} day${streak === 1 ? '' : 's'}**` +
            (bonus ? ` (+${bonus} bonus)` : '') +
            `\nCome back ${time(new Date(now + DAY), TimestampStyles.RelativeTime)} to keep it going!`,
          color: 'mint',
        }),
      ],
    });
  },
};
