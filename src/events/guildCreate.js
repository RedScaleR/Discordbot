const { Events } = require('discord.js');
const { registerCommands } = require('../commandLoader');

module.exports = {
  name: Events.GuildCreate,

  async execute(guild) {
    console.log(`[guilds] Joined "${guild.name}"! :3`);
    await registerCommands(guild, guild.client.commands);
  },
};
