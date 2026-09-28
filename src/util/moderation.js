const { PermissionFlagsBits } = require('discord.js');

/**
 * Checks whether the person running a command is allowed to use `action` on `target`.
 * Returns a friendly error message, or null if everything's fine.
 */
function checkHierarchy(interaction, target, action) {
  const { guild, member: moderator, client } = interaction;

  if (target.id === moderator.id) return `You can't ${action} yourself, silly`;
  if (target.id === client.user.id) return `H-hey! You can't ${action} me`;
  if (target.id === guild.ownerId) return `That's the server owner, I can't ${action} them`;
  if (moderator.id !== guild.ownerId && target.roles.highest.position >= moderator.roles.highest.position) {
    return `${target} has a role that's equal to or higher than yours`;
  }
  return null;
}

// Roles with any of these permissions are too powerful to hand out with a button.
const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.ManageGuildExpressions,
  PermissionFlagsBits.ManageEvents,
  PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.MentionEveryone,
  PermissionFlagsBits.ViewAuditLog,
  PermissionFlagsBits.MuteMembers,
  PermissionFlagsBits.DeafenMembers,
  PermissionFlagsBits.MoveMembers,
];

/** Returns why a role can't be self-assigned, or null if it's safe. */
function selfRoleProblem(role) {
  if (!role) return "That role doesn't exist anymore";
  if (role.id === role.guild.id) return "@everyone can't be a button role";
  if (role.managed) return `${role} is managed by an integration or bot`;
  if (!role.editable) return `${role} is above my highest role, so I can't give it out`;
  if (DANGEROUS_PERMISSIONS.some((perm) => role.permissions.has(perm, false))) {
    return `${role} has moderator/admin permissions, which is too dangerous to hand out`;
  }
  return null;
}

/** Reason shown in Discord's audit log, so it's clear who used the bot. */
const auditReason = (interaction, reason) => `${reason} (by ${interaction.user.username})`;

const MISSING_PERMS_HINT = 'My role is too low to do that! Drag my role higher in Server Settings → Roles';

module.exports = { checkHierarchy, selfRoleProblem, auditReason, MISSING_PERMS_HINT };
