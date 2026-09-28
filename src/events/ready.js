const { Events, ActivityType, OAuth2Scopes, PermissionFlagsBits } = require('discord.js');
const { registerCommands } = require('../commandLoader');
const { startReminders } = require('../features/reminders');

const INVITE_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.SendPolls,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ViewAuditLog,
];

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    console.log(`\n  Mochi is awake! Logged in as ${client.user.tag} (◕‿◕)\n`);
    console.log(`  Invite me to your server with this link:`);
    console.log(`  ${client.generateInvite({ scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands], permissions: INVITE_PERMISSIONS })}\n`);

    client.user.setPresence({ activities: [{ name: 'Mochi', state: 'being cute in chat :3', type: ActivityType.Custom }] });

    if (!client.guilds.cache.size) console.log("  I'm not in any servers yet! Use the link above to add me :3\n");
    for (const guild of client.guilds.cache.values()) await registerCommands(guild, client.commands);

    startReminders(client);
  },
};
