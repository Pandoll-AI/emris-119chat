export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 복수 키 라우터: GEMINI_API_KEY, GEMINI_API_KEY_1, _2, ... 에서 랜덤 선택
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  if (!keys.length) {
    return res.status(500).json({ error: 'LLM service not configured' });
  }
  const geminiKey = keys[Math.floor(Math.random() * keys.length)];

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

  const model = process.env.GEMINI_API_MODEL || 'gemini-2.5-flash-lite';
  const maxTokens = type === 'recommend' ? 3000 : 1500;

  // OpenAI messages → Gemini contents 변환
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const geminiBody = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
    },
  };

  // system prompt → Gemini systemInstruction
  if (system) {
    geminiBody.systemInstruction = { parts: [{ text: system }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000); // 30s (flash-lite는 빠름)

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
  } catch (e) {
    clearTimeout(timer);
    const isTimeout = e?.name === 'AbortError';
    return res.status(isTimeout ? 504 : 502).json({ error: isTimeout ? 'LLM service timeout' : 'LLM service unavailable' });
  }

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    clearTimeout(timer);
    const isTimeout = e?.name === 'AbortError';
    return res.status(isTimeout ? 504 : 502).json({ error: isTimeout ? 'LLM service timeout' : 'Upstream returned non-JSON response' });
  }
  clearTimeout(timer);

  if (!upstream.ok) {
    // 429 rate limit은 그대로 전달 (클라이언트가 재시도 UI 표시)
    if (upstream.status === 429) {
      return res.status(429).json({ error: 'rate_limit' });
    }
    return res.status(502).json({ error: 'LLM request failed', status: upstream.status });
  }

  // Gemini 응답 → Anthropic 포맷 변환 (클라이언트 호환성 유지)
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text !== undefined) {
    return res.status(200).json({
      content: [{ type: 'text', text }],
    });
  }

  // 안전 필터 등으로 빈 응답
  const blockReason = data.candidates?.[0]?.finishReason;
  if (blockReason === 'SAFETY') {
    return res.status(422).json({ error: 'content_filtered', reason: 'safety' });
  }

  return res.status(502).json({ error: 'Unexpected upstream response format' });
}
