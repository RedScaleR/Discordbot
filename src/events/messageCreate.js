const { Events } = require('discord.js');
const { runAutomod } = require('../features/automod');
const { giveXp } = require('../features/leveling');

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    if (!message.inGuild() || message.author.bot || message.system) return;
    if (await runAutomod(message)) return;
    await giveXp(message);
  },
};
