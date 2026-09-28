const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };

/** Lowercases and strips accents and zero-width tricks. */
function normalize(text) {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u200b-\u200d\u2060\ufeff]/g, '')
    .toLowerCase();
}

const unleet = (text) => text.replace(/[0134578@$!]/g, (char) => LEET[char]);
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Word lists don't change while the bot runs, so each regex is only built once.
const patternCache = new Map();

function patternFor(word) {
  if (!patternCache.has(word)) {
    // "word*" also matches anything that starts with "word".
    const wildcard = word.endsWith('*');
    const base = escapeRegex(normalize(wildcard ? word.slice(0, -1) : word));
    const tail = wildcard ? '[a-z]*' : '';
    patternCache.set(word, new RegExp(`(?:^|[^a-z])${base}${tail}(?:$|[^a-z])`));
  }
  return patternCache.get(word);
}

/** Returns the first banned word found in `content` (also catching l33tspeak), or null. */
function findBannedWord(content, bannedWords) {
  if (!bannedWords.length) return null;
  const plain = normalize(content);
  const texts = [plain, unleet(plain)];
  return (
    bannedWords.find((word) => {
      const trimmed = word.trim();
      return trimmed && texts.some((text) => patternFor(trimmed).test(text));
    }) ?? null
  );
}

const INVITE_PATTERN = /(?:discord(?:app)?\.com\/invite|discord\.(?:gg|io|me|li)|dsc\.gg)\/[\w-]+/i;
const hasInvite = (content) => INVITE_PATTERN.test(content);

/** Remembers recent message times per member so we can spot spam. */
class SpamTracker {
  constructor() {
    this.history = new Map();
  }

  /** Records a message and returns true if the member just crossed the spam limit. */
  hit(key, { maxMessages, perSeconds }, now = Date.now()) {
    const windowStart = now - perSeconds * 1000;
    const times = (this.history.get(key) ?? []).filter((time) => time > windowStart);
    times.push(now);
    if (times.length >= maxMessages) {
      this.history.delete(key);
      return true;
    }
    this.history.set(key, times);
    return false;
  }

  /** Drops members who haven't talked in a while so the map doesn't grow forever. */
  sweep(maxAgeMs, now = Date.now()) {
    for (const [key, times] of this.history) {
      if (times[times.length - 1] < now - maxAgeMs) this.history.delete(key);
    }
  }
}

module.exports = { normalize, findBannedWord, hasInvite, SpamTracker };
