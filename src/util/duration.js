const UNITS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

const ALIASES = {
  s: 's', sec: 's', secs: 's', second: 's', seconds: 's',
  m: 'm', min: 'm', mins: 'm', minute: 'm', minutes: 'm',
  h: 'h', hr: 'h', hrs: 'h', hour: 'h', hours: 'h',
  d: 'd', day: 'd', days: 'd',
  w: 'w', wk: 'w', week: 'w', weeks: 'w',
};

/** Turns "10m", "1h30m" or "2 days" into milliseconds. Returns null if it can't make sense of it. */
function parseDuration(input) {
  const text = String(input).trim().toLowerCase();
  if (!text) return null;

  const pattern = /(\d+)\s*([a-z]+)\s*/g;
  let total = 0;
  let consumed = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index !== consumed) return null;
    const unit = ALIASES[match[2]];
    if (!unit) return null;
    total += Number(match[1]) * UNITS[unit];
    consumed = pattern.lastIndex;
  }
  return consumed === text.length && total > 0 ? total : null;
}

function formatDuration(ms) {
  const parts = [];
  for (const [unit, size] of [['d', UNITS.d], ['h', UNITS.h], ['m', UNITS.m], ['s', UNITS.s]]) {
    const amount = Math.floor(ms / size);
    if (amount) parts.push(`${amount}${unit}`);
    ms %= size;
  }
  return parts.join(' ') || '0s';
}

module.exports = { parseDuration, formatDuration };
