const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, time, TimestampStyles } = require('discord.js');
const { cuteEmbed, success, oops, bold, truncate, kao } = require('../../util/cute');
const { logModAction } = require('../../util/logger');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('See or remove warnings')
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription("See someone's warnings")
        .addUserOption((o) => o.setName('user').setDescription('Whose warnings?').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove one warning by its number')
        .addIntegerOption((o) => o.setName('id').setDescription('The warning number (see /warnings list)').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription("Clear all of someone's warnings")
        .addUserOption((o) => o.setName('user').setDescription('Whose warnings?').setRequired(true)),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const user = interaction.options.getUser('user');
      const warnings = db.listWarnings(interaction.guildId, user.id);
      if (!warnings.length) {
        return interaction.reply({ embeds: [success(`${bold(user)} has no warnings. A perfect angel`)], flags: MessageFlags.Ephemeral });
      }

      const lines = warnings.map(
        (w) => `**#${w.id}** · ${time(new Date(w.created_at), TimestampStyles.ShortDate)} by <@${w.moderator_id}>\n${w.reason}`,
      );
      const embed = cuteEmbed({
        title: `⚠️ Warnings for ${user.username} (${warnings.length})`,
        description: truncate(lines.join('\n\n'), 4000),
        color: 'peach',
        thumbnail: user.displayAvatarURL(),
      });
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (subcommand === 'remove') {
      const id = interaction.options.getInteger('id');
      if (!db.deleteWarning(interaction.guildId, id)) {
        return interaction.reply({ embeds: [oops(`There's no warning #${id}`)], flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ embeds: [success(`Warning #${id} is gone ${kao('love')}`)] });
    }

    const user = interaction.options.getUser('user');
    const removed = db.clearWarnings(interaction.guildId, user.id);
    await interaction.reply({ embeds: [success(`Cleared **${removed}** warning${removed === 1 ? '' : 's'} for ${bold(user)}. Fresh start!`)] });
    if (removed) {
      await logModAction(interaction.guild, {
        action: 'Warnings cleared',
        emoji: '🧽',
        target: user,
        moderator: interaction.user,
        reason: `Removed ${removed} warning${removed === 1 ? '' : 's'}`,
      });
    }
  },
};
