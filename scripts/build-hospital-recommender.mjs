#!/usr/bin/env node

/**
 * Pre-KTAS 기반 병원 등급 추천 standalone HTML 생성기.
 * 정본 JSON 4개(codebook, mapping, tier-recommendation, y-codes)를 embed.
 * 외부 의존 없음. 브라우저 직접 오픈 가능.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const output = path.join(repoRoot, 'prektas-hospital-recommender.html');

const codebook = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/prektas-codebook.json'), 'utf8'));
const mapping = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/prektas-to-y-mapping.json'), 'utf8'));
const tier = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/prektas-tier-recommendation.json'), 'utf8'));
const diseases = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/emris-severe-emergency-diseases.json'), 'utf8'));

const recByCode = {};
for (const r of tier.recommendations) recByCode[r.code] = r;

const payload = {
  codebook_meta: { version: codebook.version, total: codebook.stats.total },
  tier_meta: { version: tier.version, generated_at: tier.generated_at },
  tier_definitions: tier.tier_definitions,
  strategy_definitions: tier.strategy_definitions,
  question_catalog: mapping.question_catalog,
  diseases: diseases.diseases,
  entries: codebook.entries,
  recommendations: recByCode,
};

// XSS 방어: JSON payload 내 `</script>` 시퀀스 차단.
const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pre-KTAS 기반 병원 등급 추천 · EMRIS 119</title>
<style>
  :root {
    --ink: #0a0a0a;
    --bg: #fafaf8;
    --dim: #6b6b68;
    --line: rgba(10,10,10,0.14);
    --line-soft: rgba(10,10,10,0.07);
    --accent: #a8231c;
    --tier-regional: #a8231c;
    --tier-local-center: #8b4238;
    --tier-local-institution: #5a4a42;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: "Pretendard", -apple-system, "Apple SD Gothic Neo", "Helvetica Neue", sans-serif;
    font-feature-settings: "tnum", "ss01";
    line-height: 1.45;
    font-size: 14px;
    min-height: 100vh;
  }
  button { font-family: inherit; color: inherit; background: none; border: none; cursor: pointer; }
  a { color: var(--accent); text-decoration: none; border-bottom: 1px solid currentColor; }
  .shell { display: grid; grid-template-columns: 460px 1fr; min-height: 100vh; }
  @media (max-width: 1000px) { .shell { grid-template-columns: 1fr; } }
  .input-panel { border-right: 1px solid var(--line); padding: 40px 36px 64px; background: #ffffff; display: flex; flex-direction: column; gap: 28px; min-height: 100vh; }
  .brand-line { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--dim); font-weight: 600; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
  .brand-line a { color: var(--dim); border-bottom: none; }
  h1 { font-size: 30px; line-height: 1.15; letter-spacing: -0.02em; font-weight: 800; }
  .lede { font-size: 14px; color: var(--dim); line-height: 1.55; max-width: 40ch; }
  .section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); }
  .chooser { display: grid; gap: 12px; }
  .chooser label { display: grid; gap: 5px; }
  .chooser select, .chooser input[type=text] { font: inherit; color: inherit; background: var(--bg); border: 1px solid var(--line); border-radius: 0; padding: 10px 12px; outline: none; }
  .chooser select:focus, .chooser input[type=text]:focus { border-color: var(--ink); }
  .chooser .label-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .chooser .label-row .count { font-size: 11px; color: var(--dim); letter-spacing: 0.04em; }
  .code-badge { display: inline-flex; align-items: baseline; gap: 6px; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 28px; font-weight: 700; letter-spacing: 0.06em; }
  .code-badge .faded { color: var(--line); }
  .code-meta { font-size: 12px; color: var(--dim); display: flex; flex-wrap: wrap; gap: 14px; }
  .code-meta b { color: var(--ink); font-weight: 600; }
  .questions { display: grid; gap: 14px; }
  .question-card { border: 1px solid var(--line); padding: 14px 14px 12px; background: var(--bg); }
  .question-card .q-prompt { font-weight: 600; margin-bottom: 4px; font-size: 13.5px; }
  .question-card .q-purpose { font-size: 11.5px; color: var(--dim); margin-bottom: 10px; }
  .q-options { display: grid; gap: 5px; }
  .q-options label { display: flex; align-items: baseline; gap: 8px; cursor: pointer; padding: 6px 8px; border: 1px solid transparent; font-size: 13px; }
  .q-options label:hover { background: #ffffff; }
  .q-options input[type=radio] { accent-color: var(--accent); }
  .q-options label.selected { border-color: var(--line); background: #ffffff; }
  .reset-btn { font-size: 11.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); padding: 8px 0; align-self: flex-start; border-bottom: 1px solid var(--line); }
  .reset-btn:hover { color: var(--ink); border-color: var(--ink); }
  .result-panel { padding: 40px 44px 64px; display: flex; flex-direction: column; gap: 30px; max-width: 920px; }
  .result-empty { color: var(--dim); font-size: 14px; border: 1px dashed var(--line); padding: 40px; text-align: center; }
  .result-group { display: grid; gap: 10px; }
  .result-group h2 { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); }
  .tier-card { padding: 24px 28px 26px; border: 1px solid var(--line); background: #ffffff; }
  .tier-card .label-strip { font-size: 11.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); margin-bottom: 8px; }
  .tier-card .tier-name { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; }
  .tier-card .tier-strategy { font-size: 12.5px; color: var(--dim); margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
  .tier-card.regional .tier-name { color: var(--tier-regional); }
  .tier-card.local_center .tier-name { color: var(--tier-local-center); }
  .tier-card.local_institution .tier-name { color: var(--tier-local-institution); }
  .acceptable-tiers { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
  .pill { font-size: 11.5px; padding: 4px 10px; border: 1px solid currentColor; letter-spacing: 0.02em; }
  .pill.primary { border-color: var(--ink); background: var(--ink); color: #fff; }
  .pill.secondary { color: var(--dim); }
  .y-candidates { border: 1px solid var(--line); padding: 18px 22px; background: #ffffff; }
  .y-candidates ul { list-style: none; display: grid; gap: 8px; }
  .y-candidates li { display: grid; grid-template-columns: 66px 1fr; gap: 14px; padding: 8px 0; border-top: 1px solid var(--line-soft); }
  .y-candidates li:first-child { border-top: none; padding-top: 0; }
  .y-candidates .y-code { font-family: ui-monospace, monospace; font-weight: 700; font-size: 13px; }
  .y-candidates .y-label { font-size: 13px; }
  .rationale-box { border-left: 2px solid var(--ink); padding: 4px 16px; font-size: 13px; color: var(--ink); background: transparent; }
  .rationale-box .source { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); margin-top: 6px; display: block; }
  .safety-note { font-size: 12px; color: var(--dim); border: 1px solid var(--line); padding: 14px 16px; background: #ffffff; }
  .safety-note b { color: var(--accent); font-weight: 600; }
  footer.page-footer { grid-column: 1 / -1; border-top: 1px solid var(--line); padding: 28px 44px 36px; color: var(--dim); font-size: 11.5px; display: flex; gap: 24px; flex-wrap: wrap; align-items: center; justify-content: space-between; letter-spacing: 0.02em; }
  footer.page-footer .version-tag { font-family: ui-monospace, monospace; }
</style>
</head>
<body>
<div class="shell">
  <section class="input-panel">
    <div class="brand-line">EMRIS 119 · Pre-KTAS 병원 등급 추천 프로토타입</div>
    <div>
      <h1>증상 분류 코드로<br/>수용 가능한 응급의료센터 등급을 찾습니다.</h1>
      <p class="lede" style="margin-top: 14px;">구급대원이 현장에서 부여한 Pre-KTAS 5자 코드를 입력하면, 권역/지역센터/지역기관 중 수용 가능한 등급과 EMRIS 27 중증응급질환 Y코드 후보를 제시합니다. 진단 확정이 아닌 자원 등급 매칭이 목적입니다.</p>
    </div>
    <div class="chooser">
      <div class="section-title">단계별 선택</div>
      <label>
        <div class="label-row"><span>연령군</span><span class="count" id="count-group"></span></div>
        <select id="sel-group">
          <option value="">— 선택 —</option>
          <option value="adult">성인 (C로 시작)</option>
          <option value="pediatric">소아 (D로 시작)</option>
        </select>
      </label>
      <label>
        <div class="label-row"><span>대분류 (2단계)</span><span class="count" id="count-l2"></span></div>
        <select id="sel-l2"><option value="">— 대분류 선택 —</option></select>
      </label>
      <label>
        <div class="label-row"><span>주호소 (3단계)</span><span class="count" id="count-l3"></span></div>
        <select id="sel-l3"><option value="">— 3단계 선택 —</option></select>
      </label>
      <label>
        <div class="label-row"><span>세부증상 (4단계)</span><span class="count" id="count-l4"></span></div>
        <select id="sel-l4"><option value="">— 4단계 선택 —</option></select>
      </label>
      <label>
        <div class="label-row"><span>직접 Pre-KTAS 코드 입력</span><span class="count">5자</span></div>
        <input type="text" id="sel-code" placeholder="예: CCAAA" maxlength="5" style="text-transform:uppercase; font-family: ui-monospace, monospace;" />
      </label>
      <div class="code-badge" id="code-display"><span class="faded">—</span></div>
      <div class="code-meta" id="code-meta"></div>
    </div>
    <div class="questions" id="questions-container"></div>
    <button class="reset-btn" id="btn-reset">↺ 초기화</button>
  </section>
  <section class="result-panel" id="result-panel">
    <div class="result-empty">Pre-KTAS 코드를 선택하거나 입력하면 결과가 여기에 나타납니다.</div>
  </section>
  <footer class="page-footer">
    <div>
      <span class="version-tag">codebook v${codebook.version}</span> ·
      <span class="version-tag">tier v${tier.version}</span> ·
      총 ${codebook.stats.total}개 Pre-KTAS 코드 · EMRIS 27 Y코드
    </div>
    <div><a href="prektas-research.html">연구 배경 보기 →</a></div>
  </footer>
</div>
<script>
const DATA = ${payloadJson};
const $ = (id) => document.getElementById(id);
const state = { group:'', l2:'', l3:'', l4:'', code:'', answers:{} };
const byGroup = { adult: [], pediatric: [] };
for (const e of DATA.entries) byGroup[e.group].push(e);

function uniqueLevel2(entries) {
  const map = new Map();
  for (const e of entries) if (!map.has(e.level2.code)) map.set(e.level2.code, e.level2.name);
  return Array.from(map.entries()).sort().map(([c, n]) => ({ code: c, name: n }));
}
function uniqueLevel3(entries, l2code) {
  const map = new Map();
  for (const e of entries) { if (e.level2.code !== l2code) continue; if (!map.has(e.level3.code)) map.set(e.level3.code, e.level3.name); }
  return Array.from(map.entries()).sort().map(([c, n]) => ({ code: c, name: n }));
}
function uniqueLevel4(entries, l2code, l3code) {
  const out = [];
  for (const e of entries) if (e.level2.code === l2code && e.level3.code === l3code) out.push({ code: e.level4.code, name: e.level4.name, entry: e });
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function populateL2() {
  const sel = $('sel-l2');
  sel.innerHTML = '<option value="">— 대분류 선택 —</option>';
  if (!state.group) { sel.disabled = true; $('count-l2').textContent = ''; return; }
  const opts = uniqueLevel2(byGroup[state.group]);
  $('count-l2').textContent = opts.length + '개';
  sel.disabled = false;
  for (const o of opts) { const op = document.createElement('option'); op.value = o.code; op.textContent = o.code + ' · ' + o.name; sel.appendChild(op); }
}
function populateL3() {
  const sel = $('sel-l3');
  sel.innerHTML = '<option value="">— 3단계 선택 —</option>';
  if (!state.group || !state.l2) { sel.disabled = true; $('count-l3').textContent = ''; return; }
  const opts = uniqueLevel3(byGroup[state.group], state.l2);
  $('count-l3').textContent = opts.length + '개';
  sel.disabled = false;
  for (const o of opts) { const op = document.createElement('option'); op.value = o.code; op.textContent = o.code + ' · ' + o.name; sel.appendChild(op); }
}
function populateL4() {
  const sel = $('sel-l4');
  sel.innerHTML = '<option value="">— 4단계 선택 —</option>';
  if (!state.group || !state.l2 || !state.l3) { sel.disabled = true; $('count-l4').textContent = ''; return; }
  const opts = uniqueLevel4(byGroup[state.group], state.l2, state.l3);
  $('count-l4').textContent = opts.length + '개';
  sel.disabled = false;
  for (const o of opts) { const op = document.createElement('option'); op.value = o.code; op.textContent = o.code + ' · g' + o.entry.grade + ' · ' + o.name; sel.appendChild(op); }
}
function updateCountGroup() { if (!state.group) { $('count-group').textContent = ''; return; } $('count-group').textContent = byGroup[state.group].length + '개 코드'; }

function currentCode() {
  if (state.code && state.code.length === 5 && /^[A-Z]{5}$/.test(state.code)) return state.code;
  if (state.group && state.l2 && state.l3 && state.l4) {
    const prefix = state.group === 'adult' ? 'C' : 'D';
    return prefix + state.l2 + state.l3 + state.l4;
  }
  return null;
}

function renderCodeBadge() {
  const c = currentCode();
  const badge = $('code-display');
  badge.innerHTML = '';
  if (!c) { const s = document.createElement('span'); s.className = 'faded'; s.textContent = '—'; badge.appendChild(s); $('code-meta').textContent = ''; return; }
  for (const ch of c) { const sp = document.createElement('span'); sp.textContent = ch; badge.appendChild(sp); }
  const entry = DATA.entries.find((e) => e.code === c);
  const meta = $('code-meta');
  meta.innerHTML = '';
  if (entry) {
    const mk = (inner) => { const sp = document.createElement('span'); sp.innerHTML = inner; meta.appendChild(sp); };
    mk('<b>g' + entry.grade + '</b> 등급');
    mk(escapeHtml(entry.level2.name));
    mk(escapeHtml(entry.level3.name));
    mk(escapeHtml(entry.level4.name));
  } else {
    const sp = document.createElement('span');
    sp.style.color = '#a8231c';
    sp.textContent = '정본 코드북에 없는 코드입니다.';
    meta.appendChild(sp);
  }
}

function findQuestionIds(code) {
  const rec = DATA.recommendations[code];
  if (!rec || rec.y_candidates.length === 0) return [];
  const cands = new Set(rec.y_candidates);
  const qids = new Set();
  if (cands.has('Y0010') || cands.has('Y0041')) { qids.add('chest_pain_character'); qids.add('aortic_location'); }
  if (cands.has('Y0020') || cands.has('Y0031') || cands.has('Y0032')) { qids.add('onset_time_stroke'); qids.add('trauma_or_spontaneous'); }
  if (cands.has('Y0111') || cands.has('Y0112') || cands.has('Y0113')) qids.add('pregnancy_status');
  if (cands.has('Y0082') && cands.has('Y0092')) qids.add('foreign_body_site');
  if (cands.has('Y0131') || cands.has('Y0132')) qids.add('replantation_part');
  if (cands.has('Y0120')) qids.add('burn_severity');
  if (cands.has('Y0141') || cands.has('Y0142')) qids.add('dialysis_indication');
  if (cands.has('Y0150')) qids.add('psychiatric_risk');
  if (cands.has('Y0160')) qids.add('eye_emergency_kind');
  return Array.from(qids).slice(0, 3);
}

function renderQuestions() {
  const container = $('questions-container');
  container.innerHTML = '';
  const code = currentCode();
  if (!code) return;
  const qids = findQuestionIds(code);
  if (qids.length === 0) return;

  const title = document.createElement('div');
  title.className = 'section-title';
  title.textContent = '추가 질문 · ' + qids.length + '개';
  container.appendChild(title);

  for (const qid of qids) {
    const q = DATA.question_catalog[qid];
    if (!q) continue;
    const card = document.createElement('div');
    card.className = 'question-card';
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
    q.options.forEach((optText, i) => {
      const label = document.createElement('label');
      if (state.answers[qid] === i) label.classList.add('selected');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'q-' + qid;
      input.value = String(i);
      if (state.answers[qid] === i) input.checked = true;
      input.addEventListener('change', () => {
        state.answers[qid] = i;
        renderQuestions();
        renderResult();
      });
      const span = document.createElement('span');
      span.textContent = optText;
      label.appendChild(input);
      label.appendChild(span);
      opts.appendChild(label);
    });
    card.appendChild(opts);
    container.appendChild(card);
  }
}

function renderResult() {
  const panel = $('result-panel');
  panel.innerHTML = '';
  const code = currentCode();
  if (!code) {
    const empty = document.createElement('div');
    empty.className = 'result-empty';
    empty.textContent = 'Pre-KTAS 코드를 선택하거나 입력하면 결과가 여기에 나타납니다.';
    panel.appendChild(empty);
    return;
  }
  const rec = DATA.recommendations[code];
  if (!rec) {
    const empty = document.createElement('div');
    empty.className = 'result-empty';
    empty.textContent = '정본 Pre-KTAS 코드북에 없는 코드입니다: ' + code;
    panel.appendChild(empty);
    return;
  }

  const tierKey = rec.preferred_tier;
  const tierDef = DATA.tier_definitions[tierKey];
  const strategyDesc = DATA.strategy_definitions[rec.tier_strategy] || '';

  const tierBlock = document.createElement('div');
  tierBlock.className = 'result-group';
  const h2a = document.createElement('h2');
  h2a.textContent = 'Primary 응급의료센터 등급';
  tierBlock.appendChild(h2a);
  const card = document.createElement('div');
  card.className = 'tier-card ' + tierKey;
  const label = document.createElement('div');
  label.className = 'label-strip';
  label.textContent = '1순위 추천';
  card.appendChild(label);
  const name = document.createElement('div');
  name.className = 'tier-name';
  name.textContent = tierDef.label;
  card.appendChild(name);
  const pills = document.createElement('div');
  pills.className = 'acceptable-tiers';
  rec.acceptable_tiers.forEach((t, i) => {
    const def = DATA.tier_definitions[t];
    const pill = document.createElement('span');
    pill.className = 'pill ' + (i === 0 ? 'primary' : 'secondary');
    pill.textContent = def.short + (i === 0 ? ' · 1순위' : ' · 가능');
    pills.appendChild(pill);
  });
  card.appendChild(pills);
  const strat = document.createElement('div');
  strat.className = 'tier-strategy';
  strat.textContent = strategyDesc;
  card.appendChild(strat);
  tierBlock.appendChild(card);
  panel.appendChild(tierBlock);

  const rBlock = document.createElement('div');
  rBlock.className = 'result-group';
  const h2b = document.createElement('h2');
  h2b.textContent = '판정 근거';
  rBlock.appendChild(h2b);
  const rBox = document.createElement('div');
  rBox.className = 'rationale-box';
  rBox.textContent = rec.rationale;
  const src = document.createElement('span');
  src.className = 'source';
  src.textContent = 'source: ' + rec.source + ' · strategy: ' + rec.tier_strategy;
  rBox.appendChild(src);
  rBlock.appendChild(rBox);
  panel.appendChild(rBlock);

  const yBlock = document.createElement('div');
  yBlock.className = 'result-group';
  const h2c = document.createElement('h2');
  h2c.textContent = 'EMRIS 27 Y코드 후보';
  yBlock.appendChild(h2c);
  const yBox = document.createElement('div');
  yBox.className = 'y-candidates';
  if (rec.y_candidates.length === 0) {
    yBox.textContent = '해당 Y코드 없음 — 27개 중증응급질환 외 (grade 기반 tier 추천).';
  } else {
    const ul = document.createElement('ul');
    for (const y of rec.y_candidates) {
      const d = DATA.diseases.find((x) => x.code === y);
      const li = document.createElement('li');
      const c1 = document.createElement('span');
      c1.className = 'y-code';
      c1.textContent = y;
      const c2 = document.createElement('span');
      c2.className = 'y-label';
      c2.textContent = d ? d.label : '(정의 누락)';
      li.appendChild(c1); li.appendChild(c2);
      ul.appendChild(li);
    }
    yBox.appendChild(ul);
  }
  yBlock.appendChild(yBox);
  panel.appendChild(yBlock);

  const answered = Object.keys(state.answers);
  if (answered.length > 0) {
    const aBlock = document.createElement('div');
    aBlock.className = 'result-group';
    const h2d = document.createElement('h2');
    h2d.textContent = '답변 기록';
    aBlock.appendChild(h2d);
    const aBox = document.createElement('div');
    aBox.className = 'y-candidates';
    const ul = document.createElement('ul');
    for (const qid of answered) {
      const q = DATA.question_catalog[qid];
      if (!q) continue;
      const li = document.createElement('li');
      li.style.gridTemplateColumns = '1fr';
      const b = document.createElement('b');
      b.textContent = q.prompt;
      const ans = document.createElement('span');
      ans.textContent = ' → ' + q.options[state.answers[qid]];
      li.appendChild(b); li.appendChild(ans);
      ul.appendChild(li);
    }
    aBox.appendChild(ul);
    aBlock.appendChild(aBox);
    panel.appendChild(aBlock);
  }

  const note = document.createElement('div');
  note.className = 'safety-note';
  const bold = document.createElement('b');
  bold.textContent = '주의';
  note.appendChild(bold);
  const rest = document.createTextNode(' — 본 도구는 정본 Pre-KTAS 코드북과 EMRIS 27 Y코드 매핑의 1차안에 기반한 연구용 프로토타입입니다. 진단 확정이 아닌 자원 등급 매칭이 목적이며, 실제 환자 배정은 EMRIS 종합상황판 실시간 병상 정보와 의료기관 담당자 확인을 거쳐야 합니다. 임상 리뷰 전의 Y코드 tier 분류는 수도권/지방 편차를 반영하지 않습니다.');
  note.appendChild(rest);
  panel.appendChild(note);
}

$('sel-group').addEventListener('change', (e) => { state.group = e.target.value; state.l2 = state.l3 = state.l4 = state.code = ''; state.answers = {}; $('sel-code').value = ''; updateCountGroup(); populateL2(); populateL3(); populateL4(); renderCodeBadge(); renderQuestions(); renderResult(); });
$('sel-l2').addEventListener('change', (e) => { state.l2 = e.target.value; state.l3 = state.l4 = state.code = ''; state.answers = {}; $('sel-code').value = ''; populateL3(); populateL4(); renderCodeBadge(); renderQuestions(); renderResult(); });
$('sel-l3').addEventListener('change', (e) => { state.l3 = e.target.value; state.l4 = state.code = ''; state.answers = {}; $('sel-code').value = ''; populateL4(); renderCodeBadge(); renderQuestions(); renderResult(); });
$('sel-l4').addEventListener('change', (e) => { state.l4 = e.target.value; state.code = ''; state.answers = {}; $('sel-code').value = ''; renderCodeBadge(); renderQuestions(); renderResult(); });
$('sel-code').addEventListener('input', (e) => {
  const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  e.target.value = v; state.code = v;
  if (v.length === 5) {
    const entry = DATA.entries.find((x) => x.code === v);
    if (entry) {
      state.group = entry.group; state.l2 = entry.level2.code; state.l3 = entry.level3.code; state.l4 = entry.level4.code;
      $('sel-group').value = entry.group; updateCountGroup();
      populateL2(); $('sel-l2').value = state.l2;
      populateL3(); $('sel-l3').value = state.l3;
      populateL4(); $('sel-l4').value = state.l4;
    }
  }
  state.answers = {};
  renderCodeBadge(); renderQuestions(); renderResult();
});
$('btn-reset').addEventListener('click', () => {
  state.group = state.l2 = state.l3 = state.l4 = state.code = ''; state.answers = {};
  $('sel-group').value = ''; $('sel-code').value = '';
  updateCountGroup(); populateL2(); populateL3(); populateL4();
  renderCodeBadge(); renderQuestions(); renderResult();
});

updateCountGroup(); populateL2(); populateL3(); populateL4();
</script>
</body>
</html>
`;

fs.writeFileSync(output, html);
console.log('Wrote ' + path.relative(repoRoot, output));
console.log('  size: ' + (html.length / 1024).toFixed(1) + ' KB');
