const { SlashCommandBuilder } = require('discord.js');
const { cuteEmbed, kao } = require('../../util/cute');
const { levelFromXp } = require('../../util/levels');
const config = require('../../config');
const db = require('../../database');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('See the top members of the server')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Rank by levels or coins (default: levels)')
        .addChoices({ name: 'Levels', value: 'levels' }, { name: 'Coins', value: 'coins' }),
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type') ?? 'levels';
    const rows = type === 'coins' ? db.topCoins(interaction.guildId) : db.topXp(interaction.guildId);

    const lines = rows.map((row, i) => {
      const place = MEDALS[i] ?? `**${i + 1}.**`;
      const score =
        type === 'coins'
          ? `${row.coins.toLocaleString()} ${config.economy.currency}`
          : `Level ${levelFromXp(row.xp).level} · ${row.xp.toLocaleString()} XP`;
      return `${place} <@${row.user_id}> · ${score}`;
    });

    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: type === 'coins' ? `💰 Richest in ${interaction.guild.name}` : `🏆 Top chatters in ${interaction.guild.name}`,
          description: lines.join('\n') || `Nobody's on the board yet! Start chatting ${kao('happy')}`,
          color: 'peach',
        }),
      ],
      allowedMentions: { parse: [] },
    });
  },
};
