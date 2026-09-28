const { Events } = require('discord.js');
const { deletedByAutomod } = require('../features/automod');
const { sendLog } = require('../util/logger');
const { truncate } = require('../util/cute');

module.exports = {
  name: Events.MessageDelete,

  async execute(message) {
    if (message.partial || !message.inGuild() || message.author.bot) return;
    if (deletedByAutomod.has(message.id)) return;

    const attachments = message.attachments.map((file) => file.name).join(', ');
    await sendLog(message.guild, {
      title: '🗑️ Message deleted',
      color: 'red',
      description: `${message.author} in ${message.channel}`,
      fields: [
        { name: 'Message', value: truncate(message.content || '*(no text)*') },
        ...(attachments ? [{ name: 'Attachments', value: truncate(attachments) }] : []),
      ],
      footer: `User ID: ${message.author.id}`,
    });
  },
};
