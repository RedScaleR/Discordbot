const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { success, oops, bold } = require('../../util/cute');
const { auditReason, MISSING_PERMS_HINT } = require('../../util/moderation');
const { logModAction } = require('../../util/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription("Take someone out of timeout early")
    .addUserOption((o) => o.setName('user').setDescription('Who to free').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Why?').setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason given';

    if (!member) return interaction.reply({ embeds: [oops("They're not in the server")], flags: MessageFlags.Ephemeral });
    if (!member.isCommunicationDisabled()) {
      return interaction.reply({ embeds: [oops("They're not in timeout")], flags: MessageFlags.Ephemeral });
    }
    if (!member.moderatable) return interaction.reply({ embeds: [oops(MISSING_PERMS_HINT)], flags: MessageFlags.Ephemeral });

    await member.timeout(null, auditReason(interaction, reason));
    await interaction.reply({ embeds: [success(`${bold(member.user)} is free! Be good now`)] });
    await logModAction(interaction.guild, { action: 'Timeout removed', emoji: '🔓', target: member.user, moderator: interaction.user, reason });
  },
};
