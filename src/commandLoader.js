const fs = require('node:fs');
const path = require('node:path');
const { Collection, RESTJSONErrorCodes } = require('discord.js');

const COMMANDS_DIR = path.join(__dirname, 'commands');
// Your own command files go here. Updates replace src/ but never touch this folder.
const MY_COMMANDS_DIR = path.join(__dirname, '..', 'my-commands');

function loadFolder(commands, folder, category) {
  for (const file of fs.readdirSync(folder).filter((name) => name.endsWith('.js'))) {
    for (const command of [require(path.join(folder, file))].flat()) {
      command.category = category;
      commands.set(command.data.name, command);
    }
  }
}

/** Loads every command from src/commands/<category>/*.js and my-commands/*.js. A file can export one command or a list. */
function loadCommands() {
  const commands = new Collection();
  for (const category of fs.readdirSync(COMMANDS_DIR)) loadFolder(commands, path.join(COMMANDS_DIR, category), category);
  if (fs.existsSync(MY_COMMANDS_DIR)) loadFolder(commands, MY_COMMANDS_DIR, 'extra');
  return commands;
}

/** Registers slash commands in one server. Server commands show up instantly (global ones can take an hour). */
async function registerCommands(guild, commands) {
  try {
    await guild.commands.set(commands.map((command) => command.data.toJSON()));
    console.log(`[commands] Registered ${commands.size} slash commands in "${guild.name}"`);
  } catch (err) {
    if (err.code === RESTJSONErrorCodes.MissingAccess) {
      console.error(
        `[commands] "${guild.name}" won't let me add slash commands. Kick me and re-invite me with the invite link above ` +
          '(it includes the "applications.commands" scope).',
      );
    } else {
      console.error(`[commands] Couldn't register commands in "${guild.name}":`, err);
    }
  }
}

module.exports = { loadCommands, registerCommands };
