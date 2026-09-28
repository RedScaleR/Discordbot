const { Events } = require('discord.js');
const { goodbye } = require('../features/welcome');

module.exports = {
  name: Events.GuildMemberRemove,
  execute: goodbye,
};
