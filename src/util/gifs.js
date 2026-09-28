const API = 'https://nekos.best/api/v2';

/**
 * Gets a random anime GIF for an action like "hug" or "pat" from nekos.best (free, no API key needed).
 * Returns null if the site is down or slow, so commands still work without a GIF.
 */
async function fetchGif(category) {
  try {
    const response = await fetch(`${API}/${category}`, {
      headers: { 'User-Agent': 'MochiBot (Discord bot)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const gif = (await response.json()).results?.[0];
    return gif?.url?.startsWith('https://') ? { url: gif.url, source: gif.anime_name } : null;
  } catch {
    return null;
  }
}

module.exports = { fetchGif };
