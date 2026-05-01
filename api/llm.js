const PROVIDER_PREFIX = {
  gemini: 'GEMINI',
  openai: 'OPENAI',
  chatgpt: 'OPENAI',
  xai: 'XAI',
  'x.ai': 'XAI',
  zai: 'ZAI',
  'z.ai': 'ZAI',
  lmstudio: 'LMSTUDIO',
  'lm-studio': 'LMSTUDIO',
};

const OPENAI_COMPAT_DEFAULT_BASE_URL = {
  OPENAI: 'https://api.openai.com/v1',
  XAI: 'https://api.x.ai/v1',
  ZAI: 'https://api.z.ai/api/paas/v4',
  LMSTUDIO: 'http://127.0.0.1:1234/v1',
};

function readProvider() {
  return String(process.env.LLM_PROVIDER || 'gemini').trim().toLowerCase();
}

function envName(prefix, suffix) {
  return `${prefix}_${suffix}`;
}

function readNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function collectGeminiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

function chatMessages(messages, system) {
  const out = [];
  if (system) out.push({ role: 'system', content: String(system) });
  for (const m of messages) {
    if (!m || typeof m.content !== 'string') continue;
    const role = ['system', 'assistant', 'user'].includes(m.role) ? m.role : 'user';
    out.push({ role, content: m.content });
  }
  return out;
}

function geminiContents(messages) {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '') }],
  }));
}

function extractOpenAIText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('')
      .trim();
  }
  return undefined;
}

function extractGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts
    ?.map(part => part?.text || '')
    .join('')
    .trim();
}

function providerConfig(provider) {
  const prefix = PROVIDER_PREFIX[provider];
  if (!prefix) {
    return { error: `Unsupported LLM_PROVIDER: ${provider}` };
  }

  if (prefix === 'GEMINI') {
    const keys = collectGeminiKeys();
    if (!keys.length) return { error: 'Gemini API key not configured' };
    return {
      kind: 'gemini',
      model: process.env.GEMINI_API_MODEL || process.env.LLM_API_MODEL || 'gemini-2.5-flash-lite',
      key: keys[Math.floor(Math.random() * keys.length)],
      baseUrl: normalizeBaseUrl(process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'),
    };
  }

  const apiKey =
    process.env[envName(prefix, 'API_KEY')] ||
    process.env.LLM_API_KEY ||
    (prefix === 'LMSTUDIO' ? 'lm-studio' : '');
  const model = process.env[envName(prefix, 'API_MODEL')] || process.env.LLM_API_MODEL;
  const baseUrl = normalizeBaseUrl(
    process.env[envName(prefix, 'API_BASE_URL')] ||
    process.env.LLM_API_BASE_URL ||
    OPENAI_COMPAT_DEFAULT_BASE_URL[prefix]
  );

  if (!apiKey) return { error: `${prefix}_API_KEY not configured` };
  if (!model) return { error: `${prefix}_API_MODEL or LLM_API_MODEL not configured` };
  if (!baseUrl) return { error: `${prefix}_API_BASE_URL not configured` };

  return {
    kind: 'openai-compatible',
    provider,
    prefix,
    model,
    apiKey,
    baseUrl,
    maxTokensParam: process.env[envName(prefix, 'MAX_TOKENS_PARAM')] || process.env.LLM_MAX_TOKENS_PARAM || 'max_tokens',
  };
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    let data;
    try {
      data = await upstream.json();
    } catch (e) {
      const isTimeout = e?.name === 'AbortError';
      return {
        ok: false,
        status: isTimeout ? 504 : upstream.status,
        error: isTimeout
          ? 'LLM service timeout'
          : upstream.ok
            ? 'Upstream returned non-JSON response'
            : 'LLM request failed',
      };
    }
    return { ok: upstream.ok, status: upstream.status, data };
  } catch (e) {
    const isTimeout = e?.name === 'AbortError';
    return {
      ok: false,
      status: isTimeout ? 504 : 502,
      error: isTimeout ? 'LLM service timeout' : 'LLM service unavailable',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(config, messages, system, maxTokens, timeoutMs) {
  const body = {
    contents: geminiContents(messages),
    generationConfig: {
      maxOutputTokens: maxTokens,
    },
  };

  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const url = `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.key)}`;
  const result = await fetchJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs);

  if (!result.ok) return result;

  const text = extractGeminiText(result.data);
  if (text !== undefined && text !== '') return { ok: true, text };

  const blockReason = result.data?.candidates?.[0]?.finishReason;
  if (blockReason === 'SAFETY') {
    return { ok: false, status: 422, error: 'content_filtered', reason: 'safety' };
  }
  return { ok: false, status: 502, error: 'Unexpected upstream response format' };
}

async function callOpenAICompatible(config, messages, system, maxTokens, timeoutMs) {
  const body = {
    model: config.model,
    messages: chatMessages(messages, system),
    stream: false,
  };
  body[config.maxTokensParam] = maxTokens;

  const temperature = process.env[envName(config.prefix, 'TEMPERATURE')] || process.env.LLM_TEMPERATURE;
  if (temperature !== undefined) {
    const n = Number(temperature);
    if (Number.isFinite(n)) body.temperature = n;
  }

  const result = await fetchJson(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  }, timeoutMs);

  if (!result.ok) return result;

  const text = extractOpenAIText(result.data);
  if (text !== undefined && text !== '') return { ok: true, text };
  return { ok: false, status: 502, error: 'Unexpected upstream response format' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 프록시 접근 토큰 검증
  const expectedToken = process.env.EMRIS_API_KEY;
  const clientToken = req.headers['x-emris-token'];
  if (!expectedToken || clientToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { messages, system, type } = req.body ?? {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const bodyStr = JSON.stringify(messages);
  if (messages.length > 20 || Buffer.byteLength(bodyStr, 'utf8') > 32000) {
    return res.status(400).json({ error: 'Request too large' });
  }
  if (system && Buffer.byteLength(system, 'utf8') > 16000) {
    return res.status(400).json({ error: 'System prompt too large' });
  }

  const provider = readProvider();
  const config = providerConfig(provider);
  if (config.error) {
    return res.status(500).json({ error: 'LLM service not configured', detail: config.error });
  }

  const maxTokens = type === 'recommend' ? 3000 : 1500;
  const timeoutMs = readNumberEnv('LLM_TIMEOUT_MS', 30000);

  const result = config.kind === 'gemini'
    ? await callGemini(config, messages, system, maxTokens, timeoutMs)
    : await callOpenAICompatible(config, messages, system, maxTokens, timeoutMs);

  if (!result.ok) {
    if (result.status === 429) {
      return res.status(429).json({ error: 'rate_limit' });
    }
    if (result.status === 401 || result.status === 403 || result.status === 422) {
      return res.status(result.status).json({ error: result.error || 'LLM request failed', reason: result.reason });
    }
    return res.status(result.status >= 500 ? result.status : 502).json({
      error: result.error || 'LLM request failed',
      status: result.status,
    });
  }

  // 클라이언트 호환성 유지: provider와 무관하게 Anthropic-style content로 반환
  return res.status(200).json({
    content: [{ type: 'text', text: result.text }],
  });
}
