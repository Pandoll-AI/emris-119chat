#!/usr/bin/env node

/**
 * Phase 8b–i 검증 결과 standalone HTML 생성기.
 * Source of truth: research/prektas-validation-report-v1.0.md +
 *                   research/validation-results-v0.1.json +
 *                   research/y-code-icd10-clusters.json
 *
 * 구조 변경 (2026-04-26): protocol 요약 페이지 → 결과 중심 페이지로 전면 교체.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const output = path.join(repoRoot, 'prektas-research.html');

const codebook = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/prektas-codebook.json'), 'utf8'));
const clusters = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/y-code-icd10-clusters.json'), 'utf8'));
const results = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/validation-results-v0.1.json'), 'utf8'));
const stratified = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/validation-stratified.json'), 'utf8'));

const q0 = results.binary_metrics.q0_no_questions;
const sample = results.sample;
const prev = results.prevalence;
const py = results.per_ycode_metrics;
const TH = clusters.thresholds;

const fmt = (n, d=4) => Number(n).toFixed(d);
const pct = (n, d) => ((n / d) * 100).toFixed(1);

// Y-codes sorted by support
const ySorted = Object.entries(py).sort((a,b) => b[1].support - a[1].support);

const PROTOCOL_VERSION = '1.1';
const REPORT_VERSION = '1.0';
const ANALYSIS_DATE = '2026-04-26';
const PROTOCOL_ID = 'PREKTAS-VAL-2026-001';

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pre-KTAS v0.1 진단정확도 검증 결과 · v${REPORT_VERSION}</title>
<style>
  :root {
    --ink: #0a0a0a;
    --bg: #fafaf8;
    --dim: #6b6b68;
    --line: rgba(10,10,10,0.14);
    --line-soft: rgba(10,10,10,0.07);
    --accent: #a8231c;
    --good: #1f7a3d;
    --warn: #b8860b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--ink); font-family: "Pretendard", -apple-system, "Apple SD Gothic Neo", "Helvetica Neue", sans-serif; font-feature-settings: "tnum"; line-height: 1.55; font-size: 15px; }
  a { color: var(--accent); text-decoration: none; border-bottom: 1px solid currentColor; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 40px 32px 96px; }

  .masthead { border-bottom: 2px solid var(--ink); padding-bottom: 18px; margin-bottom: 36px; display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .masthead .brand { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 800; }
  .masthead .nav { font-size: 12px; color: var(--dim); display: flex; gap: 16px; }
  .masthead .nav a { color: var(--dim); border-bottom: none; }

  .protocol-id { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 10px; color: var(--dim); letter-spacing: 0.05em; padding: 4px 8px; border: 1px solid var(--line); display: inline-block; margin-bottom: 12px; }

  .headline { display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 48px; }
  .headline h1 { font-size: clamp(34px, 4.6vw, 60px); line-height: 1.05; letter-spacing: -0.03em; font-weight: 900; max-width: 28ch; }
  .headline .lede { font-size: 17px; line-height: 1.55; color: var(--ink); max-width: 64ch; }
  .headline .lede strong { color: var(--accent); }
  .headline .kicker { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); font-weight: 700; }
  .byline { display: flex; gap: 20px; font-size: 12px; color: var(--dim); padding-top: 16px; border-top: 1px solid var(--line); letter-spacing: 0.04em; flex-wrap: wrap; font-family: ui-monospace, monospace; }

  /* Verdict box */
  .verdict { border: 2px solid var(--accent); padding: 24px 28px; margin: 32px 0 48px; background: #ffffff; }
  .verdict .v-label { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); font-weight: 800; margin-bottom: 10px; }
  .verdict h2 { font-size: 28px; font-weight: 900; line-height: 1.2; letter-spacing: -0.02em; margin-bottom: 16px; }
  .verdict p { font-size: 15px; line-height: 1.55; max-width: 64ch; margin: 8px 0; }
  .verdict .v-meta { display: flex; gap: 14px; margin-top: 14px; flex-wrap: wrap; font-size: 12px; color: var(--dim); font-family: ui-monospace, monospace; }
  .verdict .pass { color: var(--good); font-weight: 700; }
  .verdict .fail { color: var(--accent); font-weight: 700; }

  section.chapter { margin: 56px 0 0; border-top: 1px solid var(--line); padding-top: 28px; display: grid; grid-template-columns: 200px 1fr; gap: 40px; }
  @media (max-width: 780px) { section.chapter { grid-template-columns: 1fr; gap: 20px; } }
  .chapter .tag { position: sticky; top: 24px; align-self: start; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); font-weight: 700; }
  .chapter .tag .num { font-size: 28px; font-weight: 900; color: var(--ink); display: block; margin-bottom: 4px; letter-spacing: -0.02em; }
  .chapter h2 { font-size: 26px; font-weight: 800; line-height: 1.18; letter-spacing: -0.02em; margin-bottom: 16px; max-width: 26ch; }
  .chapter h3 { font-size: 16px; font-weight: 700; margin: 22px 0 10px; letter-spacing: -0.01em; }
  .chapter p { margin: 12px 0; max-width: 66ch; }
  .chapter ul, .chapter ol { margin: 10px 0 10px 22px; max-width: 66ch; }
  .chapter li { margin: 6px 0; line-height: 1.5; }

  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin: 24px 0; border: 1px solid var(--line); }
  @media (max-width: 640px) { .metrics { grid-template-columns: repeat(2, 1fr); } }
  .metric { padding: 18px 20px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .metric:nth-child(4n) { border-right: none; }
  .metric .num { font-size: 28px; font-weight: 900; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .metric .num.accent { color: var(--accent); }
  .metric .num.good { color: var(--good); }
  .metric .num.small { font-size: 22px; }
  .metric .label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); margin-top: 8px; font-weight: 600; }
  .metric .ci { font-size: 11px; color: var(--dim); margin-top: 4px; font-family: ui-monospace, monospace; }

  table.data { width: 100%; border-collapse: collapse; font-size: 13px; margin: 18px 0; }
  table.data th, table.data td { border-bottom: 1px solid var(--line-soft); padding: 8px 6px; text-align: left; vertical-align: top; }
  table.data th { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); font-weight: 700; border-bottom: 1px solid var(--line); }
  table.data td.num { font-variant-numeric: tabular-nums; text-align: right; font-family: ui-monospace, monospace; }
  table.data td.code { font-family: ui-monospace, monospace; font-size: 12px; }
  table.data tr.warn td { color: var(--accent); }
  table.data tr.good td { color: var(--good); }

  .pullquote { border-left: 3px solid var(--accent); padding: 8px 22px; margin: 24px 0; font-size: 18px; line-height: 1.45; font-weight: 600; max-width: 56ch; letter-spacing: -0.01em; }
  .callout { border: 1px solid var(--line); padding: 16px 20px; background: #ffffff; margin: 18px 0; }
  .callout .title { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); font-weight: 700; margin-bottom: 8px; }
  .callout.good { border-left: 3px solid var(--good); }
  .callout.good .title { color: var(--good); }
  .callout.warn { border-left: 3px solid var(--accent); }

  .pipeline { border: 1px solid var(--line); padding: 18px 20px; margin: 22px 0; background: #ffffff; overflow-x: auto; }
  .pipeline pre { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11.5px; line-height: 1.6; color: var(--ink); white-space: pre; }

  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.9em; background: var(--line-soft); padding: 1px 5px; }
  strong { font-weight: 700; }

  .file-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 18px 0; }
  @media (max-width: 640px) { .file-grid { grid-template-columns: 1fr; } }
  .file-grid .file { border: 1px solid var(--line); padding: 12px 14px; background: #ffffff; }
  .file-grid .file .fname { font-family: ui-monospace, monospace; font-size: 12px; color: var(--accent); font-weight: 700; }
  .file-grid .file .fdesc { font-size: 12px; color: var(--dim); margin-top: 4px; line-height: 1.4; }

  footer.page-end { margin-top: 72px; padding-top: 24px; border-top: 2px solid var(--ink); color: var(--dim); font-size: 12px; display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; letter-spacing: 0.02em; }
  footer.page-end .version-tag { font-family: ui-monospace, monospace; }
</style>
</head>
<body>
<div class="wrap">
  <div class="masthead">
    <div class="brand">EMRIS 119 · Validation Report · v${REPORT_VERSION} · ${ANALYSIS_DATE}</div>
    <div class="nav">
      <a href="prektas-consultation.html">전문의 자문 도구</a>
      <a href="prektas-hospital-recommender.html">추천 도구</a>
      <a href="https://119chat.emergency-info.com">Chatbot</a>
      <a href="https://github.com/Pandoll-AI/emris-119chat">Repository</a>
    </div>
  </div>

  <header class="headline">
    <div class="protocol-id">PROTOCOL ${PROTOCOL_ID} · v${PROTOCOL_VERSION} · REPORT v${REPORT_VERSION}</div>
    <div class="kicker">Pre-KTAS → EMRIS 27 Y코드 매핑 v0.1 · 진단정확도 검증 결과</div>
    <h1>Pre-KTAS만으로는 중증 응급환자의 60%가 시스템에서 unmapped로 떨어진다.</h1>
    <p class="lede">광주·전남·전북 응급실 130,536건의 실측 방문 데이터로 v0.1 룰 알고리즘을 검증한 결과, <strong>Sensitivity 39.4%</strong>로 한국 응급의료 baseline 임계값(0.80)을 통과하지 못했다. Specificity 80.8%는 통과. <strong>v0.1은 단독 의사결정 도구로 임상 활용 불가</strong> 판정. 다만 어디에서 어떻게 부족한지 정량 측정되어 v0.2 개선 방향이 명확해졌다.</p>
    <div class="byline">
      <span>Algorithm v0.1</span>
      <span>Reference standard v1.0</span>
      <span>N = ${sample.included_rows.toLocaleString()}</span>
      <span>Severe prev = ${prev.severe_pct}%</span>
    </div>
  </header>

  <!-- Verdict -->
  <div class="verdict">
    <div class="v-label">⚠ 임상 활용 판정 (v0.1)</div>
    <h2>단독 의사결정 도구로 활용 불가.</h2>
    <p>Sensitivity 39.4%는 60.6%의 중증 응급환자가 시스템에서 unmapped로 떨어진다는 의미다. 응급의료에서 under-triage는 환자 위해(harm)와 직결된다. 가장 위급한 grade 1(소생) 환자의 sensitivity는 18.5%로, 도구가 가장 절실한 환자에게 가장 못 도움이 되는 역설을 보인다.</p>
    <p>다만 활용 불가의 범위는 명확하다. <strong>Specificity 80.8%</strong>는 통과 — "비응급 거름"은 한국 baseline 통과 수준. 즉 이 도구를 보조 정보 제공자(second opinion)로 쓰는 시나리오는 별도 평가 대상이며, v0.1 한정 평가일 뿐이다. <strong>Pre-KTAS + 0–3 질문 시스템 자체의 한계</strong>가 아니라 <strong>v0.1 룰의 카테고리별 빈틈</strong>이 본질 문제다. v0.2에서 rule absent 카테고리(Y0141 응급HD, Y0142 CRRT, Y0060 복부응급, Y0051 담낭) 보강 + over-trigger 좁히면 sensitivity 0.70+ 도달이 현실적이다.</p>
    <div class="v-meta">
      <span class="fail">H1 sens ≥ 0.80 → FAIL (95% lower CI ${fmt(q0.sensitivity_95CI[0])})</span>
      <span class="pass">H2 spec ≥ 0.80 → PASS (95% lower CI ${fmt(q0.specificity_95CI[0])})</span>
      <span class="fail">H3 한계효용 ≥ 0.05 → FAIL (oracle gain +0.000)</span>
    </div>
  </div>

  <section class="chapter">
    <div class="tag"><span class="num">01</span>핵심 결과</div>
    <div>
      <h2>Primary endpoint (이항 진단정확도, q0).</h2>

      <div class="metrics">
        <div class="metric"><div class="num accent">${fmt(q0.sensitivity)}</div><div class="label">Sensitivity</div><div class="ci">95% CI [${fmt(q0.sensitivity_95CI[0])}, ${fmt(q0.sensitivity_95CI[1])}]</div></div>
        <div class="metric"><div class="num good">${fmt(q0.specificity)}</div><div class="label">Specificity</div><div class="ci">95% CI [${fmt(q0.specificity_95CI[0])}, ${fmt(q0.specificity_95CI[1])}]</div></div>
        <div class="metric"><div class="num">${fmt(q0.ppv)}</div><div class="label">PPV</div><div class="ci">positive predictive</div></div>
        <div class="metric"><div class="num">${fmt(q0.npv)}</div><div class="label">NPV</div><div class="ci">negative predictive</div></div>
        <div class="metric"><div class="num small">${fmt(q0.f1)}</div><div class="label">F1</div></div>
        <div class="metric"><div class="num small">${fmt(q0.balanced_accuracy)}</div><div class="label">Balanced Acc</div></div>
        <div class="metric"><div class="num small">${fmt(q0.cohens_kappa)}</div><div class="label">Cohen's κ</div></div>
        <div class="metric"><div class="num small">${q0.n.toLocaleString()}</div><div class="label">N (binary)</div></div>
      </div>

      <h3>Oracle best-case 한계효용</h3>
      <p>추가 질문에 ground truth 기반으로 정답을 알고 답변한다고 가정한 oracle 시뮬레이션에서도 sensitivity 증분 <strong>+0.000</strong>. 즉 v0.1 룰의 sensitivity 한계는 "질문이 정답을 좁히지 못해서"가 아니라 <strong>"candidates 자체가 정답을 포함하지 않아서"</strong>다. Rule coverage gap이 본질 문제이며 추가 질문 트리로 해결되지 않는다.</p>

      <div class="pullquote">v0.1 sensitivity 한계는 <em style="color:var(--accent);">candidates에 정답이 없어서</em>다.<br>질문을 더해도 안 풀린다. 룰을 새로 써야 한다.</div>
    </div>
  </section>

  <section class="chapter">
    <div class="tag"><span class="num">02</span>표본</div>
    <div>
      <h2>225,017 ED 방문 → 130,536 included.</h2>
      <table class="data">
        <thead><tr><th>항목</th><th class="num">수</th><th class="num">비율</th></tr></thead>
        <tbody>
          <tr><td>Total CSV rows</td><td class="num">${sample.csv_total_rows.toLocaleString()}</td><td class="num">100.0%</td></tr>
          <tr><td>네디스매칭 (퇴실진단 ICD-10 존재)</td><td class="num">${sample.matched_rows.toLocaleString()}</td><td class="num">${pct(sample.matched_rows, sample.csv_total_rows)}%</td></tr>
          <tr><td><strong>Included (모든 inclusion criteria)</strong></td><td class="num"><strong>${sample.included_rows.toLocaleString()}</strong></td><td class="num"><strong>${pct(sample.included_rows, sample.csv_total_rows)}%</strong></td></tr>
          <tr><td>제외 — 매칭 실패</td><td class="num">${(sample.excluded_reasons.unmatched||0).toLocaleString()}</td><td class="num">${pct(sample.excluded_reasons.unmatched||0, sample.csv_total_rows)}%</td></tr>
          <tr><td>제외 — 코드 형식·suffix 불명</td><td class="num">${((sample.excluded_reasons.unknown_suffix||0)+(sample.excluded_reasons.code_format||0)+(sample.excluded_reasons.no_prektas_code||0)).toLocaleString()}</td><td class="num">—</td></tr>
          <tr><td>제외 — codebook 부재</td><td class="num">${(sample.excluded_reasons.codebook_missing||0).toLocaleString()}</td><td class="num">—</td></tr>
          <tr><td>제외 — 진단 결측</td><td class="num">${(sample.excluded_reasons.no_diagnosis||0).toLocaleString()}</td><td class="num">—</td></tr>
        </tbody>
      </table>
      <p><strong>Severe Y-code prevalence (included)</strong>: ${prev.severe_pct}% (${(q0.tp+q0.fn).toLocaleString()} severe / ${sample.included_rows.toLocaleString()})</p>
      <p>Phase 8 1차 ICD-10 prefix 추정 4.7%보다 높음 — frozen reference standard cluster 적용 + multi-label 확장 효과. Cohort는 광주·전남·전북 편중 (전국 일반화 한계).</p>
    </div>
  </section>

  <section class="chapter">
    <div class="tag"><span class="num">03</span>Y-code별 성능</div>
    <div>
      <h2>Rule absent 카테고리 4건 + over-trigger 5건이 핵심 문제.</h2>
      <table class="data">
        <thead><tr><th>Y-code</th><th class="num">Support</th><th class="num">Precision</th><th class="num">Recall</th><th class="num">F1</th><th>비고</th></tr></thead>
        <tbody>
${ySorted.slice(0, 18).map(([y, m]) => {
  const note = m.recall === 0 ? '<strong style="color:var(--accent)">rule absent</strong>'
    : m.recall < 0.20 ? '<span style="color:var(--accent)">recall 부족</span>'
    : m.precision < 0.10 ? '<span style="color:var(--accent)">over-prediction</span>'
    : m.f1 > 0.40 ? '<span style="color:var(--good)">균형 양호</span>'
    : '—';
  const rowClass = m.recall === 0 ? 'warn' : m.f1 > 0.40 ? 'good' : '';
  const ylabel = clusters.y_codes[y] ? clusters.y_codes[y].short : y;
  return `          <tr class="${rowClass}"><td class="code">${y}</td><td class="num">${m.support.toLocaleString()}</td><td class="num">${fmt(m.precision, 3)}</td><td class="num">${fmt(m.recall, 3)}</td><td class="num">${fmt(m.f1, 3)}</td><td>${ylabel} · ${note}</td></tr>`;
}).join('\n')}
        </tbody>
      </table>
      <p><strong>Macro F1</strong>: ${fmt(results.macro_f1, 3)} · <strong>Weighted F1</strong>: ${fmt(results.weighted_f1, 3)} · 27 Y-codes 중 ${ySorted.filter(([_, m]) => m.recall === 0).length}개가 recall 0.</p>

      <div class="callout warn">
        <div class="title">Critical rule absent</div>
        <p><strong>Y0141 응급HD · Y0142 CRRT · Y0060 복부응급수술 · Y0051 담낭질환</strong> — recall 0%. v0.1에 적응 룰이 없거나 거의 작동 안 함. v0.2 우선 보강 대상.</p>
      </div>

      <div class="callout warn">
        <div class="title">Massive over-trigger</div>
        <p><strong>Y0032 뇌출혈</strong>: 신경계 카테고리 광범위 trigger로 13,929 FP. <strong>Y0010·Y0041</strong>: 흉통 환자에 두 후보 모두 자동 trigger되어 specificity 손실. v0.2에서 specific feature 한정 narrowing 필요.</p>
      </div>
    </div>
  </section>

  <section class="chapter">
    <div class="tag"><span class="num">04</span>Stratified</div>
    <div>
      <h2>Grade 1 (소생) sensitivity 18.5% — 가장 위급한 환자의 80%가 unmapped.</h2>

      <h3>By Pre-KTAS grade</h3>
      <table class="data">
        <thead><tr><th>Grade</th><th class="num">N</th><th class="num">Sens</th><th class="num">Spec</th><th>해석</th></tr></thead>
        <tbody>
${['1','2','3','4','5'].filter(g => stratified.by_grade[g]).map(g => {
  const v = stratified.by_grade[g];
  const m = v.metrics;
  const note = g === '1' ? '소생 — 가장 위급. <strong style="color:var(--accent)">v0.1 fail</strong>' :
               g === '5' ? '비응급 — sens 낮음 의도된 결과' :
               g === '3' ? '응급 — 중간 표본 최대' : '—';
  return `          <tr><td>grade ${g}</td><td class="num">${v.n.toLocaleString()}</td><td class="num">${fmt(m.sensitivity, 3)}</td><td class="num">${fmt(m.specificity, 3)}</td><td>${note}</td></tr>`;
}).join('\n')}
        </tbody>
      </table>

      <h3>By age group</h3>
      <table class="data">
        <thead><tr><th>연령군</th><th class="num">N</th><th class="num">Sens</th><th class="num">Spec</th></tr></thead>
        <tbody>
${Object.entries(stratified.by_age_group).sort((a,b) => b[1].n - a[1].n).map(([k, v]) => {
  return `          <tr><td>${k}</td><td class="num">${v.n.toLocaleString()}</td><td class="num">${fmt(v.metrics.sensitivity, 3)}</td><td class="num">${fmt(v.metrics.specificity, 3)}</td></tr>`;
}).join('\n')}
        </tbody>
      </table>

      <h3>By region</h3>
      <table class="data">
        <thead><tr><th>지역</th><th class="num">N</th><th class="num">Sens</th><th class="num">Spec</th></tr></thead>
        <tbody>
${Object.entries(stratified.by_region).sort((a,b) => b[1].n - a[1].n).map(([k, v]) => {
  return `          <tr><td>${k}</td><td class="num">${v.n.toLocaleString()}</td><td class="num">${fmt(v.metrics.sensitivity, 3)}</td><td class="num">${fmt(v.metrics.specificity, 3)}</td></tr>`;
}).join('\n')}
        </tbody>
      </table>
      <p>지역별 차이 ±5%p 일관, 다만 cohort 자체가 광주·전남·전북 편중이라 외부 일반화 한계.</p>
    </div>
  </section>

  <section class="chapter">
    <div class="tag"><span class="num">05</span>v0.2 권고</div>
    <div>
      <h2>"활용 불가"는 v0.1 한정. v0.2 개선 방향은 specific.</h2>

      <h3>Critical (recall 0 카테고리 — sensitivity 회복 핵심)</h3>
      <ul>
        <li><strong>Y0141 응급HD / Y0142 CRRT (FN 약 3,000건)</strong>: 의식 U/V + 약물 중독 / level3·4 텍스트 매칭 ('산증', '고칼륨', '요독증', '심폐부종'). Frozen cluster의 R57.x 동반 split 정책 적용.</li>
        <li><strong>Y0060 복부응급수술 (FN 1,349건)</strong>: 소화기계 + level4 텍스트 매칭 ('복통 심함', '복막자극', '쇼크').</li>
        <li><strong>Y0051·Y0052 담낭/담도 (FN 741건)</strong>: level3·4 텍스트 '담낭', '우상복부 통증', '담관염', '황달' 매칭.</li>
      </ul>

      <h3>High (over-prediction 좁히기 — specificity 보전)</h3>
      <ul>
        <li><strong>Y0032 뇌출혈 13,929 FP</strong>: 신경계 전체에서 자동 trigger. '두부외상', '극심한 두통', '편마비' specific feature 한정.</li>
        <li><strong>Y0010·Y0041 흉통 split</strong>: 흉통 + 심전도 변화 명시 → Y0010만; 흉통 + 이동성 통증 → Y0041만.</li>
        <li><strong>Y0150 정신과 over-inclusion</strong>: 카테고리 전체 trigger → 자해·타해 risk feature 명시 시만.</li>
      </ul>

      <h3>Medium (recall 부족 카테고리)</h3>
      <ul>
        <li><strong>Y0082 위장관내시경(영유아) recall 0.18</strong>: pediatric grade 1-2 + level3 '출혈·이물' 매칭 강화.</li>
        <li><strong>Y0020 뇌경색 recall 0.69 → 0.85+</strong>: 신경계 grade 1-2 전체로 trigger 확대.</li>
      </ul>

      <div class="callout good">
        <div class="title">목표 (v0.2)</div>
        <p>Sensitivity ≥ 0.70, Specificity ≥ 0.75 — H1·H2 모두 통과 (한국 baseline). Critical rule 신규 + over-prediction 좁히기 동시 시도.</p>
      </div>
    </div>
  </section>

  <section class="chapter">
    <div class="tag"><span class="num">06</span>학술 정합성</div>
    <div>
      <h2>Honest reporting — 데이터 잠금 전 사전 등록.</h2>

      <p>본 연구는 STARD 2015 가이드라인 준수 retrospective observational diagnostic accuracy study다. Phase 8a-2 frozen reference standard(<a href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/y-code-icd10-clusters.json">y-code-icd10-clusters.json</a>) 동결 후 데이터 잠금 이전에 v1.1 amendment 작성. Index test는 commit hash로 동결.</p>

      <ul>
        <li><strong>Reference standard</strong>: 응급의학 전문의 1인 자문 (2026-04-25, ~1시간 43분). 27 Y코드 × ICD-10 cluster 결정. 2건 모호 사항(Y0042 sync, Y0160 conditional)은 추가 명시 확인.</li>
        <li><strong>Index test (v0.1)</strong>: <code>scripts/research/build-prektas-to-y-mapping.mjs</code> @ commit <code>f396343</code>. 12 도메인 룰 + 13 질문 카탈로그.</li>
        <li><strong>가설 임계값</strong>: 자문자가 4개 모두 0.80으로 통일 (한국 EM baseline 채택). 통상 triage 도구 0.85·0.90 임계 대신.</li>
        <li><strong>Pre-data-lock amendment v1.1</strong>: 임계값 4건 + Y코드 cluster 17건 변경. post-hoc 아님.</li>
      </ul>

      <div class="callout">
        <div class="title">결과의 학술적 의미</div>
        <p>본 결과는 "Pre-KTAS만으로 27 Y코드 매핑 가능한가?"라는 질문에 v0.1의 답이 "아직 부족하고 어디에서 부족한지 정량 측정됨"이라는 것이다. Negative result가 아닌 <strong>v0.2를 정확히 어디에 투자해야 할지 알려주는 actionable 결과</strong>다.</p>
      </div>
    </div>
  </section>

  <section class="chapter">
    <div class="tag"><span class="num">07</span>한계</div>
    <div>
      <h2>외부 일반화·reference standard·시뮬레이션의 한계.</h2>
      <ol>
        <li><strong>단일 cohort, retrospective</strong>: 광주·전남·전북 편중. 수도권·기타 외부 검증 부재.</li>
        <li><strong>ICD-10 reference standard imperfection</strong>: Y코드는 시술·자원 정의이지 진단 정의가 아니다. 자문자 cluster mapping은 1인 임상 판단.</li>
        <li><strong>Pre-KTAS 5/6자 crosswalk 가설</strong> (suffix 0/9 = adult/pediatric): 23.9% unique codes 미매핑, visit-weighted 영향 27.5%.</li>
        <li><strong>Oracle simulation의 단순성</strong>: ground truth가 candidates에 있으면 정답 도달 가정. Best-case 추정.</li>
        <li><strong>Conditional include / clinical_split 미적용</strong>: Y0091 R04.2, Y0160 S05.0, Y0171 I26.x, Y0141·Y0142 split 등은 단순 prefix matching만 적용. Phase 8c+ 별도 sub-analysis 권고.</li>
        <li><strong>Pre-KTAS 코드 부여의 inter-rater reliability</strong>는 본 연구 범위 외.</li>
      </ol>
    </div>
  </section>

  <section class="chapter">
    <div class="tag"><span class="num">08</span>산출물</div>
    <div>
      <h2>모든 결과 + 코드 + 데이터.</h2>

      <div class="file-grid">
        <a class="file" href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/prektas-validation-report-v1.0.md">
          <div class="fname">prektas-validation-report-v1.0.md</div>
          <div class="fdesc">9 섹션 최종 보고서. 가장 먼저 보세요.</div>
        </a>
        <a class="file" href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/validation-results-v0.1.json">
          <div class="fname">validation-results-v0.1.json</div>
          <div class="fdesc">Primary metrics + 27 Y-code per-class</div>
        </a>
        <a class="file" href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/validation-stratified.json">
          <div class="fname">validation-stratified.json</div>
          <div class="fdesc">region/age/grade stratified</div>
        </a>
        <a class="file" href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/validation-error-audit.json">
          <div class="fname">validation-error-audit.json</div>
          <div class="fdesc">Top 50 FN/FP patterns</div>
        </a>
        <a class="file" href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/y-code-icd10-clusters.json">
          <div class="fname">y-code-icd10-clusters.json</div>
          <div class="fdesc">Frozen reference standard v1.0</div>
        </a>
        <a class="file" href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/prektas-validation-protocol.md">
          <div class="fname">prektas-validation-protocol.md</div>
          <div class="fdesc">Protocol v1.1 (사전 등록 분석 계획)</div>
        </a>
        <a class="file" href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/prektas-code-crosswalk.json">
          <div class="fname">prektas-code-crosswalk.json</div>
          <div class="fdesc">5자 ↔ 6자 코드 정렬</div>
        </a>
        <a class="file" href="https://github.com/Pandoll-AI/emris-119chat/blob/main/scripts/research/validate-phase8.py">
          <div class="fname">validate-phase8.py</div>
          <div class="fdesc">Phase 8b–f 통합 분석 스크립트</div>
        </a>
      </div>

      <h3>재현</h3>
      <div class="pipeline"><pre>git clone https://github.com/Pandoll-AI/emris-119chat
cd emris-119chat
git checkout f396343  # frozen index test

python3 scripts/research/validate-phase8.py
# Outputs:
#   research/validation-results-v0.1.json
#   research/validation-stratified.json
#   research/validation-error-audit.json</pre></div>
    </div>
  </section>

  <footer class="page-end">
    <div><span class="version-tag">report v${REPORT_VERSION}</span> · <span class="version-tag">protocol v${PROTOCOL_VERSION}</span> · <span class="version-tag">${PROTOCOL_ID}</span> · ${ANALYSIS_DATE}</div>
    <div><a href="prektas-consultation.html">→ 자문 도구</a> · <a href="prektas-hospital-recommender.html">→ 추천 도구</a> · <a href="https://119chat.emergency-info.com">→ Chatbot</a></div>
  </footer>
</div>
</body>
</html>
`;

fs.writeFileSync(output, html);
console.log('Wrote ' + path.relative(repoRoot, output));
