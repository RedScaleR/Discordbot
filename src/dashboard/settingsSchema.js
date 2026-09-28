const { PROVIDERS } = require('../ai/providers');
const { PERSONALITIES } = require('../ai/personalities');

// Describes every setting the dashboard can edit. The page builds its form from this,
// and the server uses it to check whatever the page sends back.
// `showIf` only hides a field on the page while another setting has a different value.
const SECTIONS = [
  {
    title: '📜 Logging',
    fields: [
      {
        path: 'logChannelId',
        type: 'channel',
        label: 'Log channel',
        help: 'Deleted and edited messages, joins, leaves, bans and mod actions get posted here.',
      },
    ],
  },
  {
    title: '🌸 Welcome & goodbye',
    fields: [
      { path: 'welcome.channelId', type: 'channel', label: 'Welcome channel' },
      {
        path: 'welcome.message',
        type: 'text',
        label: 'Welcome message',
        max: 1000,
        multiline: true,
        help: 'Placeholders: {user} (a ping), {username}, {server}, {count}',
      },
      { path: 'goodbye.channelId', type: 'channel', label: 'Goodbye channel' },
      {
        path: 'goodbye.message',
        type: 'text',
        label: 'Goodbye message',
        max: 1000,
        multiline: true,
        help: 'Placeholders: {user}, {username}, {server}, {count}',
      },
    ],
  },
  {
    title: '✨ Levels',
    fields: [
      { path: 'levels.enabled', type: 'bool', label: 'Give XP for chatting' },
      {
        path: 'levels.announceChannelId',
        type: 'channel',
        label: 'Level-up channel',
        emptyLabel: 'Same channel they chatted in',
      },
      { path: 'levels.xpMin', type: 'int', min: 0, max: 1000, label: 'Least XP per message' },
      { path: 'levels.xpMax', type: 'int', min: 0, max: 1000, label: 'Most XP per message' },
      { path: 'levels.cooldownSeconds', type: 'int', min: 0, max: 3600, label: 'Seconds between XP', help: 'Stops people farming XP by spamming.' },
      { path: 'levels.coinsPerLevel', type: 'int', min: 0, max: 100000, label: 'Coins per level-up', help: 'Multiplied by the new level. 0 turns it off.' },
      { path: 'levels.roleRewards', type: 'roleRewards', label: 'Level roles', help: 'Roles people get when they reach a level.' },
    ],
  },
  {
    title: '🍡 Economy',
    fields: [
      { path: 'economy.currency', type: 'text', max: 20, required: true, label: 'Currency', help: 'An emoji or a short word.' },
      { path: 'economy.dailyAmount', type: 'int', min: 0, max: 1000000, label: '/daily coins' },
      { path: 'economy.dailyStreakBonus', type: 'int', min: 0, max: 100000, label: 'Streak bonus per day', help: 'Extra coins for each day of a streak, up to 7 days.' },
      { path: 'economy.workMin', type: 'int', min: 0, max: 1000000, label: 'Least /work coins' },
      { path: 'economy.workMax', type: 'int', min: 0, max: 1000000, label: 'Most /work coins' },
      { path: 'economy.workCooldownMinutes', type: 'int', min: 0, max: 10080, label: 'Minutes between /work' },
      { path: 'economy.triviaReward', type: 'int', min: 0, max: 1000000, label: '/trivia prize' },
    ],
  },
  {
    title: '🛡️ Auto-mod',
    fields: [
      { path: 'automod.enabled', type: 'bool', label: 'Auto-mod on' },
      {
        path: 'automod.bannedWords',
        type: 'words',
        label: 'Banned words',
        help: 'One per line. End a word with * to also catch words starting with it, like meanie*',
      },
      { path: 'automod.blockInvites', type: 'bool', label: 'Delete Discord invite links' },
      { path: 'automod.maxMentions', type: 'int', min: 0, max: 50, label: 'Most pings in one message', help: '0 turns this check off.' },
      { path: 'automod.spam.maxMessages', type: 'int', min: 2, max: 50, label: 'Spam: messages…' },
      { path: 'automod.spam.perSeconds', type: 'int', min: 1, max: 60, label: '…within this many seconds' },
      { path: 'automod.spam.timeoutMinutes', type: 'int', min: 0, max: 10080, label: 'Timeout for spam or mass pings (minutes)', help: '0 means no timeout, just delete.' },
      { path: 'automod.exemptRoleIds', type: 'roles', label: 'Ignore these roles', help: 'People who can manage messages are always ignored.' },
      { path: 'automod.exemptChannelIds', type: 'channels', label: 'Ignore these channels' },
    ],
  },
  {
    title: '🤖 AI chat',
    fields: [
      { path: 'ai.enabled', type: 'bool', label: 'AI chat on', help: 'Mochi replies when someone @mentions it or replies to one of its messages.' },
      {
        path: 'ai.provider',
        type: 'select',
        label: 'AI provider',
        options: Object.entries(PROVIDERS).map(([value, provider]) => ({ value, label: provider.label, help: provider.help })),
      },
      { path: 'ai.apiKeys.groq', type: 'secret', max: 300, label: 'Groq API key', showIf: { path: 'ai.provider', equals: 'groq' } },
      { path: 'ai.apiKeys.gemini', type: 'secret', max: 300, label: 'Gemini API key', showIf: { path: 'ai.provider', equals: 'gemini' } },
      { path: 'ai.apiKeys.openrouter', type: 'secret', max: 300, label: 'OpenRouter API key', showIf: { path: 'ai.provider', equals: 'openrouter' } },
      {
        path: 'ai.customUrl',
        type: 'url',
        label: 'Server address',
        help: 'Like http://localhost:1234/v1',
        showIf: { path: 'ai.provider', equals: 'custom' },
      },
      {
        path: 'ai.apiKeys.custom',
        type: 'secret',
        max: 300,
        label: 'API key (if it needs one)',
        showIf: { path: 'ai.provider', equals: 'custom' },
      },
      {
        path: 'ai.model',
        type: 'model',
        max: 200,
        label: 'Model',
        help: 'Leave empty and Mochi picks a good model by itself, or press "Load models" to choose one.',
        defaults: Object.fromEntries(Object.entries(PROVIDERS).map(([value, provider]) => [value, provider.defaultModel])),
      },
      {
        path: 'ai.personality',
        type: 'personality',
        label: 'Personality',
        options: Object.entries(PERSONALITIES).map(([value, personality]) => ({ value, label: personality.label, prompt: personality.prompt })),
      },
      {
        path: 'ai.customPersonality',
        type: 'text',
        multiline: true,
        max: 2000,
        label: 'Your personality',
        help: 'Describe how Mochi should act, like "You are a grumpy pirate who loves cats."',
        showIf: { path: 'ai.personality', equals: 'custom' },
      },
      {
        path: 'ai.channelIds',
        type: 'channels',
        label: 'Always chat in these channels',
        help: 'Here Mochi answers every message. Everywhere else, only when @mentioned or replied to.',
      },
      { path: 'ai.contextMessages', type: 'int', min: 0, max: 30, label: 'Messages it reads back', help: 'How much of the recent chat Mochi sees before answering.' },
      { path: 'ai.cooldownSeconds', type: 'int', min: 0, max: 300, label: 'Seconds between replies per person' },
      { type: 'aiTest', label: 'Try it out', help: 'Uses the settings above, even before you save.' },
    ],
  },
];

