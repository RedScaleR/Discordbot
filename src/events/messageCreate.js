const { Events } = require('discord.js');
const { runAutomod } = require('../features/automod');
const { giveXp } = require('../features/leveling');
const db = require('../database');

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    if (!message.inGuild() || message.author.bot || message.system) return;
    db.bumpStat(message.guildId, 'messages');
    if (await runAutomod(message)) return;
    await giveXp(message);
  },
};
