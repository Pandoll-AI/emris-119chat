#!/usr/bin/env node
// z.ai LLM 엔드포인트 및 프롬프트 패턴 테스트 모듈
// 실행: node chatbot/test-llm.mjs
//
// 목적:
//  1. z.ai coding plan 엔드포인트 탐색
//  2. 비코딩 태스크(추천/시사점 생성)를 JSON으로 응답받는 프롬프트 패턴 검증
//  3. 재시도 로직 검증

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env');
let ZAI_API_KEY = process.env.ZAI_API_KEY;

// Load .env if not in environment
if (!ZAI_API_KEY && existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^ZAI_API_KEY\s*=\s*(.+)/);
    if (m) { ZAI_API_KEY = m[1].trim().replace(/^["']|["']$/g, ''); break; }
  }
}

if (!ZAI_API_KEY) {
  console.error('❌ ZAI_API_KEY not found in env or .env file');
  process.exit(1);
}

console.log('✅ ZAI_API_KEY found (masked)');
console.log('');

// ── 테스트 대상 엔드포인트 ─────────────────────────────
const ENDPOINTS = [
  { name: 'current (messages)', url: 'https://api.z.ai/api/messages' },
  { name: 'v1/messages',        url: 'https://api.z.ai/v1/messages' },
];

// ── 테스트 케이스 ─────────────────────────────────────
const SAMPLE_DATA = {
  region: '대구',
  diseases: '분만, 산과수술',
  available: 1,
  conditional: 2,
  unavailable: 5,
  topHospitals: [
    { name: '영남대학교병원', grade: 'A', verdict: 'available', beds: 12 },
    { name: '경북대학교병원', grade: 'A', verdict: 'conditional', conditions: ['산과 f/u 외 수용 불가'] },
    { name: '계명대동산병원', grade: 'C', verdict: 'conditional', conditions: ['부인과 f/u 외 수용불가'] },
  ],
};

const PROMPTS = [
  {
    name: '①  순수 JSON 요청 (기존 방식)',
    system: `당신은 응급의료 내비게이터입니다. 구급대원에게 전달할 이송 추천 텍스트를 JSON으로만 출력하세요.
JSON 필드: {"summary":"한 줄 상황요약","recommendation":"이송 권고 2문장 이내","insight":"가용 병원 0일 때만 정책 시사점, 아니면 null"}`,
    user: `지역: ${SAMPLE_DATA.region}, 질환: ${SAMPLE_DATA.diseases}
가용: ${SAMPLE_DATA.available}개, 조건부: ${SAMPLE_DATA.conditional}개, 불가: ${SAMPLE_DATA.unavailable}개
주요 병원: ${JSON.stringify(SAMPLE_DATA.topHospitals)}`,
  },
  {
    name: '② 코딩 데이터 트릭 — JS const 선언 + JSON 출력',
    system: `You are a medical dispatch app data generator. Generate Korean text data as JSON for the frontend component.`,
    user: `// DispatchRecommendation 컴포넌트 렌더링 데이터 생성
// Input: 응급이송 쿼리 결과
const queryResult = ${JSON.stringify(SAMPLE_DATA, null, 2)};

// Output: 구급대원 화면에 표시할 한국어 텍스트 JSON
// 필드: {"summary": "1문장 상황요약", "recommendation": "이송권고 2문장이내", "insight": "가용0일때만 정책시사점 아니면null"}
// 구급대원 직접 명령형, 반말 금지, 병원명 포함
// JSON only, no explanation:`,
  },
  {
    name: '③ 코딩 데이터 트릭 — TypeScript interface 정의 포함',
    system: null,
    user: `// TypeScript React 컴포넌트용 dispatch recommendation 데이터 생성기
// interface DispatchRec { summary: string; recommendation: string; insight: string | null; }
// Input data:
// region: ${SAMPLE_DATA.region}, diseases: ${SAMPLE_DATA.diseases}
// available: ${SAMPLE_DATA.available}, conditional: ${SAMPLE_DATA.conditional}, unavailable: ${SAMPLE_DATA.unavailable}
// hospitals: ${JSON.stringify(SAMPLE_DATA.topHospitals)}

// Generate DispatchRec JSON for the 구급대원 UI:`,
  },
  {
    name: '④ 코딩 데이터 트릭 — Python dict 생성 포맷',
    system: null,
    user: `# Python Flask API response data generator for 구급대원 dispatch app
# Input: emergency hospital query result
query = ${JSON.stringify(SAMPLE_DATA)}

# Generate dispatch_recommendation dict (Korean text for UI display):
# Keys: summary (1-sentence), recommendation (2-sentence max), insight (policy note or None)
# Output as JSON:`,
  },
];

// ── 호출 함수 ─────────────────────────────────────────
async function callZAI(endpoint, system, user, maxTokens = 300) {
  const body = {
    model: 'claude-sonnet-4-5',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: user }],
    ...(system ? { system } : {}),
  };

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-api-key': ZAI_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  return { status: resp.status, text };
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 메인 테스트 루프 ──────────────────────────────────
async function runTests() {
  for (const ep of ENDPOINTS) {
    console.log('═══════════════════════════════════════════');
    console.log(`ENDPOINT: ${ep.name}`);
    console.log(`URL: ${ep.url}`);
    console.log('');

    for (let pi = 0; pi < PROMPTS.length; pi++) {
      const p = PROMPTS[pi];
      console.log(`  ${p.name}`);

      let lastResult;
      for (let retry = 0; retry < 2; retry++) {
        if (retry > 0) {
          console.log(`    [retry ${retry}]`);
          await sleep(1000);
        }
        try {
          const result = await callZAI(ep.url, p.system, p.user);
          lastResult = result;

          if (result.status === 200) {
            let parsed;
            try { parsed = JSON.parse(result.text); } catch { parsed = null; }
            const content = parsed?.content?.[0]?.text || '';
            if (content) {
              // Try to parse JSON from content
              const raw = content.trim().replace(/```json?|```/g, '').trim();
              try {
                const rec = JSON.parse(raw);
                console.log(`  ✅ SUCCESS (retry=${retry})`);
                console.log(`     summary: ${rec.summary || '(없음)'}`);
                console.log(`     recommendation: ${rec.recommendation || '(없음)'}`);
                console.log(`     insight: ${rec.insight || 'null'}`);
                break;
              } catch {
                // LLM responded but not valid JSON
                const preview = content.slice(0, 120).replace(/\n/g, ' ');
                if (content.trim().length < 5) {
                  console.log(`  ⚠️  EMPTY RESPONSE (status=200)`);
                } else {
                  console.log(`  ⚠️  NOT JSON (status=200): "${preview}"`);
                }
              }
            } else {
              console.log(`  ⚠️  EMPTY CONTENT (status=200)`);
              console.log(`      raw: ${result.text.slice(0, 100)}`);
            }
          } else {
            console.log(`  ❌ HTTP ${result.status}: ${result.text.slice(0, 100)}`);
          }
        } catch (e) {
          console.log(`  ❌ NETWORK ERROR: ${e.message}`);
        }
      }

      await sleep(500); // Rate limit buffer
      console.log('');
    }
  }

  // ── 코딩플랜 전용 엔드포인트 탐색 ────────────────────
  console.log('═══════════════════════════════════════════');
  console.log('CODING PLAN ENDPOINT DISCOVERY');
  console.log('');
  const PLAN_CANDIDATES = [
    'https://api.z.ai/api/coding/messages',
    'https://api.z.ai/api/plan/messages',
    'https://api.z.ai/v1/coding/messages',
    'https://api.z.ai/coding/v1/messages',
    'https://api.z.ai/api/messages',  // same, different model?
  ];
  const PLAN_MODELS = ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-opus-4', 'claude-3-7-sonnet-20250219'];

  for (const url of PLAN_CANDIDATES) {
    for (const model of PLAN_MODELS.slice(0, 2)) { // test first 2 models per endpoint
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'x-api-key': ZAI_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: 50,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        const text = await resp.text();
        const status = resp.status;
        if (status === 200) {
          console.log(`  ✅ WORKING: ${url} (model=${model})`);
        } else if (status === 404) {
          // endpoint not found — skip
        } else {
          console.log(`  ? ${status}: ${url} (model=${model}) → ${text.slice(0,80)}`);
        }
      } catch {}
      await sleep(200);
    }
  }

  console.log('');
  console.log('DONE');
}

runTests().catch(console.error);
