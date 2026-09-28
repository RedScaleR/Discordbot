const path = require('node:path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// Emoji come from a bundled Twemoji font, so they look the same on every PC and work offline.
GlobalFonts.registerFromPath(path.join(path.dirname(require.resolve('twemoji-colr-font/package.json')), 'twemoji.woff2'), 'Twemoji');

const WIDTH = 934;
const HEIGHT = 300;
const FONT = '"Segoe UI", "Helvetica Neue", "Liberation Sans", Arial, Twemoji, sans-serif';
const COLORS = {
  ink: '#2b1f26',
  soft: '#6b5862',
  accent: '#d6457f',
  accentLight: '#f08bb5',
  chip: 'rgba(255, 255, 255, 0.72)',
  track: 'rgba(255, 255, 255, 0.65)',
};

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

/** Shortens text with "…" until it fits. */
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let chars = [...text];
  while (chars.length && ctx.measureText(`${chars.join('')}…`).width > maxWidth) chars = chars.slice(0, -1);
  return `${chars.join('')}…`;
}

async function fetchAvatar(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return await loadImage(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Draws a row of rounded "chips" and returns where it ended. */
function drawChips(ctx, chips, x, y, maxX) {
  ctx.font = `600 20px ${FONT}`;
  for (const text of chips) {
    const width = ctx.measureText(text).width + 28;
    if (x + width > maxX) break;
    ctx.fillStyle = COLORS.chip;
    roundedRect(ctx, x, y, width, 36, 18);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(text, x + 14, y + 25);
    x += width + 10;
  }
  return x;
}

/**
 * Draws a profile card and returns it as a PNG.
 * `stats`: { name, username, avatarUrl, level, current, needed, rank, coins, currency, streak, badges: [{ emoji, name }] }
 */
async function renderProfileCard(stats) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Soft pink-to-lavender card with a few floating bubbles.
  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, '#ffd6e7');
  background.addColorStop(1, '#e3d4ff');
  ctx.fillStyle = background;
  roundedRect(ctx, 0, 0, WIDTH, HEIGHT, 32);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (const [x, y, r] of [[860, 30, 90], [700, 290, 60], [40, 280, 50], [560, -20, 40]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Avatar with a white ring (or their first letter if it can't load).
  const avatarX = 48;
  const avatarY = 60;
  const size = 180;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(avatarX + size / 2, avatarY + size / 2, size / 2 + 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + size / 2, avatarY + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  const avatar = await fetchAvatar(stats.avatarUrl);
  if (avatar) {
    ctx.drawImage(avatar, avatarX, avatarY, size, size);
  } else {
    ctx.fillStyle = COLORS.accentLight;
    ctx.fillRect(avatarX, avatarY, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 80px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText([...stats.name][0]?.toUpperCase() ?? '?', avatarX + size / 2, avatarY + size / 2 + 28);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  const left = 272;
  const right = WIDTH - 48;

  // Rank in the top right corner.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.accent;
  ctx.font = `bold 44px ${FONT}`;
  const rankText = stats.rank ? `#${stats.rank}` : '';
  ctx.fillText(rankText, right, 84);
  const rankWidth = ctx.measureText(rankText).width;
  ctx.fillStyle = COLORS.soft;
  ctx.font = `600 18px ${FONT}`;
  if (rankText) ctx.fillText('RANK', right - rankWidth - 10, 84);
  ctx.textAlign = 'left';

  // Name and username.
  ctx.fillStyle = COLORS.ink;
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillText(fit(ctx, stats.name, right - left - 140), left, 84);
  ctx.fillStyle = COLORS.soft;
  ctx.font = `22px ${FONT}`;
  ctx.fillText(fit(ctx, `@${stats.username}`, right - left - 140), left, 116);

  // Coins, streak and badges.
  const chips = [`${stats.currency} ${stats.coins.toLocaleString('en-US')}`];
  if (stats.streak) chips.push(`🔥 ${stats.streak} day${stats.streak === 1 ? '' : 's'}`);
  chips.push(...stats.badges.map((badge) => `${badge.emoji} ${badge.name}`));
  drawChips(ctx, chips, left, 138, right);

  // Level and XP bar.
  ctx.fillStyle = COLORS.ink;
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText(`Level ${stats.level}`, left, 216);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.soft;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText(`${stats.current.toLocaleString('en-US')} / ${stats.needed.toLocaleString('en-US')} XP`, right, 216);
  ctx.textAlign = 'left';

  const barY = 230;
  const barHeight = 26;
  ctx.fillStyle = COLORS.track;
  roundedRect(ctx, left, barY, right - left, barHeight, barHeight / 2);
  ctx.fill();
  const progress = Math.max(0, Math.min(1, stats.current / stats.needed));
  if (progress > 0) {
    const fill = ctx.createLinearGradient(left, 0, right, 0);
    fill.addColorStop(0, COLORS.accent);
    fill.addColorStop(1, COLORS.accentLight);
    ctx.fillStyle = fill;
    roundedRect(ctx, left, barY, Math.max(barHeight, (right - left) * progress), barHeight, barHeight / 2);
    ctx.fill();
  }

  return canvas.toBuffer('image/png');
}

module.exports = { renderProfileCard };
