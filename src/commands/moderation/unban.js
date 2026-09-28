const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, RESTJSONErrorCodes } = require('discord.js');
const { success, oops, bold } = require('../../util/cute');
const { auditReason } = require('../../util/moderation');
const { logModAction, expectEvent } = require('../../util/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban someone')
    .addStringOption((o) =>
      o.setName('user_id').setDescription('Their user ID (right-click them → Copy User ID)').setRequired(true),
    )
    .addStringOption((o) => o.setName('reason').setDescription('Why are they being unbanned?').setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id').trim();
    const reason = interaction.options.getString('reason') ?? 'No reason given';

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ embeds: [oops("That doesn't look like a user ID")], flags: MessageFlags.Ephemeral });
    }

    try {
      expectEvent(`unban:${interaction.guildId}:${userId}`);
      const user = await interaction.guild.members.unban(userId, auditReason(interaction, reason));
      await interaction.reply({ embeds: [success(`${bold(user)} has been unbanned. Welcome back!`)] });
      await logModAction(interaction.guild, { action: 'Unban', emoji: '🕊️', target: user, moderator: interaction.user, reason });
    } catch (err) {
      if (err.code !== RESTJSONErrorCodes.UnknownBan) throw err;
      await interaction.reply({ embeds: [oops("That person isn't banned")], flags: MessageFlags.Ephemeral });
    }
  },
};
