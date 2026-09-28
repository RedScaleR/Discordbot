const fs = require('node:fs');
const path = require('node:path');

const ENV_PATH = path.join(__dirname, '..', '.env');
if (fs.existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);

const token = process.env.DISCORD_TOKEN?.trim();
if (!token) {
  console.error("I need a bot token to wake up >_<  Put it in the .env file like this:  DISCORD_TOKEN=your-token-here");
  process.exit(1);
}

const { Client, Events, GatewayIntentBits, GatewayCloseCodes, Partials } = require('discord.js');
const { loadCommands } = require('./commandLoader');
const { db } = require('./database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  // Lets goodbye messages work for members who joined before Mochi started.
  partials: [Partials.GuildMember],
  // Never ping @everyone, @here or roles, even if someone sneaks them into a command.
  allowedMentions: { parse: ['users'] },
});

client.commands = loadCommands();

const eventsDir = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsDir).filter((name) => name.endsWith('.js'))) {
  const event = require(path.join(eventsDir, file));
  const run = (...args) => Promise.resolve(event.execute(...args)).catch((err) => console.error(`[${event.name}]`, err));
  client[event.once ? 'once' : 'on'](event.name, run);
}

process.on('unhandledRejection', (err) => console.error('[unhandled]', err));

async function shutdown() {
  console.log('\nGoing to sleep... bye bye! (｡•ᴗ•｡)ﾉ');
  await client.destroy();
  db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const BAD_TOKEN_HINT =
  "That bot token doesn't work >_<  Get a new one (Developer Portal → your app → Bot → Reset Token) and put it in .env";

// Discord closes the connection with this code when the privileged intent switches are off.
client.on(Events.ShardDisconnect, ({ code }) => {
  if (code === GatewayCloseCodes.DisallowedIntents) {
    console.error(
      'Almost there! Go to the Developer Portal → your app → Bot, turn on\n' +
        '"SERVER MEMBERS INTENT" and "MESSAGE CONTENT INTENT", save, then start me again :3',
    );
  } else if (code === GatewayCloseCodes.AuthenticationFailed) {
    console.error(BAD_TOKEN_HINT);
  } else {
    return;
  }
  process.exit(1);
});

client.login(token).catch((err) => {
  if (err.code === 'TokenInvalid') console.error(BAD_TOKEN_HINT);
  else console.error("Couldn't log in :<", err);
  process.exit(1);
});
