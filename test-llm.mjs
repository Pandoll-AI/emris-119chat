#!/usr/bin/env node
// 현재 .env의 LLM_PROVIDER 설정으로 /api/llm.js를 직접 호출하는 smoke test.
// 실행: node test-llm.mjs

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import handler from './api/llm.js';

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return false;

  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    value = value.replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

function makeRes(resolveResult) {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      resolveResult({ status: this.statusCode, body });
      return this;
    },
  };
}

async function callHandler() {
  return new Promise((resolveResult, reject) => {
    const req = {
      method: 'POST',
      headers: {
        'x-emris-token': process.env.EMRIS_API_KEY,
      },
      body: {
        system: 'You are a smoke test endpoint. Reply with a short Korean sentence.',
        messages: [{ role: 'user', content: 'LLM 연결이 정상인지 한 문장으로 답하세요.' }],
      },
    };

    Promise.resolve(handler(req, makeRes(resolveResult))).catch(reject);
  });
}

loadDotEnv();

const provider = process.env.LLM_PROVIDER || 'gemini';
const model =
  process.env.LLM_API_MODEL ||
  process.env.GEMINI_API_MODEL ||
  process.env.ZAI_API_MODEL ||
  process.env.XAI_API_MODEL ||
  process.env.OPENAI_API_MODEL ||
  process.env.LMSTUDIO_API_MODEL ||
  '(provider default)';

console.log(`LLM_PROVIDER=${provider}`);
console.log(`MODEL=${model}`);

if (!process.env.EMRIS_API_KEY) {
  console.error('EMRIS_API_KEY is required for the proxy auth check.');
  process.exit(1);
}

const result = await callHandler();
console.log(`STATUS=${result.status}`);

if (result.status !== 200) {
  console.error(JSON.stringify(result.body, null, 2));
  process.exit(1);
}

const text = result.body?.content?.[0]?.text || '';
console.log(text.slice(0, 500));
