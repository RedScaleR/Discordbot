const { Events, AuditLogEvent } = require('discord.js');
const { sendLog, wasExpected, findAuditEntry } = require('../util/logger');
const { record } = require('../activity');

module.exports = {
  name: Events.GuildBanRemove,

  async execute(ban) {
    // Unbans done with /unban were already logged by the command.
    if (wasExpected(`unban:${ban.guild.id}:${ban.user.id}`)) return;

    const entry = await findAuditEntry(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    record(ban.guild.id, 'mod', `${ban.user.username} was unbanned${entry?.executor ? ` by ${entry.executor.username}` : ''}`);
    await sendLog(ban.guild, {
      title: '🕊️ Member unbanned',
      color: 'mint',
      fields: [
        { name: 'User', value: `${ban.user} (${ban.user.id})`, inline: true },
        { name: 'Moderator', value: entry?.executor ? `${entry.executor}` : 'Unknown', inline: true },
      ],
    });
  },
};
