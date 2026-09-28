// AI services Mochi can chat through. They all speak the same "OpenAI-compatible" API,
// so one small client works for every one of them.
const PROVIDERS = {
  ollama: {
    label: 'Ollama (runs on your PC)',
    help: 'Free forever and private. Install Ollama from ollama.com, then run "ollama pull llama3.2" once. Needs 8 GB+ RAM.',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    needsKey: false,
    timeoutMs: 120_000, // the first reply can be slow while your PC loads the model
  },
  groq: {
    label: 'Groq (free key)',
    help: 'Fast and free with daily limits. Get a key at console.groq.com/keys. Recent chat messages are sent to Groq.',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-8b-instant',
    needsKey: true,
    timeoutMs: 45_000,
  },
  gemini: {
    label: 'Google Gemini (free key)',
    help: 'Free with daily limits. Get a key at aistudio.google.com/apikey. Google may use free-tier chats to improve its AI.',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    needsKey: true,
    timeoutMs: 45_000,
  },
  openrouter: {
    label: 'OpenRouter (free models)',
    help: 'Many AI models, some free (the ones ending in ":free"). Get a key at openrouter.ai/keys. Recent chat messages are sent to OpenRouter.',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    needsKey: true,
    timeoutMs: 60_000,
  },
  custom: {
    label: 'Custom (any OpenAI-compatible server)',
    help: 'For anything else that speaks the OpenAI API, like LM Studio (http://localhost:1234/v1).',
    baseUrl: '',
    defaultModel: '',
    needsKey: false,
    timeoutMs: 120_000,
  },
};

/** An error with a friendly explanation Mochi can say in chat. */
class AiError extends Error {
  constructor(userMessage, detail) {
    super(detail ?? userMessage);
    this.userMessage = userMessage;
  }
}

function resolve(ai) {
  const provider = PROVIDERS[ai.provider];
  if (!provider) throw new AiError("I don't know that AI provider. Pick one in the dashboard!");
  const baseUrl = (ai.provider === 'custom' ? ai.customUrl : provider.baseUrl).replace(/\/+$/, '');
  if (!baseUrl) throw new AiError('The custom AI server address is empty. Set it in the dashboard!');
  const key = ai.apiKeys?.[ai.provider] ?? '';
  if (provider.needsKey && !key) throw new AiError(`I need an API key for ${provider.label}. Add it in the dashboard!`);
  return { provider, baseUrl, key };
}

async function request(ai, path, options = {}, model = null) {
  const { provider, baseUrl, key } = resolve(ai);
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(ai.provider === 'openrouter' ? { 'X-Title': 'Mochi Discord bot' } : {}),
      },
      signal: AbortSignal.timeout(provider.timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new AiError('The AI took too long to answer. Try again?', 'timed out');
    const code = err.cause?.code;
    if (ai.provider === 'ollama' && (code === 'ECONNREFUSED' || code === 'ECONNRESET')) {
      throw new AiError("My brain isn't switched on! Open the Ollama app on the PC running me.", code);
    }
    throw new AiError("I can't reach the AI right now. Is the internet working?", code ?? err.message);
  }

  if (response.ok) return response.json();

  const body = await response.text().catch(() => '');
  const detail = `HTTP ${response.status}: ${body.slice(0, 300)}`;
  if (response.status === 401 || response.status === 403) throw new AiError("The AI key doesn't work. Check it in the dashboard!", detail);
  if (response.status === 429) throw new AiError("I've hit the free AI limit for now. Try again in a little while!", detail);
  if (model && (response.status === 404 || /model/i.test(body))) {
    const error = new AiError(
      ai.provider === 'ollama'
        ? `I can't find the AI model "${model}". Run "ollama pull llama3.2" on the PC, or pick another model in the dashboard.`
        : `The AI model "${model}" isn't available. Press "Load models" in the dashboard and pick another!`,
      detail,
    );
    error.modelMissing = true;
    throw error;
  }
  throw new AiError('The AI had a problem answering. Try again?', detail);
}

