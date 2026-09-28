// Free anime GIF sites (no API key needed). If the first one fails, Mochi tries the next.
const PROVIDERS = [
  {
    name: 'nekos.best',
    url: (category) => `https://nekos.best/api/v2/${category}`,
    parse: (body) => body.results?.[0] && { url: body.results[0].url, source: body.results[0].anime_name },
  },
  {
    name: 'waifu.pics',
    url: (category) => `https://api.waifu.pics/sfw/${category}`,
    parse: (body) => body.url && { url: body.url },
  },
];

const TIMEOUT = 4000;

async function fromProvider(provider, category) {
  const response = await fetch(provider.url(category), {
    headers: { 'User-Agent': 'MochiBot (Discord bot)' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const gif = provider.parse(await response.json());
  if (!gif?.url?.startsWith('https://')) throw new Error('no GIF in the reply');
  return gif;
}

function describe(err) {
  if (err.name === 'TimeoutError') return 'timed out';
  return err.cause?.code ?? err.message;
}

/**
 * Gets a random anime GIF for an action like "hug" or "pat".
 * Returns null if every site fails, so commands still work without a GIF.
 */
async function fetchGif(category) {
  const problems = [];
  for (const provider of PROVIDERS) {
    try {
      return await fromProvider(provider, category);
    } catch (err) {
      problems.push(`${provider.name}: ${describe(err)}`);
    }
  }
  console.warn(
    `[gifs] Couldn't get a "${category}" GIF (${problems.join(', ')}). ` +
      'Your internet, antivirus or firewall might be blocking these sites.',
  );
  return null;
}

module.exports = { fetchGif };
