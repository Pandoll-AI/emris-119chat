import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function logFilePath() {
  const configured = process.env.CLIENT_LOG_FILE;
  if (configured) return resolve(process.cwd(), configured);
  if (process.env.VERCEL) return null;
  return resolve(process.cwd(), '.run/client-timing.jsonl');
}

function cleanString(value, maxLen = 200) {
  return String(value == null ? '' : value).slice(0, maxLen);
}

function cleanNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function cleanArray(value, maxItems = 12) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map(v => cleanString(v, 32)).filter(Boolean);
}

function writeClientLog(event) {
  const record = {
    ts: new Date().toISOString(),
    event: cleanString(event?.event || 'timing', 48),
    requestId: cleanString(event?.requestId, 64),
    mode: cleanString(event?.mode, 24),
    region: cleanString(event?.region, 16),
    diseases: cleanArray(event?.diseases),
    useLLM: !!event?.useLLM,
    ok: event?.ok === undefined ? null : !!event.ok,
    status: cleanNumber(event?.status),
    hospitals: cleanNumber(event?.hospitals),
    timings: {
      emrisMs: cleanNumber(event?.timings?.emrisMs),
      llmMs: cleanNumber(event?.timings?.llmMs),
      renderMs: cleanNumber(event?.timings?.renderMs),
      totalMs: cleanNumber(event?.timings?.totalMs),
    },
    error: event?.error ? cleanString(event.error, 160) : undefined,
  };
  const line = JSON.stringify(record);
  console.log('[client-timing]', line);

  const file = logFilePath();
  if (!file) return;
  try {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, line + '\n');
  } catch (e) {
    console.warn('[client-timing] failed to write log file:', e?.message || e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedToken = process.env.EMRIS_API_KEY;
  const clientToken = req.headers['x-emris-token'];
  if (!expectedToken || clientToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  writeClientLog(req.body || {});
  return res.status(204).end();
}
