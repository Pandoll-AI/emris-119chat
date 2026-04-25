#!/usr/bin/env node

/**
 * Pre-KTAS 병원 추천 standalone HTML (모바일 스텝 v2).
 *
 * 3 단계:
 *   1. Pre-KTAS 입력 — 연령 → 대분류 → 3단계 → 4단계 버튼 스텝.
 *   2. 추가 질문 — 질문 하나씩, 선택 즉시 Y후보·tier 좁혀짐 (live preview).
 *   3. 병원 목록 — 지역 선택 후 mock 병원 중 권장 리스트.
 *
 * 디자인: 모바일 우선, 컴팩트, 스크롤 최소화, 큰 터치 타겟.
 * 네비게이션: 헤더에 [← 이전] [단계/3] [↺ 처음] + 누적 코드.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const output = path.join(repoRoot, 'prektas-hospital-recommender.html');

const codebook = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/prektas-codebook.json'), 'utf8'));
const mapping = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/prektas-to-y-mapping.json'), 'utf8'));
const tierDoc = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/prektas-tier-recommendation.json'), 'utf8'));
const diseases = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/emris-severe-emergency-diseases.json'), 'utf8'));
const yTierDoc = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/y-code-to-center-tier.json'), 'utf8'));
const mockHospitals = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/mock-hospitals.json'), 'utf8'));

const recByCode = {};
for (const r of tierDoc.recommendations) recByCode[r.code] = r;

// 경량 entries: code·group·grade·level2·3·4만
const liteEntries = codebook.entries.map((e) => ({
  c: e.code, g: e.group, gr: e.grade,
  l2c: e.level2.code, l2n: e.level2.name,
  l3c: e.level3.code, l3n: e.level3.name,
  l4c: e.level4.code, l4n: e.level4.name,
}));

// 경량 recommendations: candidates · grade · level 이름만
const liteRec = {};
for (const k of Object.keys(recByCode)) {
  const r = recByCode[k];
  liteRec[k] = { y: r.y_candidates, gr: r.grade };
}

// Y-tier 룩업 압축
const yTier = {};
for (const t of yTierDoc.y_code_tiers) yTier[t.code] = t.acceptable;

// 질문 효과 — 특정 답변이 어느 Y코드를 살아남게 하는지 정의.
// keys = question id; values = { options: [ { y_keep: [Ycode, ...] | null } ] }
// y_keep: 이 옵션 선택 시 후보 중 이 리스트에 포함된 것만 남김. null이면 필터링 없음.
const questionEffects = {
  chest_pain_character: { options: [
    { y_keep: ['Y0010'] },                // 조이듯 압박성 → 심근경색만
    { y_keep: ['Y0041', 'Y0042'] },        // 찢어지듯 이동성 → 대동맥만
    { y_keep: null },                      // 비특이적 → 유지
  ]},
  aortic_location: { options: [
    { y_keep: ['Y0010', 'Y0041'] },        // 흉부
    { y_keep: ['Y0042'] },                 // 복부
  ]},
  onset_time_stroke: { options: [
    { y_keep: null },                      // <4.5h — 모두 유지
    { y_remove: ['Y0020'] },               // 4.5–24h — 재관류 탈락
    { y_remove: ['Y0020'] },               // >24h — 재관류 탈락
  ]},
  trauma_or_spontaneous: { options: [
    { y_keep: ['Y0032'] },                 // 외상성 → 뇌내출혈만
    { y_remove: ['Y0032'] },               // 비외상성/자발성 → 자발 뇌출혈 유지
  ]},
  pregnancy_status: { options: [
    { y_keep: ['Y0111', 'Y0112'] },        // 20주 미만
    { y_keep: ['Y0111', 'Y0112'] },        // 20주 이상
    { y_keep: ['Y0113'] },                 // 비임신 → 부인과
    { y_keep: null },                      // 미상 → 유지
  ]},
  foreign_body_site: { options: [
    { y_keep: ['Y0082'] },                 // 위장관
    { y_keep: ['Y0092'] },                 // 기도
  ]},
  burn_severity: { options: [
    { y_keep: ['Y0120'] },                 // 중증
    { y_remove: ['Y0120'] },               // 중등도
    { y_remove: ['Y0120'] },               // 경증
  ]},
  dialysis_indication: { options: [
    { y_keep: ['Y0141'] },
    { y_keep: ['Y0142'] },
    { y_remove: ['Y0141', 'Y0142'] },
  ]},
  replantation_part: { options: [
    { y_keep: ['Y0131'] },
    { y_keep: ['Y0132'] },
  ]},
  psychiatric_risk: { options: [
    { y_keep: ['Y0150'] },
    { y_remove: ['Y0150'] },
  ]},
  eye_emergency_kind: { options: [
    { y_keep: ['Y0160'] },
    { y_remove: ['Y0160'] },
  ]},
  onset_acute_or_chronic: { options: [
    { y_keep: null }, { y_keep: null },
  ]},
  bleeding_site: { options: [
    { y_keep: null }, { y_keep: null }, { y_keep: null },
  ]},
};

const payload = {
  codebook_version: codebook.version,
  tier_version: tierDoc.version,
  tier_definitions: tierDoc.tier_definitions,
  strategy_definitions: tierDoc.strategy_definitions,
  questions: mapping.question_catalog,
  question_effects: questionEffects,
  diseases: diseases.diseases,
  y_tier: yTier,
  entries: liteEntries,
  rec: liteRec,
  hospitals: mockHospitals.hospitals,
  regions: mockHospitals.regions,
};

const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Pre-KTAS 병원 추천</title>
<style>
  :root {
    --ink: #0a0a0a;
    --bg: #fafaf8;
    --surface: #ffffff;
    --dim: #6b6b68;
    --line: rgba(10,10,10,0.12);
    --line-soft: rgba(10,10,10,0.06);
    --accent: #a8231c;
    --ok: #1d6b3f;
    --tier-regional: #a8231c;
    --tier-local-center: #8b4238;
    --tier-local-institution: #5a4a42;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html, body { height: 100%; overscroll-behavior: none; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: "Pretendard", -apple-system, "Apple SD Gothic Neo", "Helvetica Neue", sans-serif;
    font-size: 15px;
    line-height: 1.4;
    font-feature-settings: "tnum";
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: 520px;
    margin: 0 auto;
    border-left: 1px solid var(--line);
    border-right: 1px solid var(--line);
  }
  button { font-family: inherit; color: inherit; background: none; border: none; cursor: pointer; font-size: inherit; }
  a { color: inherit; text-decoration: none; border-bottom: 1px solid currentColor; }

  /* ── Header ── */
  header {
    flex: 0 0 auto;
    padding: 10px 14px 8px;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
    display: grid;
    gap: 6px;
  }
  .nav-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .nav-btn {
    font-size: 13px;
    padding: 6px 10px;
    min-width: 52px;
    min-height: 32px;
    border: 1px solid var(--line);
    color: var(--ink);
    background: var(--surface);
  }
  .nav-btn:disabled { color: var(--line); border-color: var(--line-soft); }
  .nav-btn:active { background: var(--bg); }
  .step-indicator {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 700;
  }
  .code-strip {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.1em;
    display: flex;
    gap: 4px;
    align-items: baseline;
  }
  .code-strip .ch { min-width: 14px; text-align: center; color: var(--ink); }
  .code-strip .ch.empty { color: var(--line); }
  .code-strip .meta { font-family: inherit; font-size: 11px; color: var(--dim); font-weight: 500; letter-spacing: 0; margin-left: 8px; }

  /* ── Stage container ── */
  main {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 16px 14px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .stage { display: flex; flex-direction: column; gap: 12px; }

  .prompt {
    font-size: 18px;
    font-weight: 800;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }
  .prompt .hint { display: block; font-size: 12px; color: var(--dim); font-weight: 500; margin-top: 4px; letter-spacing: 0; }

  /* ── Button grids ── */
  .btn-grid { display: grid; gap: 8px; }
  .btn-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
  .btn-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .btn-grid.cols-1 { grid-template-columns: 1fr; }

  .opt-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    padding: 12px 12px;
    min-height: 56px;
    border: 1px solid var(--line);
    background: var(--surface);
    text-align: left;
    transition: border-color .12s, background-color .12s;
    cursor: pointer;
  }
  .opt-btn:active { background: var(--bg); }
  .opt-btn.primary { border-color: var(--ink); }
  .opt-btn.primary:active { background: var(--ink); color: #fff; }
  .opt-btn .opt-code {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: var(--dim);
    letter-spacing: 0.04em;
  }
  .opt-btn .opt-label {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
  }
  .opt-btn .opt-grade {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }

  /* ── Stage 2: context panel ── */
  .context-card {
    border: 1px solid var(--ink);
    background: var(--surface);
    padding: 12px 14px 10px;
    display: grid;
    gap: 6px;
  }
  .context-title {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 700;
  }
  .context-code {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .context-code .mono {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .ctx-grade {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    padding: 2px 7px;
    border: 1px solid var(--accent);
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .context-path {
    font-size: 12.5px;
    color: var(--ink);
    line-height: 1.35;
  }
  .context-sub {
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 700;
    margin-top: 4px;
  }
  .context-y-list { display: grid; gap: 3px; margin-top: 2px; }
  .ctx-y-row {
    display: grid;
    grid-template-columns: 52px 1fr;
    gap: 8px;
    font-size: 12px;
    line-height: 1.35;
    padding: 1px 0;
  }
  .ctx-y-row .mono {
    font-family: ui-monospace, monospace;
    font-weight: 700;
    font-size: 11.5px;
  }
  .ctx-y-row.dimmed { opacity: 0.4; text-decoration: line-through; }
  .context-none {
    font-size: 12px;
    color: var(--dim);
    line-height: 1.45;
    padding-top: 2px;
    border-top: 1px solid var(--line-soft);
  }

  .info-msg {
    font-size: 13px;
    color: var(--dim);
    padding: 14px;
    border: 1px dashed var(--line);
    text-align: center;
  }
  .q-section-title {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 700;
    padding-top: 4px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .q-section-title .count { color: var(--ink); font-weight: 800; }

  /* ── Stage 2: question cards with narrowing preview ── */
  .question-card {
    border: 1px solid var(--line);
    background: var(--surface);
    padding: 14px 14px 10px;
    display: grid;
    gap: 10px;
  }
  .q-counter {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 700;
    display: flex;
    justify-content: space-between;
  }
  .q-prompt { font-size: 15px; font-weight: 700; line-height: 1.3; }
  .q-purpose { font-size: 12px; color: var(--dim); line-height: 1.4; }
  .q-options { display: grid; gap: 6px; }
  .q-opt-btn {
    padding: 10px 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    text-align: left;
    font-size: 13.5px;
    min-height: 44px;
    transition: border-color .1s, background-color .1s;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .q-opt-btn:active { background: var(--bg); }
  .q-opt-btn.selected { border-color: var(--ink); background: var(--ink); color: #fff; font-weight: 600; }
  .q-opt-btn .q-opt-text { font-weight: 500; }
  .q-opt-btn.selected .q-opt-text { font-weight: 700; }
  .q-opt-btn .q-opt-preview {
    font-size: 11px;
    color: var(--dim);
    letter-spacing: 0.01em;
    font-weight: 500;
  }
  .q-opt-btn.selected .q-opt-preview { color: rgba(255,255,255,0.85); }

  .q-skip {
    font-size: 12px;
    color: var(--dim);
    padding: 4px 0;
    border-bottom: 1px solid var(--line-soft);
    align-self: flex-end;
  }

  /* Live preview under questions */
  .live-preview {
    position: sticky;
    bottom: 0;
    margin: 4px -14px -24px;
    padding: 12px 14px 16px;
    background: var(--surface);
    border-top: 1px solid var(--ink);
    display: grid;
    gap: 8px;
  }
  .live-preview .lp-label {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 700;
  }
  .live-tier {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }
  .live-tier .tier-name { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
  .live-tier.regional .tier-name { color: var(--tier-regional); }
  .live-tier.local_center .tier-name { color: var(--tier-local-center); }
  .live-tier.local_institution .tier-name { color: var(--tier-local-institution); }
  .live-tier .tier-alt { font-size: 11.5px; color: var(--dim); }
  .live-rationale {
    font-size: 12px;
    color: var(--ink);
    line-height: 1.4;
    padding: 6px 10px;
    background: var(--bg);
    border-left: 2px solid var(--ink);
  }
  .live-y { display: flex; gap: 4px; flex-wrap: wrap; }
  .live-y .y-pill { font-family: ui-monospace, monospace; font-size: 11px; padding: 2px 6px; border: 1px solid var(--line); background: var(--bg); }
  .live-y .y-pill.removed { text-decoration: line-through; color: var(--line); }

  .continue-bar { display: flex; gap: 8px; margin-top: 8px; }
  .continue-btn {
    flex: 1;
    padding: 12px;
    background: var(--ink);
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    min-height: 44px;
    letter-spacing: 0.02em;
  }
  .continue-btn:disabled { background: var(--dim); }
  .continue-btn:active { background: var(--accent); }

  /* ── Stage 3: hospitals ── */
  .region-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .region-btn {
    padding: 8px 6px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-size: 12px;
    min-height: 36px;
  }
  .region-btn.active { background: var(--ink); color: #fff; border-color: var(--ink); font-weight: 700; }
  .hospital-list { display: grid; gap: 8px; }
  .hospital-card {
    border: 1px solid var(--line);
    background: var(--surface);
    padding: 12px 12px 10px;
    display: grid;
    gap: 4px;
  }
  .hospital-card.recommended { border-color: var(--ink); border-width: 2px; padding: 11px; }
  .hospital-card .h-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .hospital-card .h-name { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
  .hospital-card .h-tier { font-size: 11px; padding: 2px 6px; border: 1px solid currentColor; font-weight: 600; white-space: nowrap; }
  .hospital-card .h-tier.regional { color: var(--tier-regional); }
  .hospital-card .h-tier.local_center { color: var(--tier-local-center); }
  .hospital-card .h-tier.local_institution { color: var(--tier-local-institution); }
  .hospital-card .h-meta {
    font-size: 11.5px;
    color: var(--dim);
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .hospital-card .h-meta .ok { color: var(--ok); font-weight: 600; }
  .hospital-card .h-meta .ng { color: var(--accent); font-weight: 600; }
  .recommend-badge { font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); font-weight: 800; }

  .empty-msg { color: var(--dim); font-size: 13px; text-align: center; padding: 32px 12px; border: 1px dashed var(--line); }
  .safety-foot {
    font-size: 11px;
    color: var(--dim);
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--line);
    line-height: 1.45;
  }
  .safety-foot b { color: var(--accent); font-weight: 700; }

  /* ── Stage 1 sub progress ── */
  .substep-breadcrumb {
    display: flex;
    gap: 4px;
    font-size: 11px;
    color: var(--dim);
    letter-spacing: 0.02em;
    overflow-x: auto;
    white-space: nowrap;
    padding-bottom: 2px;
  }
  .substep-breadcrumb .crumb { padding: 1px 0; }
  .substep-breadcrumb .crumb.active { color: var(--ink); font-weight: 700; }
  .substep-breadcrumb .sep { color: var(--line); }

  .research-banner {
    background: var(--bg);
    border-bottom: 1px solid var(--line);
    color: var(--dim);
    font-size: 11.5px;
    padding: 8px 14px;
    line-height: 1.5;
    letter-spacing: 0.01em;
  }
  .research-banner strong { color: var(--accent); font-weight: 700; }
</style>
</head>
<body>
<div class="research-banner">
  📚 <strong>교육·연구용</strong> · 결정론적 Pre-KTAS → 응급의료센터 등급 추천 도구.
  실시간 병상 데이터·LLM 분석은 <a href="/" style="color:inherit;text-decoration:underline;">EMRIS 챗봇</a>에서.
</div>
<header>
  <div class="nav-row">
    <button class="nav-btn" id="btn-back">← 이전</button>
    <div class="step-indicator" id="step-indicator">1 · Pre-KTAS 입력</div>
    <button class="nav-btn" id="btn-home">↺ 처음</button>
  </div>
  <div class="code-strip" id="code-strip"></div>
</header>
<main id="main"></main>
<script>
const DATA = ${payloadJson};
const $ = (id) => document.getElementById(id);

/*
 * State machine:
 *   stage: 'group' | 'l2' | 'l3' | 'l4' | 'questions' | 'region' | 'hospitals'
 *   history: stack of stages for [이전]
 */
const state = {
  stage: 'group',
  history: [],
  group: null, l2: null, l3: null, l4: null,
  code: null,
  answers: {},  // qid → optionIndex
  qIndex: 0,
  qids: [],
  region: null,
};

const STAGE_LABEL = {
  group: '1 · 연령군',
  l2: '1 · 대분류',
  l3: '1 · 주호소',
  l4: '1 · 세부증상',
  questions: '2 · 추가 질문',
  region: '3 · 지역 선택',
  hospitals: '3 · 병원 추천',
};

/* ── indexing ── */
const byGroup = { adult: [], pediatric: [] };
for (const e of DATA.entries) byGroup[e.g].push(e);

function uniqL2(es) {
  const m = new Map();
  for (const e of es) if (!m.has(e.l2c)) m.set(e.l2c, e.l2n);
  return Array.from(m.entries()).sort().map(([c, n]) => ({ c, n }));
}
function uniqL3(es, l2c) {
  const m = new Map();
  for (const e of es) { if (e.l2c !== l2c) continue; if (!m.has(e.l3c)) m.set(e.l3c, e.l3n); }
  return Array.from(m.entries()).sort().map(([c, n]) => ({ c, n }));
}
function uniqL4(es, l2c, l3c) {
  const out = [];
  for (const e of es) if (e.l2c === l2c && e.l3c === l3c) out.push({ c: e.l4c, n: e.l4n, gr: e.gr });
  return out.sort((a, b) => a.c.localeCompare(b.c));
}

function computeCode() {
  if (state.group && state.l2 && state.l3 && state.l4) {
    const p = state.group === 'adult' ? 'C' : 'D';
    return p + state.l2 + state.l3 + state.l4;
  }
  return null;
}

/* ── question effects → narrow candidates ── */
function currentCandidates() {
  const code = state.code;
  if (!code || !DATA.rec[code]) return { ycodes: [], removed: new Set() };
  const baseline = DATA.rec[code].y;
  const kept = new Set(baseline);
  const removed = new Set();
  for (const qid of Object.keys(state.answers)) {
    const optIdx = state.answers[qid];
    const effectDef = DATA.question_effects[qid];
    if (!effectDef || !effectDef.options[optIdx]) continue;
    const eff = effectDef.options[optIdx];
    if (eff.y_keep) {
      const keepSet = new Set(eff.y_keep);
      for (const y of Array.from(kept)) {
        if (!keepSet.has(y)) { kept.delete(y); removed.add(y); }
      }
    }
    if (eff.y_remove) {
      for (const y of eff.y_remove) {
        if (kept.has(y)) { kept.delete(y); removed.add(y); }
      }
    }
  }
  return { ycodes: Array.from(kept), removed };
}

/* ── tier from narrowed candidates ── */
function computeTier(ycodes, grade) {
  if (ycodes.length > 0) {
    let accept = new Set(DATA.y_tier[ycodes[0]]);
    const firstOrder = DATA.y_tier[ycodes[0]].slice();
    for (let i = 1; i < ycodes.length; i += 1) {
      const s = new Set(DATA.y_tier[ycodes[i]]);
      accept = new Set([...accept].filter((x) => s.has(x)));
    }
    const ordered = firstOrder.filter((x) => accept.has(x));
    const key = ordered.join(',');
    let strategy = 'regional_only';
    if (key === 'regional,local_center') strategy = 'regional_or_local_center';
    return { acceptable: ordered, preferred: ordered[0], strategy };
  }
  if (grade === 1 || grade === 2) return { acceptable: ['regional', 'local_center'], preferred: 'regional', strategy: 'regional_or_local_center' };
  if (grade === 3) return { acceptable: ['local_center', 'local_institution'], preferred: 'local_center', strategy: 'local_center_preferred' };
  return { acceptable: ['local_institution', 'local_center'], preferred: 'local_institution', strategy: 'local_institution_preferred' };
}

/* ── relevant question ids for this code ── */
function findQuestionIds(code) {
  if (!code) return [];
  const rec = DATA.rec[code];
  if (!rec || rec.y.length === 0) return [];
  const cands = new Set(rec.y);
  const qids = new Set();
  if (cands.has('Y0010') || cands.has('Y0041')) { qids.add('chest_pain_character'); qids.add('aortic_location'); }
  if (cands.has('Y0020') || cands.has('Y0031') || cands.has('Y0032')) { qids.add('trauma_or_spontaneous'); qids.add('onset_time_stroke'); }
  if (cands.has('Y0111') || cands.has('Y0112') || cands.has('Y0113')) qids.add('pregnancy_status');
  if (cands.has('Y0082') && cands.has('Y0092')) qids.add('foreign_body_site');
  if (cands.has('Y0131') || cands.has('Y0132')) qids.add('replantation_part');
  if (cands.has('Y0120')) qids.add('burn_severity');
  if (cands.has('Y0141') || cands.has('Y0142')) qids.add('dialysis_indication');
  if (cands.has('Y0150')) qids.add('psychiatric_risk');
  if (cands.has('Y0160')) qids.add('eye_emergency_kind');
  return Array.from(qids).slice(0, 3);
}

/* ── rendering helpers ── */
function setHeader() {
  $('step-indicator').textContent = STAGE_LABEL[state.stage] || '';
  const strip = $('code-strip');
  strip.innerHTML = '';
  const fullCode = computeCode();
  const display = fullCode
    ? fullCode
    : (state.group === 'adult' ? 'C' : state.group === 'pediatric' ? 'D' : '_') +
      (state.l2 || '_') + (state.l3 || '_') + (state.l4 ? state.l4 : '__');
  for (const ch of display) {
    const sp = document.createElement('span');
    sp.className = 'ch' + (ch === '_' ? ' empty' : '');
    sp.textContent = ch;
    strip.appendChild(sp);
  }
  if (fullCode) {
    const e = DATA.entries.find((x) => x.c === fullCode);
    if (e) {
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = 'g' + e.gr + ' · ' + e.l4n;
      strip.appendChild(meta);
    }
  }
  $('btn-back').disabled = state.history.length === 0;
  $('btn-home').disabled = state.stage === 'group' && state.history.length === 0;
}

function pushStage(next) {
  state.history.push(state.stage);
  state.stage = next;
  render();
}
function goBack() {
  if (state.history.length === 0) return;
  const prev = state.history.pop();
  state.stage = prev;
  // 이전 선택은 유지. 단 질문 답변은 이전 단계로 갈 때 유지.
  render();
}
function goHome() {
  state.stage = 'group';
  state.history = [];
  state.group = state.l2 = state.l3 = state.l4 = state.code = null;
  state.answers = {};
  state.qIndex = 0;
  state.qids = [];
  state.region = null;
  render();
}

function makeOptBtn({ code, label, grade, onClick, cls = 'opt-btn' }) {
  const btn = document.createElement('button');
  btn.className = cls;
  btn.type = 'button';
  if (code) {
    const c = document.createElement('span');
    c.className = 'opt-code';
    c.textContent = code;
    btn.appendChild(c);
  }
  const l = document.createElement('span');
  l.className = 'opt-label';
  l.textContent = label;
  btn.appendChild(l);
  if (grade != null) {
    const g = document.createElement('span');
    g.className = 'opt-grade';
    g.textContent = 'grade ' + grade;
    btn.appendChild(g);
  }
  btn.addEventListener('click', onClick);
  return btn;
}

function renderStage1Group(main) {
  const stage = document.createElement('div');
  stage.className = 'stage';
  const p = document.createElement('div');
  p.className = 'prompt';
  p.innerHTML = '연령군을 선택하세요<span class="hint">성인(C) / 소아(D) Pre-KTAS 체계 분기</span>';
  stage.appendChild(p);
  const grid = document.createElement('div');
  grid.className = 'btn-grid cols-2';
  grid.appendChild(makeOptBtn({
    code: 'C',
    label: '성인',
    onClick: () => { state.group = 'adult'; pushStage('l2'); },
    cls: 'opt-btn primary',
  }));
  grid.appendChild(makeOptBtn({
    code: 'D',
    label: '소아',
    onClick: () => { state.group = 'pediatric'; pushStage('l2'); },
    cls: 'opt-btn primary',
  }));
  stage.appendChild(grid);
  main.appendChild(stage);
}

function renderStage1L2(main) {
  const stage = document.createElement('div');
  stage.className = 'stage';
  const opts = uniqL2(byGroup[state.group]);
  const p = document.createElement('div');
  p.className = 'prompt';
  p.innerHTML = '대분류를 선택하세요<span class="hint">정본 Pre-KTAS ' + opts.length + '개 카테고리</span>';
  stage.appendChild(p);
  const grid = document.createElement('div');
  grid.className = 'btn-grid cols-2';
  for (const o of opts) {
    grid.appendChild(makeOptBtn({
      code: o.c,
      label: o.n,
      onClick: () => { state.l2 = o.c; pushStage('l3'); },
    }));
  }
  stage.appendChild(grid);
  main.appendChild(stage);
}

function renderStage1L3(main) {
  const stage = document.createElement('div');
  stage.className = 'stage';
  const opts = uniqL3(byGroup[state.group], state.l2);
  const l2Name = (opts.length && byGroup[state.group].find((e) => e.l2c === state.l2)?.l2n) || '';
  const p = document.createElement('div');
  p.className = 'prompt';
  p.innerHTML = '주호소를 선택하세요<span class="hint">' + escapeHtml(l2Name) + ' 아래 정본 ' + opts.length + '개 주호소만 표시</span>';
  stage.appendChild(p);
  const grid = document.createElement('div');
  grid.className = 'btn-grid cols-2';
  for (const o of opts) {
    grid.appendChild(makeOptBtn({
      code: o.c,
      label: o.n,
      onClick: () => { state.l3 = o.c; pushStage('l4'); },
    }));
  }
  stage.appendChild(grid);
  main.appendChild(stage);
}

function renderStage1L4(main) {
  const stage = document.createElement('div');
  stage.className = 'stage';
  const opts = uniqL4(byGroup[state.group], state.l2, state.l3);
  const sample = byGroup[state.group].find((e) => e.l2c === state.l2 && e.l3c === state.l3);
  const pathLabel = sample ? (sample.l2n + ' → ' + sample.l3n) : '';
  const p = document.createElement('div');
  p.className = 'prompt';
  p.innerHTML = '세부증상을 선택하세요<span class="hint">' + escapeHtml(pathLabel) + ' 조합에 정본 등록된 ' + opts.length + '개 세부증상. 선택 시 Pre-KTAS 코드 완성.</span>';
  stage.appendChild(p);
  const grid = document.createElement('div');
  grid.className = 'btn-grid cols-1';
  for (const o of opts) {
    grid.appendChild(makeOptBtn({
      code: o.c,
      label: o.n,
      grade: o.gr,
      onClick: () => {
        state.l4 = o.c;
        state.code = computeCode();
        state.qids = findQuestionIds(state.code);
        state.answers = {};
        state.qIndex = 0;
        pushStage('questions');
      },
    }));
  }
  stage.appendChild(grid);
  main.appendChild(stage);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function simulateNarrow(qid, optIdx) {
  // 특정 질문의 특정 옵션을 가정할 때 survive할 Y 집합 계산 (preview용)
  const baseline = state.code && DATA.rec[state.code] ? DATA.rec[state.code].y : [];
  if (baseline.length === 0) return { kept: [], removed: [] };
  const simAnswers = Object.assign({}, state.answers);
  simAnswers[qid] = optIdx;
  const kept = new Set(baseline);
  const removed = new Set();
  for (const qk of Object.keys(simAnswers)) {
    const eff = DATA.question_effects[qk] && DATA.question_effects[qk].options[simAnswers[qk]];
    if (!eff) continue;
    if (eff.y_keep) {
      const keepSet = new Set(eff.y_keep);
      for (const y of Array.from(kept)) if (!keepSet.has(y)) { kept.delete(y); removed.add(y); }
    }
    if (eff.y_remove) {
      for (const y of eff.y_remove) if (kept.has(y)) { kept.delete(y); removed.add(y); }
    }
  }
  return { kept: Array.from(kept), removed: Array.from(removed) };
}

function yShort(y) {
  const d = DATA.diseases.find((x) => x.code === y);
  return d ? (d.short || d.label) : y;
}

function tierRationaleText(ycodes, grade, removedArr) {
  const rec = state.code && DATA.rec[state.code] ? DATA.rec[state.code] : null;
  const initial = rec ? rec.y : [];
  const parts = [];
  if (initial.length > 0) {
    parts.push('초기 Y후보 ' + initial.length + '개(' + initial.join(', ') + ')에서 출발.');
  } else {
    parts.push('27 Y코드에 해당 없음 → grade ' + grade + ' 기반 tier.');
  }
  if (removedArr && removedArr.length > 0) {
    parts.push('답변으로 ' + removedArr.join(', ') + ' 제외.');
  }
  if (ycodes.length > 0) {
    const allRegional = ycodes.every((y) => {
      const t = DATA.y_tier[y];
      return t && t.length === 1 && t[0] === 'regional';
    });
    if (allRegional) parts.push('생존한 Y(' + ycodes.join(', ') + ') 모두 권역 전용 → 권역센터만 가능.');
    else parts.push('생존한 Y(' + ycodes.join(', ') + ')는 권역·지역센터 공동 커버 가능.');
  } else if (initial.length > 0) {
    parts.push('모든 Y후보 제외됨 → grade ' + grade + ' 기반 fallback.');
  }
  return parts.join(' ');
}

function renderStage2Questions(main) {
  const stage = document.createElement('div');
  stage.className = 'stage';

  const e = DATA.entries.find((x) => x.c === state.code);
  const grade = e ? e.gr : 0;
  const { ycodes, removed } = currentCandidates();
  const removedArr = Array.from(removed);
  const tier = computeTier(ycodes, grade);
  const tierDef = DATA.tier_definitions[tier.preferred];
  const baseline = state.code && DATA.rec[state.code] ? DATA.rec[state.code].y : [];

  /* ── 상단: 현재 맥락 카드 ── */
  const ctx = document.createElement('div');
  ctx.className = 'context-card';
  const ctxTitle = document.createElement('div');
  ctxTitle.className = 'context-title';
  ctxTitle.textContent = '증상 요약';
  ctx.appendChild(ctxTitle);
  const ctxCode = document.createElement('div');
  ctxCode.className = 'context-code';
  const codeSpan = document.createElement('span');
  codeSpan.className = 'mono';
  codeSpan.textContent = state.code;
  ctxCode.appendChild(codeSpan);
  const gradeSpan = document.createElement('span');
  gradeSpan.className = 'ctx-grade';
  gradeSpan.textContent = 'grade ' + grade;
  ctxCode.appendChild(gradeSpan);
  ctx.appendChild(ctxCode);
  if (e) {
    const path = document.createElement('div');
    path.className = 'context-path';
    path.textContent = e.l2n + ' · ' + e.l3n + ' · ' + e.l4n;
    ctx.appendChild(path);
  }
  if (baseline.length > 0) {
    const yTitle = document.createElement('div');
    yTitle.className = 'context-sub';
    yTitle.textContent = '초기 Y후보 (EMRIS 27 중 ' + baseline.length + '개)';
    ctx.appendChild(yTitle);
    const yList = document.createElement('div');
    yList.className = 'context-y-list';
    for (const y of baseline) {
      const d = DATA.diseases.find((x) => x.code === y);
      const row = document.createElement('div');
      row.className = 'ctx-y-row' + (removed.has(y) ? ' dimmed' : '');
      const code = document.createElement('span');
      code.className = 'mono';
      code.textContent = y;
      const label = document.createElement('span');
      label.textContent = d ? d.label : '(정의 없음)';
      row.appendChild(code);
      row.appendChild(label);
      yList.appendChild(row);
    }
    ctx.appendChild(yList);
  } else {
    const none = document.createElement('div');
    none.className = 'context-none';
    none.textContent = '해당 Pre-KTAS 코드는 EMRIS 27 중증응급질환 Y코드와 연결되지 않음. grade 기반 tier로 배정.';
    ctx.appendChild(none);
  }
  stage.appendChild(ctx);

  if (state.qids.length === 0) {
    const p = document.createElement('div');
    p.className = 'info-msg';
    p.textContent = '추가 질문이 필요 없습니다. Pre-KTAS 코드 자체로 tier 결정 가능.';
    stage.appendChild(p);
  } else {
    const intro = document.createElement('div');
    intro.className = 'q-section-title';
    intro.innerHTML = '추가 질문 <span class="count">' + state.qids.length + '개</span>';
    stage.appendChild(intro);

    const shown = Math.min(state.qIndex + 1, state.qids.length);
    for (let i = 0; i < shown; i += 1) {
      const qid = state.qids[i];
      const q = DATA.questions[qid];
      if (!q) continue;
      const card = document.createElement('div');
      card.className = 'question-card';

      const counter = document.createElement('div');
      counter.className = 'q-counter';
      counter.innerHTML = '<span>질문 ' + (i + 1) + ' / ' + state.qids.length + '</span><span>' + qid + '</span>';
      card.appendChild(counter);

      const prompt = document.createElement('div');
      prompt.className = 'q-prompt';
      prompt.textContent = q.prompt;
      card.appendChild(prompt);

      const purpose = document.createElement('div');
      purpose.className = 'q-purpose';
      purpose.textContent = q.purpose;
      card.appendChild(purpose);

      const opts = document.createElement('div');
      opts.className = 'q-options';
      q.options.forEach((optText, idx) => {
        const btn = document.createElement('button');
        btn.className = 'q-opt-btn' + (state.answers[qid] === idx ? ' selected' : '');
        btn.type = 'button';
        const top = document.createElement('div');
        top.className = 'q-opt-text';
        top.textContent = optText;
        btn.appendChild(top);
        // Narrowing preview
        const sim = simulateNarrow(qid, idx);
        const preview = document.createElement('div');
        preview.className = 'q-opt-preview';
        if (sim.kept.length === 0 && baseline.length > 0) {
          preview.textContent = '→ 모든 Y후보 제외됨 (grade ' + grade + ' 기반)';
        } else if (sim.kept.length === baseline.length) {
          preview.textContent = '→ Y후보 유지 (' + sim.kept.length + '개)';
        } else {
          preview.textContent = '→ Y후보 ' + sim.kept.length + '개 생존: ' + sim.kept.map(yShort).join(' · ');
        }
        btn.appendChild(preview);
        btn.addEventListener('click', () => {
          state.answers[qid] = idx;
          if (i === state.qIndex && state.qIndex < state.qids.length - 1) state.qIndex += 1;
          render();
        });
        opts.appendChild(btn);
      });
      card.appendChild(opts);
      stage.appendChild(card);
    }

    if (state.qIndex < state.qids.length - 1) {
      const skip = document.createElement('button');
      skip.className = 'q-skip';
      skip.type = 'button';
      skip.textContent = '이 질문 건너뛰기 →';
      skip.addEventListener('click', () => { state.qIndex += 1; render(); });
      stage.appendChild(skip);
    }
  }

  /* ── 하단 sticky preview: tier + 근거 서술 ── */
  const preview = document.createElement('div');
  preview.className = 'live-preview';

  const ptitle = document.createElement('div');
  ptitle.className = 'lp-label';
  ptitle.textContent = '현재 추천';
  preview.appendChild(ptitle);

  const tierRow = document.createElement('div');
  tierRow.className = 'live-tier ' + tier.preferred;
  const tn = document.createElement('span');
  tn.className = 'tier-name';
  tn.textContent = tierDef.label;
  tierRow.appendChild(tn);
  for (let i = 1; i < tier.acceptable.length; i += 1) {
    const alt = document.createElement('span');
    alt.className = 'tier-alt';
    alt.textContent = '+ ' + DATA.tier_definitions[tier.acceptable[i]].short + ' 가능';
    tierRow.appendChild(alt);
  }
  preview.appendChild(tierRow);

  // Rationale 서술
  const rationale = document.createElement('div');
  rationale.className = 'live-rationale';
  rationale.textContent = tierRationaleText(ycodes, grade, removedArr);
  preview.appendChild(rationale);

  // Y pills
  if (baseline.length > 0) {
    const yWrap = document.createElement('div');
    yWrap.className = 'live-y';
    for (const y of baseline) {
      const pill = document.createElement('span');
      pill.className = 'y-pill' + (removed.has(y) ? ' removed' : '');
      pill.textContent = y;
      const d = DATA.diseases.find((x) => x.code === y);
      if (d) pill.title = d.label;
      yWrap.appendChild(pill);
    }
    preview.appendChild(yWrap);
  }

  const bar = document.createElement('div');
  bar.className = 'continue-bar';
  const cont = document.createElement('button');
  cont.className = 'continue-btn';
  cont.type = 'button';
  cont.textContent = '병원 추천 보기 →';
  cont.addEventListener('click', () => pushStage('region'));
  bar.appendChild(cont);
  preview.appendChild(bar);

  stage.appendChild(preview);
  main.appendChild(stage);
}

function renderStage3Region(main) {
  const stage = document.createElement('div');
  stage.className = 'stage';
  const p = document.createElement('div');
  p.className = 'prompt';
  p.innerHTML = '환자 지역을 선택하세요<span class="hint">Mock 데이터 — 실데이터 통합은 다음 phase</span>';
  stage.appendChild(p);

  const grid = document.createElement('div');
  grid.className = 'region-grid';
  const all = document.createElement('button');
  all.className = 'region-btn';
  all.type = 'button';
  all.textContent = '전체';
  all.addEventListener('click', () => { state.region = null; pushStage('hospitals'); });
  grid.appendChild(all);
  for (const r of DATA.regions) {
    const hasHospital = DATA.hospitals.some((h) => h.region === r);
    if (!hasHospital) continue;
    const btn = document.createElement('button');
    btn.className = 'region-btn';
    btn.type = 'button';
    btn.textContent = r;
    btn.addEventListener('click', () => { state.region = r; pushStage('hospitals'); });
    grid.appendChild(btn);
  }
  stage.appendChild(grid);
  main.appendChild(stage);
}

function renderStage3Hospitals(main) {
  const stage = document.createElement('div');
  stage.className = 'stage';

  const e = DATA.entries.find((x) => x.c === state.code);
  const grade = e ? e.gr : 0;
  const { ycodes } = currentCandidates();
  const tier = computeTier(ycodes, grade);
  const tierDef = DATA.tier_definitions[tier.preferred];

  const p = document.createElement('div');
  p.className = 'prompt';
  const pl = state.region ? state.region : '전국';
  p.innerHTML = pl + ' · <span style="color:var(--accent)">' + tierDef.short + '</span> 권장<span class="hint">Y후보 ' + (ycodes.length ? ycodes.join(', ') : '없음') + ' · 권장 등급과 일치하는 병원 우선</span>';
  stage.appendChild(p);

  // 병원 후보 필터링·정렬
  const needY = new Set(ycodes);
  const hospitals = DATA.hospitals
    .filter((h) => !state.region || h.region === state.region)
    .filter((h) => tier.acceptable.includes(h.tier));

  // 스코어링: (a) tier 일치도 (preferred=+3, acceptable=+1), (b) Y코드 매칭 수, (c) 거리 역순
  const scored = hospitals.map((h) => {
    let score = 0;
    if (h.tier === tier.preferred) score += 30;
    else score += 10;
    if (needY.size > 0) {
      let matches = 0;
      for (const y of ycodes) if (h.y_supported.includes(y)) matches += 1;
      score += matches * 10;
      if (matches === needY.size) score += 15;
    }
    score -= h.distance_mock_km * 0.5;
    return { h, score, yMatches: ycodes.filter((y) => h.y_supported.includes(y)) };
  }).sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-msg';
    empty.textContent = state.region ? (state.region + '에 등록된 mock 병원이 없습니다.') : '추천 가능한 mock 병원이 없습니다.';
    stage.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'hospital-list';
    scored.forEach(({ h, yMatches }, i) => {
      const card = document.createElement('div');
      card.className = 'hospital-card' + (i === 0 ? ' recommended' : '');
      const head = document.createElement('div');
      head.className = 'h-head';
      const nameWrap = document.createElement('div');
      if (i === 0) {
        const badge = document.createElement('div');
        badge.className = 'recommend-badge';
        badge.textContent = '가장 적합';
        nameWrap.appendChild(badge);
      }
      const name = document.createElement('div');
      name.className = 'h-name';
      name.textContent = h.name;
      nameWrap.appendChild(name);
      head.appendChild(nameWrap);

      const tierBadge = document.createElement('span');
      tierBadge.className = 'h-tier ' + h.tier;
      tierBadge.textContent = DATA.tier_definitions[h.tier].short;
      head.appendChild(tierBadge);
      card.appendChild(head);

      const meta = document.createElement('div');
      meta.className = 'h-meta';
      const region = document.createElement('span');
      region.textContent = h.region;
      meta.appendChild(region);
      const dist = document.createElement('span');
      dist.textContent = '~' + h.distance_mock_km + ' km';
      meta.appendChild(dist);
      if (ycodes.length > 0) {
        const yBadge = document.createElement('span');
        yBadge.className = yMatches.length === ycodes.length ? 'ok' : (yMatches.length > 0 ? '' : 'ng');
        yBadge.textContent = 'Y코드 ' + yMatches.length + '/' + ycodes.length + ' 커버';
        meta.appendChild(yBadge);
      }
      card.appendChild(meta);
      list.appendChild(card);
    });
    stage.appendChild(list);
  }

  const note = document.createElement('div');
  note.className = 'safety-foot';
  note.innerHTML = '<b>주의</b> — 거리·Y코드 지원 여부는 mock 데이터. 실제 배정은 EMRIS 종합상황판 실시간 병상 정보와 의료기관 확인 후.';
  stage.appendChild(note);

  main.appendChild(stage);
}

/* ── main render ── */
function render() {
  setHeader();
  const main = $('main');
  main.innerHTML = '';
  const s = state.stage;
  if (s === 'group') renderStage1Group(main);
  else if (s === 'l2') renderStage1L2(main);
  else if (s === 'l3') renderStage1L3(main);
  else if (s === 'l4') renderStage1L4(main);
  else if (s === 'questions') renderStage2Questions(main);
  else if (s === 'region') renderStage3Region(main);
  else if (s === 'hospitals') renderStage3Hospitals(main);
  main.scrollTop = 0;
}

$('btn-back').addEventListener('click', goBack);
$('btn-home').addEventListener('click', goHome);

render();
</script>
</body>
</html>
`;

fs.writeFileSync(output, html);
console.log('Wrote ' + path.relative(repoRoot, output));
console.log('  size: ' + (html.length / 1024).toFixed(1) + ' KB');
