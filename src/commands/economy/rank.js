const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { cuteEmbed, oops } = require('../../util/cute');
const { levelFromXp, progressBar } = require('../../util/levels');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('See your level and XP (you earn XP by chatting!)')
    .addUserOption((o) => o.setName('user').setDescription('Whose rank? (defaults to you)')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    if (user.bot) return interaction.reply({ embeds: [oops("Bots don't level up")], flags: MessageFlags.Ephemeral });

    const { xp } = db.getMember(interaction.guildId, user.id);
    const { level, current, needed } = levelFromXp(xp);
    const rank = db.xpRank(interaction.guildId, xp);

    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: `✨ ${user.displayName}'s rank`,
          description: `${progressBar(current, needed)} ${current.toLocaleString()} / ${needed.toLocaleString()} XP`,
          fields: [
            { name: 'Level', value: `**${level}**`, inline: true },
            { name: 'Rank', value: xp ? `**#${rank}**` : 'unranked', inline: true },
            { name: 'Total XP', value: xp.toLocaleString(), inline: true },
          ],
          thumbnail: user.displayAvatarURL(),
          color: 'lavender',
        }),
      ],
    });
  },
};
