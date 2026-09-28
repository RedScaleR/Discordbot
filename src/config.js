const fs = require('node:fs');
const path = require('node:path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// Anything missing from config.json falls back to these values.
const DEFAULTS = {
  logChannelId: '',
  welcome: {
    channelId: '',
    message: "Welcome to **{server}**, {user}! You're our member #{count} (ﾉ◕ヮ◕)ﾉ✧",
  },
  goodbye: {
    channelId: '',
    message: "**{username}** left the server... we'll miss you (｡•́︿•̀｡)",
  },
  levels: {
    enabled: true,
    announceChannelId: '',
    xpMin: 15,
    xpMax: 25,
    cooldownSeconds: 60,
    coinsPerLevel: 25,
    roleRewards: {},
  },
  economy: {
    currency: '🍡',
    dailyAmount: 200,
    dailyStreakBonus: 25,
    workMin: 50,
    workMax: 150,
    workCooldownMinutes: 60,
    triviaReward: 30,
  },
  automod: {
    enabled: true,
    bannedWords: [],
    blockInvites: true,
    maxMentions: 5,
    spam: { maxMessages: 6, perSeconds: 5, timeoutMinutes: 5 },
    exemptRoleIds: [],
    exemptChannelIds: [],
  },
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function merge(defaults, overrides) {
  const result = { ...defaults };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    result[key] = isPlainObject(defaults[key]) && isPlainObject(value) ? merge(defaults[key], value) : value;
  }
  return result;
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return DEFAULTS;
  try {
    return merge(DEFAULTS, JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
  } catch (err) {
    console.error(`[config] config.json has a typo in it >_< (${err.message})`);
    process.exit(1);
  }
}

module.exports = loadConfig();