// Fields without a path (like the test box) are page-only and hold no setting.
const FIELDS = SECTIONS.flatMap((section) => section.fields).filter((field) => field.path);
const SNOWFLAKE = /^\d{17,20}$/;

const getPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((node, key) => node[key], object)[last] = value;
}

class SettingsError extends Error {
  constructor(field, message) {
    super(`${field.label}: ${message}`);
    this.status = 400;
    this.field = field.path;
  }
}

function clean(field, value) {
  const fail = (message) => {
    throw new SettingsError(field, message);
  };

  switch (field.type) {
    case 'bool':
      if (typeof value !== 'boolean') fail('must be on or off');
      return value;
    case 'int':
      if (!Number.isInteger(value)) fail('must be a whole number');
      if (value < field.min || value > field.max) fail(`must be between ${field.min} and ${field.max}`);
      return value;
    case 'text':
      if (typeof value !== 'string') fail('must be text');
      if (field.required && !value.trim()) fail("can't be empty");
      if (value.length > field.max) fail(`is too long (${field.max} characters max)`);
      return value;
    case 'channel':
      if (value !== '' && !SNOWFLAKE.test(value)) fail("isn't a valid channel");
      return value;
    case 'select':
    case 'personality':
      if (!field.options.some((option) => option.value === value)) fail('is not one of the choices');
      return value;
    case 'secret':
    case 'model':
      if (typeof value !== 'string' || value.length > field.max) fail('is invalid');
      return value.trim();
    case 'url':
      if (typeof value !== 'string' || value.length > 300) fail('is invalid');
      if (value && !/^https?:\/\/[^\s]+$/i.test(value.trim())) fail('must start with http:// or https://');
      return value.trim();
    case 'roles':
    case 'channels':
      if (!Array.isArray(value) || value.length > 50 || !value.every((id) => SNOWFLAKE.test(id))) fail('has an invalid entry');
      return [...new Set(value)];
    case 'words': {
      if (!Array.isArray(value) || value.length > 500 || !value.every((word) => typeof word === 'string')) fail('has an invalid entry');
      const words = [...new Set(value.map((word) => word.trim().toLowerCase()).filter(Boolean))];
      if (words.some((word) => word.length > 50)) fail('each word can be 50 characters at most');
      return words;
    }
    case 'roleRewards': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('is invalid');
      const entries = Object.entries(value);
      if (entries.length > 50) fail('can have 50 levels at most');
      for (const [level, roleId] of entries) {
        if (!/^\d+$/.test(level) || Number(level) < 1 || Number(level) > 1000) fail('levels must be between 1 and 1000');
        if (!SNOWFLAKE.test(roleId)) fail(`level ${level} needs a role`);
      }
      return Object.fromEntries(entries.sort(([a], [b]) => a - b));
    }
    default:
      throw new Error(`Unknown setting type ${field.type}`);
  }
}

/** Checks new values from the dashboard and returns the full config they'd produce. Throws a SettingsError if something's off. */
function sanitize(values, current) {
  const next = structuredClone(current);
  for (const field of FIELDS) setPath(next, field.path, clean(field, getPath(values, field.path)));

  const byPath = (path) => FIELDS.find((field) => field.path === path);
  if (next.levels.xpMin > next.levels.xpMax) throw new SettingsError(byPath('levels.xpMax'), "can't be less than the least XP");
  if (next.economy.workMin > next.economy.workMax) throw new SettingsError(byPath('economy.workMax'), "can't be less than the least coins");
  return next;
}

module.exports = { SECTIONS, sanitize };
