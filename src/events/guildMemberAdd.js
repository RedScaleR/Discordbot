const { Events } = require('discord.js');
const { welcome } = require('../features/welcome');

module.exports = {
  name: Events.GuildMemberAdd,
  execute: welcome,
};
