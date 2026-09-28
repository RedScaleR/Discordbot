/** XP needed to go from `level` to `level + 1`. */
const xpForNextLevel = (level) => 5 * level ** 2 + 50 * level + 100;

/** Works out a level from total XP, plus progress towards the next one. */
function levelFromXp(totalXp) {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level++;
  }
  return { level, current: remaining, needed: xpForNextLevel(level) };
}

function progressBar(current, total, size = 12) {
  const filled = Math.max(0, Math.min(size, Math.round((current / total) * size)));
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

module.exports = { xpForNextLevel, levelFromXp, progressBar };
