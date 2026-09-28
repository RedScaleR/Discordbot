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
  return { provider, baseUrl, key, model: ai.model?.trim() || provider.defaultModel };
}

async function request(ai, path, options = {}) {
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
  if (response.status === 404 || /model/i.test(body)) {
    throw new AiError(
      ai.provider === 'ollama'
        ? `I can't find that AI model. Run "ollama pull ${resolve(ai).model}" on the PC, or pick another model in the dashboard.`
        : "That AI model isn't available. Pick another one in the dashboard!",
      detail,
    );
  }
  throw new AiError('The AI had a problem answering. Try again?', detail);
}

/** Sends a conversation and returns the reply text. `messages` are { role, content } objects. */
async function chat(ai, messages) {
  const { model } = resolve(ai);
  const data = await request(ai, '/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 500 }),
  });
  const text = data.choices?.[0]?.message?.content ?? '';
  // Some "thinking" models include their reasoning; only keep the actual answer.
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/** Lists the models the chosen provider offers (only the free ones on OpenRouter). */
async function listModels(ai) {
  const data = await request(ai, '/models');
  let ids = (data.data ?? data.models ?? []).map((model) => String(model.id ?? model.name ?? '').replace(/^models\//, ''));
  if (ai.provider === 'openrouter') ids = ids.filter((id) => id.endsWith(':free'));
  return [...new Set(ids.filter(Boolean))].sort();
}

module.exports = { PROVIDERS, AiError, chat, listModels };
