const crypto = require('node:crypto');

/** A number from 0 to max-1 that's always the same for the same text. */
function stableNumber(text, max) {
  return crypto.createHash('sha256').update(text).digest().readUInt32BE(0) % max;
}

module.exports = { stableNumber };
