const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { cuteEmbed, success, oops, bold } = require('../../util/cute');
const { checkHierarchy, auditReason, MISSING_PERMS_HINT } = require('../../util/moderation');
const { logModAction } = require('../../util/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick someone from the server')
    .addUserOption((o) => o.setName('user').setDescription('Who to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Why are they being kicked?').setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason given';

    if (!member) return interaction.reply({ embeds: [oops("They're not in the server")], flags: MessageFlags.Ephemeral });
    const problem = checkHierarchy(interaction, member, 'kick');
    if (problem) return interaction.reply({ embeds: [oops(problem)], flags: MessageFlags.Ephemeral });
    if (!member.kickable) return interaction.reply({ embeds: [oops(MISSING_PERMS_HINT)], flags: MessageFlags.Ephemeral });

    await member
      .send({ embeds: [cuteEmbed({ color: 'red', description: `You were kicked from **${interaction.guild.name}**.\n**Reason:** ${reason}` })] })
      .catch(() => {});
    await member.kick(auditReason(interaction, reason));

    await interaction.reply({ embeds: [success(`${bold(member.user)} has been kicked. Yeet!`)] });
    await logModAction(interaction.guild, { action: 'Kick', emoji: '👢', target: member.user, moderator: interaction.user, reason });
  },
};
