const { Events, AuditLogEvent } = require('discord.js');
const { sendLog, wasExpected, findAuditEntry } = require('../util/logger');

module.exports = {
  name: Events.GuildBanAdd,

  async execute(ban) {
    // Bans done with /ban were already logged by the command.
    if (wasExpected(`ban:${ban.guild.id}:${ban.user.id}`)) return;

    const entry = await findAuditEntry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    await sendLog(ban.guild, {
      title: '🔨 Member banned',
      color: 'red',
      fields: [
        { name: 'User', value: `${ban.user} (${ban.user.id})`, inline: true },
        { name: 'Moderator', value: entry?.executor ? `${entry.executor}` : 'Unknown', inline: true },
        { name: 'Reason', value: entry?.reason ?? ban.reason ?? 'No reason given' },
      ],
    });
  },
};
