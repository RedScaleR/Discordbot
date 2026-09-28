const { Events } = require('discord.js');
const { runAutomod } = require('../features/automod');
const { sendLog } = require('../util/logger');
const { truncate } = require('../util/cute');

module.exports = {
  name: Events.MessageUpdate,

  async execute(before, after) {
    // Messages sent before Mochi started aren't cached, so there's no "before" to compare.
    if (before.partial || !after.inGuild() || after.author.bot) return;
    // Embeds loading in also fire this event, so only care about real text changes.
    if (before.content === after.content) return;

    // No sneaking banned words in with an edit :V
    if (await runAutomod(after, { edited: true })) return;

    await sendLog(after.guild, {
      title: '✏️ Message edited',
      description: `${after.author} in ${after.channel} · [jump to message](${after.url})`,
      fields: [
        { name: 'Before', value: truncate(before.content) },
        { name: 'After', value: truncate(after.content) },
      ],
      footer: `User ID: ${after.author.id}`,
    });
  },
};