// Models that can't chat (speech, safety filters, embeddings...), so they're never picked or listed.
const NOT_CHAT = /whisper|tts|guard|embed|moderation|audio|transcri|speech|imagen|image-gen|veo|aqa|learnlm|orpheus|playai|compound/i;

// What a good default looks like for each provider, best first. Used when the Model box is empty.
const PREFERRED = {
  groq: [/llama-3\.\d+-8b-instant/, /llama.*(versatile|instant)/, /llama/, /gpt-oss/, /qwen/, /gemma/],
  gemini: [/^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash/, /flash/, /gemini/],
  openrouter: [/llama/, /gemma/, /mistral/, /qwen/, /deepseek/],
  ollama: [/llama/, /gemma/, /qwen/, /mistral/, /phi/],
  custom: [],
};

const versionOf = (id) => Number(id.match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
const isPreview = (id) => /preview|exp(erimental)?\b/i.test(id);

/** Picks a sensible chat model from what a provider offers. */
function pickModel(provider, ids) {
  const preferred = PREFERRED[provider] ?? [];
  const rank = (id) => {
    const index = preferred.findIndex((pattern) => pattern.test(id));
    return index === -1 ? preferred.length : index;
  };
  return (
    [...ids].sort(
      (a, b) => rank(a) - rank(b) || isPreview(a) - isPreview(b) || versionOf(b) - versionOf(a) || a.localeCompare(b),
    )[0] ?? null
  );
}

/** Lists the chat models the chosen provider offers (only the free ones on OpenRouter). */
async function listModels(ai) {
  const data = await request(ai, '/models');
  let ids = (data.data ?? data.models ?? [])
    .filter((model) => model.active !== false)
    .map((model) => String(model.id ?? model.name ?? '').replace(/^models\//, ''))
    .filter((id) => id && !NOT_CHAT.test(id));
  if (ai.provider === 'openrouter') ids = ids.filter((id) => id.endsWith(':free'));
  return [...new Set(ids)].sort();
}

// Automatically picked models, remembered for an hour so Mochi doesn't ask every message.
const autoModels = new Map();
const AUTO_MODEL_TTL = 60 * 60 * 1000;

async function autoModel(ai, { fresh = false } = {}) {
  const { provider, baseUrl, key } = resolve(ai);
  const cacheKey = `${ai.provider}|${baseUrl}|${key}`;
  const cached = autoModels.get(cacheKey);
  if (!fresh && cached && cached.expires > Date.now()) return cached.model;

  let model = null;
  try {
    model = pickModel(ai.provider, await listModels(ai));
  } catch (err) {
    // A bad key is worth reporting; anything else, just try the built-in default.
    if (/key/i.test(err.userMessage ?? '')) throw err;
  }
  model ??= provider.defaultModel;
  if (!model) throw new AiError('I need a model name. Set one in the dashboard!');
  if (model !== cached?.model) console.log(`[ai] Using the "${model}" model (picked automatically)`);
  autoModels.set(cacheKey, { model, expires: Date.now() + AUTO_MODEL_TTL });
  return model;
}

async function complete(ai, model, messages) {
  const data = await request(
    ai,
    '/chat/completions',
    { method: 'POST', body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 500 }) },
    model,
  );
  const text = data.choices?.[0]?.message?.content ?? '';
  // Some "thinking" models include their reasoning; only keep the actual answer.
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * Sends a conversation and returns { text, model }. `messages` are { role, content } objects.
 * With an empty Model setting, Mochi picks one itself, and picks again if that one disappears.
 */
async function chat(ai, messages) {
  const chosen = ai.model?.trim();
  if (chosen) return { text: await complete(ai, chosen, messages), model: chosen };

  const model = await autoModel(ai);
  try {
    return { text: await complete(ai, model, messages), model };
  } catch (err) {
    if (!err.modelMissing) throw err;
    const replacement = await autoModel(ai, { fresh: true });
    if (replacement === model) throw err;
    return { text: await complete(ai, replacement, messages), model: replacement };
  }
}

module.exports = { PROVIDERS, AiError, chat, listModels, pickModel };
