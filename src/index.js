const fs = require('node:fs');
const path = require('node:path');
const EXIT = require('./exitCodes');

const ENV_PATH = path.join(__dirname, '..', '.env');
if (fs.existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);

const token = process.env.DISCORD_TOKEN?.trim();
if (!token) {
  console.error("I need a bot token to wake up >_<  Put it in the .env file like this:  DISCORD_TOKEN=your-token-here");
  process.exit(EXIT.NEEDS_FIXING);
}

const { Client, Events, GatewayIntentBits, GatewayCloseCodes, Partials } = require('discord.js');
const { loadCommands } = require('./commandLoader');
const { db } = require('./database');
const { startDashboard } = require('./dashboard/server');

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
client.dashboardPort = Number(process.env.DASHBOARD_PORT) || 3000;

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
  process.exit(EXIT.NEEDS_FIXING);
});

/** Two copies of Mochi would answer every command twice, so check whether one's already running. */
async function isAlreadyRunning(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: AbortSignal.timeout(2000) });
    const status = await response.json();
    return typeof status.version === 'string' && 'ready' in status;
  } catch {
    return false;
  }
}

async function main() {
  if (await isAlreadyRunning(client.dashboardPort)) {
    console.error(
      `Mochi is already running! Look for its window in your taskbar, or open http://localhost:${client.dashboardPort} :3`,
    );
    process.exit(EXIT.ALREADY_RUNNING);
  }
  startDashboard(client, client.dashboardPort);
  await client.login(token);
}

main().catch((err) => {
  if (err.code === 'TokenInvalid') {
    console.error(BAD_TOKEN_HINT);
    process.exit(EXIT.NEEDS_FIXING);
  }
  console.error(`Couldn't log in :< (${err.code ?? err.message}). Is your internet connected?`);
  process.exit(EXIT.RESTART);
});
