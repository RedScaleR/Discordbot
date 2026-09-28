# 🍡 Mochi

A cute and playful Discord bot for your friend server :3
Moderation, games, levels, coins, welcome messages, role buttons, logging and auto-mod, all with slash commands.

## Quick start

1. Install [Node.js](https://nodejs.org) **22.13 or newer**.
2. Create a bot at the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → **Bot**:
   - click **Reset Token** and copy it
   - turn on **Server Members Intent** and **Message Content Intent**, then save
3. Double-click **`start.bat`** (Windows) or run **`./start.sh`** (Mac/Linux) and paste your token when asked.
4. Mochi prints an invite link in the console. Open it to add Mochi to your server. Done! (◕‿◕)

Put Mochi's role near the top of **Server Settings → Roles** so it can moderate people and hand out roles.

## Start Mochi with Windows

After running `start.bat` once, double-click **`autostart-on.bat`**. From then on Mochi starts by itself in a minimized window whenever you log in, and restarts itself if it stops unexpectedly (like when the internet isn't connected yet right after boot). Close its window to stop it. Double-click **`autostart-off.bat`** to turn this off.

Mochi won't run twice: if it's already running and you open `start.bat`, it just tells you so.

## Settings (`config.json`)

The easiest way to change these is the dashboard's **Settings** tab. To edit the file by hand instead, right-click a channel or role → **Copy ID** (turn on **Developer Mode** in Discord's Advanced settings first). Leave an ID empty (`""`) to turn that feature off. Restart Mochi after editing the file by hand.

| Setting | What it does |
| --- | --- |
| `logChannelId` | Where deleted/edited messages, joins, leaves, bans and mod actions get logged |
| `welcome.channelId` / `welcome.message` | Welcome new members. Placeholders: `{user}` `{username}` `{server}` `{count}` |
| `goodbye.channelId` / `goodbye.message` | Say bye when someone leaves |
| `levels.announceChannelId` | Where level-ups are posted (empty = the channel they chatted in) |
| `levels.roleRewards` | Roles given at levels, like `{ "5": "ROLE_ID", "10": "OTHER_ROLE_ID" }` |
| `levels.xpMin` / `xpMax` / `cooldownSeconds` | XP per message and how often it can be earned |
| `economy.*` | Currency emoji, daily/work payouts, work cooldown, trivia prize |
| `automod.bannedWords` | Words to delete, like `["badword", "meanie*"]` (a `*` at the end also catches words that start with it) |
| `automod.blockInvites` | Delete Discord invite links |
| `automod.maxMentions` | Pings allowed in one message before it's deleted and the sender is timed out |
| `automod.spam` | `maxMessages` within `perSeconds` counts as spam and gives a `timeoutMinutes` timeout |
| `automod.exemptRoleIds` / `exemptChannelIds` | Roles and channels auto-mod ignores (people with Manage Messages are always ignored) |

## Dashboard

While Mochi is running, open **http://localhost:3000** in your browser:

- **Overview:** members, messages and commands today, a 14-day activity chart, top commands, leaderboards, recent warnings and a live activity feed
- **Members:** search anyone, change their XP or coins, remove warnings
- **Settings:** everything in `config.json` with dropdowns for channels and roles. Changes apply instantly, no restart

It only works on the PC running Mochi, so nobody else can open it. Every change made there is posted to your log channel.
If port 3000 is taken, add `DASHBOARD_PORT=3001` to `.env`. Message and command counts start from when you first run v1.3.0.

## Commands

| | |
| --- | --- |
| 🎲 **Fun** | `/8ball` `/roll` `/coinflip` `/rps` `/trivia` `/ship` `/rate` `/choose` `/hug` `/pat` `/boop` `/highfive` |
| 🍡 **Levels & economy** | `/rank` `/leaderboard` `/balance` `/daily` `/work` `/pay` `/slots` |
| 🧰 **Utility** | `/help` `/ping` `/serverinfo` `/userinfo` `/avatar` `/poll` `/remind` |
| 🔨 **Moderation** | `/ban` `/unban` `/kick` `/timeout` `/untimeout` `/warn` `/warnings` `/purge` `/slowmode` |
| ⚙️ **Admin** | `/rolepanel` posts buttons people click to give themselves roles |

`/hug` `/pat` `/boop` `/highfive` come with a random anime GIF from [nekos.best](https://nekos.best), with [nekos.life](https://nekos.life) and [purrbot](https://purrbot.site) as backups (free, no setup). If they're all unreachable the commands still work, just without the GIF.
Moderation and admin commands only show up for people with the matching permissions.
Data (XP, coins, warnings, reminders) lives in `data/mochi.db`. Back it up if you care about it!

## Adding your own command

Drop a file in a folder under `src/commands/`, restart, and it shows up automatically:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('hello').setDescription('Say hi'),
  async execute(interaction) {
    await interaction.reply('Hiii :3');
  },
};
```
