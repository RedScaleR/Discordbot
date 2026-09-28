const { Events, ActivityType, OAuth2Scopes, PermissionFlagsBits } = require('discord.js');
const { registerCommands } = require('../commandLoader');
const { startReminders } = require('../features/reminders');
const { startLottery } = require('../features/lottery');
const { version } = require('../../package.json');

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
    console.log(`\n  Mochi v${version} is awake! Logged in as ${client.user.tag} (◕‿◕)\n`);
    console.log(`  Invite me to your server with this link:`);
    console.log(`  ${client.generateInvite({ scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands], permissions: INVITE_PERMISSIONS })}\n`);

    client.user.setPresence({ activities: [{ name: 'Mochi', state: 'being cute in chat :3', type: ActivityType.Custom }] });

    console.log(`  Your dashboard: http://localhost:${client.dashboardPort}  (open it in your browser)\n`);

    if (!client.guilds.cache.size) console.log("  I'm not in any servers yet! Use the link above to add me :3\n");
    for (const guild of client.guilds.cache.values()) {
      await registerCommands(guild, client.commands);
      // Load everyone once so the dashboard can show names. Mochi keeps the list updated after this.
      await guild.members.fetch().catch((err) => console.warn(`[members] Couldn't load members of "${guild.name}": ${err.message}`));
    }

    startReminders(client);
    startLottery(client);
  },
};
