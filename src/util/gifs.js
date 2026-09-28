// Free anime GIF sites (no API key needed). If one fails, Mochi tries the next one that has the category.
const PROVIDERS = [
  {
    name: 'nekos.best',
    categories: ['hug', 'pat', 'poke', 'highfive'],
    url: (category) => `https://nekos.best/api/v2/${category}`,
    parse: (body) => body.results?.[0] && { url: body.results[0].url, source: body.results[0].anime_name },
  },
  {
    name: 'nekos.life',
    categories: ['hug', 'pat', 'poke'],
    url: (category) => `https://nekos.life/api/v2/img/${category}`,
    parse: (body) => body.url && { url: body.url },
  },
  {
    name: 'purrbot',
    categories: ['hug', 'pat', 'poke'],
    url: (category) => `https://api.purrbot.site/v2/img/sfw/${category}/gif`,
    parse: (body) => !body.error && body.link && { url: body.link },
  },
];

const TIMEOUT = 4000;
// Firewalls often block anything calling itself a "bot", so this just names the app.
const USER_AGENT = 'Mochi/1.3 (Discord app)';

async function fromProvider(provider, category) {
  const response = await fetch(provider.url(category), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!response.ok) {
    // Cloudflare's block pages say "error code: 1020" and so on, which explains why.
    const code = (await response.text().catch(() => '')).match(/error code:?\s*(\d{4})/i)?.[1];
    throw new Error(`HTTP ${response.status}${code ? ` (Cloudflare error ${code})` : ''}`);
  }
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
  for (const provider of PROVIDERS.filter((p) => p.categories.includes(category))) {
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
