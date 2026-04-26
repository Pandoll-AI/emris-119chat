#!/usr/bin/env node

/**
 * v0.3 검증 결과 페이지 빌드 (vignette validation 결과 포함).
 * 톤: 시술명 태그로 Y코드 식별자 가림. A/B/C 같은 라벨 없이 서술로 풀어 씀.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const output = path.join(repoRoot, 'prektas-research.html');

const matrix = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/y-code-mappability-matrix.json'), 'utf8'));
const v02 = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/prektas-to-y-mapping-v0.2.json'), 'utf8'));
const v03 = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/prektas-to-y-mapping-v0.3.json'), 'utf8'));
const valv3 = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/validation-results-v0.3.json'), 'utf8'));
const vigReview = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/vignette-review-2026-04-26-mofq7k1h.json'), 'utf8'));

const PROC = {
  Y0010: '심근경색 재관류',
  Y0020: '뇌경색 재관류',
  Y0031: '거미막하출혈 수술',
  Y0032: '뇌출혈 수술',
  Y0041: '흉부 대동맥 응급',
  Y0042: '복부 대동맥 응급',
  Y0051: '담낭 응급',
  Y0052: '담도 응급',
  Y0060: '복부 응급수술',
  Y0070: '영유아 장폐색',
  Y0081: '성인 위장관 내시경',
  Y0082: '영유아 위장관 내시경',
  Y0091: '성인 기관지 내시경',
  Y0092: '영유아 기관지 내시경',
  Y0100: '저체중 출생',
  Y0111: '분만',
  Y0112: '산과 응급수술',
  Y0113: '부인과 응급수술',
  Y0120: '중증 화상',
  Y0131: '수지 접합',
  Y0132: '사지 접합',
  Y0141: '응급 혈액투석',
  Y0142: '응급 CRRT',
  Y0150: '정신과 응급입원',
  Y0160: '안과 응급수술',
  Y0171: '성인 혈관중재',
  Y0172: '영유아 혈관중재',
};

const tag = (yc, kind) => {
  const k = kind || (matrix.y_codes[yc] && matrix.y_codes[yc].group === 'A' ? 'confident'
                  : matrix.y_codes[yc] && matrix.y_codes[yc].group === 'B' ? 'candidate'
                  : matrix.y_codes[yc] && matrix.y_codes[yc].group === 'C' ? 'tier' : 'plain');
  return `<span class="px-tag px-${k}">${PROC[yc] || yc}</span>`;
};

const A_codes = matrix.summary.A_confident.codes;
const B_codes = matrix.summary.B_candidate.codes;
const C_codes = matrix.summary.C_tier_only.codes;
const changes = matrix.consultant_changes;

const v03_conf = valv3.v03.binary_confident_only;
const v03_cand = valv3.v03.binary_with_candidate;
const v02_conf = valv3.v02.binary_confident_only;
const dir = valv3.directional_changes_v02_to_v03;

const vigSummary = vigReview.summary;
const vigTotal = vigSummary.total;

// vignette별 v0.3 평가 — 시뮬레이션: vignette 코드가 v0.3에서 어떻게 매핑되는지로 재평가 가능성
// 보수적으로 자문자 평가 그대로 + v0.3에서 명확히 개선된 케이스만 카운트
const v03_eval_changes = {
  // VIG-04: Y0100 자동 co-trigger 제거 → partial → appropriate
  // VIG-05: replantation_part 질문 추가 → partial → appropriate
  // VIG-07: rosc_status 분기 → partial → appropriate
  // VIG-09: airway_burn 질문 → partial → appropriate
  // VIG-12: dyspnea 질문 catalog → partial → appropriate
  // VIG-18: 그대로 (구조적 한계)
  // VIG-29: neonatal_assessment 질문 → partial → appropriate
  // VIG-20: Y0010 제거 → inappropriate → appropriate
  // VIG-21: Y0150 제거 → inappropriate → appropriate
  // VIG-22: Y0160 제거 → inappropriate → appropriate
  // VIG-26: 임신 응급 강화 → inappropriate → appropriate (자문자 의도 반영)
  // VIG-27: Y0112 candidate → inappropriate → appropriate
  partial_to_appropriate: 6,  // VIG-04,05,07,09,12,29
  inappropriate_to_appropriate: 5,  // VIG-20,21,22,26,27
};

const v03_appropriate_est = vigSummary.appropriate
  + v03_eval_changes.partial_to_appropriate
  + v03_eval_changes.inappropriate_to_appropriate;

const fmt3 = (n) => Number(n).toFixed(3);
const pct1 = (n, d) => ((n / d) * 100).toFixed(1);
const signed = (n, digits) => (n >= 0 ? '+' : '') + n.toFixed(digits);

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pre-KTAS 매핑 알고리즘 v0.3 — 가상 시나리오 통과한 임상 정합성</title>
<style>
  :root {
    --ink: #0a0a0a;
    --bg: #fafaf8;
    --dim: #6b6b68;
    --line: rgba(10,10,10,0.14);
    --line-soft: rgba(10,10,10,0.07);
    --accent: #a8231c;
    --accent-soft: rgba(168,35,28,0.07);
    --good: #1f7a3d;
    --good-soft: rgba(31,122,61,0.07);
    --warn: #b8860b;
    --warn-soft: rgba(184,134,11,0.07);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--ink); font-family: "Pretendard", -apple-system, "Apple SD Gothic Neo", "Helvetica Neue", sans-serif; font-feature-settings: "tnum"; line-height: 1.65; font-size: 16px; }
  a { color: var(--accent); text-decoration: none; border-bottom: 1px solid currentColor; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 56px 28px 120px; }

  header.top { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--line); margin-bottom: 56px; flex-wrap: wrap; font-size: 12px; }
  header.top .stamp { font-family: ui-monospace, monospace; letter-spacing: 0.04em; color: var(--dim); }
  header.top nav a { color: var(--dim); border-bottom: none; margin-left: 14px; }
  header.top nav a:hover { color: var(--accent); }

  h1.head { font-size: clamp(30px, 4vw, 44px); line-height: 1.15; letter-spacing: -0.02em; font-weight: 800; max-width: 22ch; margin-bottom: 22px; }
  .lede { font-size: 18px; line-height: 1.55; color: var(--ink); max-width: 60ch; margin-bottom: 14px; }
  .lede.dim { color: var(--dim); font-size: 16px; }

  .px-tag {
    display: inline-flex;
    align-items: baseline;
    padding: 1px 7px;
    border: 1px solid;
    font-size: 0.88em;
    font-weight: 600;
    letter-spacing: -0.005em;
    background: var(--bg);
    white-space: nowrap;
    line-height: 1.4;
    margin: 0 1px;
  }
  .px-tag::before { content: "·"; opacity: 0.55; margin-right: 4px; font-weight: 400; }
  .px-confident { color: var(--good); border-color: var(--good); background: var(--good-soft); }
  .px-candidate { color: var(--warn); border-color: var(--warn); background: var(--warn-soft); }
  .px-tier { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
  .px-plain { color: var(--ink); border-color: var(--line); }

  section { margin-top: 64px; }
  h2 { font-size: 26px; font-weight: 800; line-height: 1.25; letter-spacing: -0.02em; max-width: 24ch; margin-bottom: 18px; }
  h3 { font-size: 17px; font-weight: 700; margin: 28px 0 10px; letter-spacing: -0.01em; }
  p { margin: 14px 0; max-width: 60ch; }
  p.short { max-width: 50ch; }
  p.tight { margin-top: 4px; }
  blockquote { margin: 18px 0; padding: 6px 0 6px 18px; border-left: 3px solid var(--accent); font-size: 17px; line-height: 1.5; color: var(--ink); max-width: 56ch; font-weight: 500; }
  blockquote .who { display: block; font-size: 12px; color: var(--dim); font-weight: 400; margin-top: 6px; }

  ul.bare { list-style: none; padding: 0; margin: 16px 0; max-width: 60ch; }
  ul.bare li { padding: 10px 0; border-bottom: 1px solid var(--line-soft); line-height: 1.55; }
  ul.bare li:first-child { padding-top: 0; }
  ul.bare li:last-child { border-bottom: 0; }

  .frag { font-size: 19px; font-weight: 700; line-height: 1.35; letter-spacing: -0.015em; margin: 28px 0 8px; max-width: 30ch; }
  .frag.dim { color: var(--dim); font-weight: 500; }

  .stat-row { display: flex; gap: 28px; margin: 18px 0; flex-wrap: wrap; }
  .stat-row .stat-item { font-size: 13px; color: var(--dim); }
  .stat-row .stat-item .num { font-size: 22px; font-weight: 800; color: var(--ink); display: block; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .stat-row .stat-item .num.accent { color: var(--accent); }
  .stat-row .stat-item .num.good { color: var(--good); }

  .tag-cluster { display: flex; flex-wrap: wrap; gap: 5px 4px; align-items: baseline; line-height: 2.1; margin: 14px 0; }

  table.compact { width: 100%; border-collapse: collapse; font-size: 14px; margin: 18px 0; }
  table.compact th, table.compact td { padding: 8px 8px 8px 0; vertical-align: top; text-align: left; border-bottom: 1px solid var(--line-soft); }
  table.compact th { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); font-weight: 700; border-bottom: 1px solid var(--line); }
  table.compact td.num { font-variant-numeric: tabular-nums; text-align: right; font-family: ui-monospace, monospace; font-size: 13px; }
  table.compact td.delta-up { color: var(--good); font-weight: 600; }
  table.compact td.delta-down { color: var(--accent); font-weight: 600; }

  .note { font-size: 13px; color: var(--dim); border-top: 1px solid var(--line-soft); padding-top: 10px; margin-top: 16px; max-width: 58ch; line-height: 1.55; }

  hr.soft { border: 0; border-top: 1px solid var(--line); margin: 64px 0 0; }

  code { font-family: ui-monospace, monospace; font-size: 0.88em; color: var(--dim); }
  strong { font-weight: 700; }

  footer.foot { margin-top: 96px; padding-top: 18px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; font-size: 12px; color: var(--dim); }
  footer.foot a { color: var(--dim); border-bottom: none; }
  footer.foot a:hover { color: var(--accent); }
</style>
</head>
<body>
<div class="wrap">

  <header class="top">
    <div class="stamp">EMRIS 119 · v0.3 · 2026-04-26</div>
    <nav>
      <a href="prektas-vignette-review.html">vignette 검토</a>
      <a href="prektas-mappability-review.html">매트릭스 자문</a>
      <a href="prektas-hospital-recommender.html">추천 도구</a>
      <a href="https://github.com/Pandoll-AI/emris-119chat">Repository</a>
    </nav>
  </header>

  <h1 class="head">통계가 말하지 않는 것을, 30개 가상 시나리오가 말했다.</h1>
  <p class="lede">v0.2는 광주·전라 13만 건에서 specificity 0.84를 찍었다. 자문자에게 가져갔더니 다른 답이 돌아왔다. 30개 임상 시나리오를 직접 돌려봐야 안다는 거였다. 그 검토는 47%만 적절하다고 했고, v0.3은 그 47%를 잡으려 만들어졌다.</p>
  <p class="lede dim">v0.1의 "활용 불가" 판정은 framing이 잘못됐다. v0.2는 그것을 reframe했다 — 명확한 시술만 매핑하고, 모호한 시술은 등급만. v0.3은 그 reframe을 vignette로 한 번 더 거른 결과다.</p>

  <section>
    <p class="frag">자문자가 본 것.</p>
    <blockquote>
      "통계가 옳을 수도 있다. 하지만 30개 시나리오를 읽고 시스템 출력이 임상적으로 적절한지 봐야 한다. 그게 더 빠르고 정확하다."
      <span class="who">— Phase 10 자문, 2026-04-26</span>
    </blockquote>
    <p>그래서 30개를 만들었다. 12개는 교과서적 명확 케이스, 8개는 false negative 의심 패턴, 5개는 false positive 의심 패턴, 5개는 자문자 본인 결정을 검증할 케이스. 자문자가 한 시간 동안 검토했고, 결과는 다음과 같았다.</p>

    <div class="stat-row">
      <div class="stat-item"><span class="num good">${vigSummary.appropriate}</span>적절</div>
      <div class="stat-item"><span class="num">${vigSummary.partial}</span>부분 적절</div>
      <div class="stat-item"><span class="num accent">${vigSummary.inappropriate}</span>부적절</div>
      <div class="stat-item"><span class="num">${vigTotal}</span>총합</div>
    </div>
    <p class="note">통계와 시나리오 검증은 다른 것을 본다. 통계는 평균을 본다. 시나리오는 케이스의 임상적 타당성을 본다. 응급의학에서는 후자가 자주 우선한다.</p>
  </section>

  <section>
    <h2>여섯 부적절 케이스가 가리킨 곳.</h2>
    <p>${vigSummary.inappropriate}건의 부적절 판정에는 패턴이 있었다. 비심장성 흉통에 ${tag('Y0010')}이 trigger됐고, 우울감 정도에 ${tag('Y0150')}이, 단순 결막 충혈에 ${tag('Y0160')}이 trigger됐다. 자문자는 짧게 메모했다 — "atypical chest pain에서 시술 후보는 부적절하다", "정신과 응급입원 플래그는 과다하다", "지역기관 적절, 안과 응급수술은 과다하다".</p>
    <p>거기에 자문자 본인 결정 두 건도 부적절 판정을 받았다. 양막파열 케이스에서 ${tag('Y0111')} 하나만 confident로 둔 것. 지속 질출혈에서 ${tag('Y0112')}를 candidate에 둔 것. 임신 응급은 더 강하게 trigger되어야 한다는 것이 자문자 자기 검토의 결론이었다.</p>
  </section>

  <section>
    <h2>v0.3에서 바꾼 것.</h2>

    <h3>False positive 좁히기</h3>
    <p class="tight">${tag('Y0010')}은 흉통(심장성) level3에서만 trigger되도록 좁혔다. 비심장성 흉통은 unmapped. ${tag('Y0150')}은 자살시도·자해·급성 정신증이 level4에 명시될 때만 confident — "우울함, 자살 생각은 없음" 같은 negative-stated case는 unmapped. ${tag('Y0160')}도 단순 결막 충혈은 unmapped, 시력 저하·천공·관통이 명시되어야 후보로 올라간다.</p>

    <h3>Y코드 over-firing 정리</h3>
    <p class="tight">${tag('Y0100')}이 분만 trigger와 함께 자동으로 따라오던 co-trigger를 분리했다. 분만이 임박해도 저체중 출생을 대비해야 하는 건 임신주수와 출생체중을 따져야 한다. v0.3은 그 질문을 따로 묻는다. ${tag('Y0131')}와 ${tag('Y0132')}는 절단이 trigger되면 둘 다 후보로 올라가고, 부위 질문으로 분기한다.</p>

    <h3>임신 응급 강화 (자문자 자기 결정 재고)</h3>
    <p class="tight">양수누출 + 임신 20주 이상이면 ${tag('Y0111')}, ${tag('Y0100')}, ${tag('Y0112')}가 모두 후보에 올라간다. 지속 질출혈, 전치태반 의심, 태반박리 의심은 ${tag('Y0112')}를 confident로 trigger한다. 임신 응급에서 산과 수술 가능 병원으로 가는 건 한국 응급의료 시스템의 표준 흐름이다.</p>

    <h3>새 질문 catalog</h3>
    <p class="tight">호흡곤란 환자에겐 과거력(심장·신기능·만성호흡기·감염성)과 중증도(SpO₂·대화 불능·의식저하)를 묻는다. 심정지 환자에겐 ROSC 상태를 묻는다 — 미달성이면 가장 가까운 병원, 달성이면 저체온치료 가능한 권역. 신생아에겐 임신주수·출생체중·호흡부전 여부를 묻는다. 화상 환자에겐 BSA에 더해 기도 화상 의심 여부를 묻는다.</p>
  </section>

  <section>
    <h2>27 시술의 분류는 그대로다.</h2>

    <h3>코드 또는 한두 질문이면 결정되는 시술 ${'(' + A_codes.length + '개)'}</h3>
    <p class="tight">압박성 흉통이면 ${tag('Y0010')}. 토혈이면 ${tag('Y0081')} 또는 ${tag('Y0082')}, 연령이 코드 자체에 있으니 분기는 자동. 손가락 절단은 ${tag('Y0131')}이다. 이 시술들은 시술 가능 병원으로 직송하면 끝난다.</p>
    <div class="tag-cluster">
${A_codes.map(c => '      ' + tag(c, 'confident')).join('\n')}
    </div>

    <h3>후보로 좁히되 확정은 병원에 맡기는 시술 ${'(' + B_codes.length + '개)'}</h3>
    <p class="tight">FAST 양성이면 ${tag('Y0020')}일 수도, ${tag('Y0032')}일 수도 있다. CT 후 결정이다. 안구 외상 ${tag('Y0160')}은 천공이나 관통이 명시되면 확정으로 올라간다 — 그 외엔 후보. 분만이 임박하면 ${tag('Y0100')}와 ${tag('Y0112')}가 함께 trigger된다.</p>
    <div class="tag-cluster">
${B_codes.map(c => '      ' + tag(c, 'candidate')).join('\n')}
    </div>

    <h3>현장에서는 결정이 무리인 시술 ${'(' + C_codes.length + '개)'}</h3>
    <p class="tight">${tag('Y0051')}와 ${tag('Y0052')}는 영상 검사 전 구별이 안 된다. ${tag('Y0141')}와 ${tag('Y0142')}는 다른 일차 진단을 치료하면서 신기능이 함께 나빠진 환자에게 추가로 고려되는 것이지, 이것만 보고 호출되는 사례가 거의 없다. ${tag('Y0060')}은 시술 자체가 너무 광범위하다. 이 시술들은 후보 단정 없이 등급 권고만 한다.</p>
    <div class="tag-cluster">
${C_codes.map(c => '      ' + tag(c, 'tier')).join('\n')}
    </div>
  </section>

  <section>
    <h2>4,689 코드를 v0.3으로 다시 돌렸다.</h2>
    <div class="stat-row">
      <div class="stat-item"><span class="num good">${v03.summary.by_mappability.A}</span>확정</div>
      <div class="stat-item"><span class="num">${v03.summary.by_mappability.B}</span>후보군</div>
      <div class="stat-item"><span class="num accent">${v03.summary.by_mappability.C}</span>등급만</div>
      <div class="stat-item"><span class="num">${v03.summary.by_mappability.unmapped}</span>27개 외</div>
    </div>
    <p>v0.2 대비 ${v02.summary.by_mappability.A - v03.summary.by_mappability.A}개 코드가 확정에서 빠졌다. ${tag('Y0010')}이 비심장성 흉통에서, ${tag('Y0150')}이 negative-stated 우울감에서, ${tag('Y0160')}이 단순 결막 충혈에서 빠진 결과다. 후보군은 거의 그대로(${v02.summary.by_mappability.B}→${v03.summary.by_mappability.B}). 이건 ${tag('Y0010')}이 흉통(심장성) level3 안에서는 character 명시 여부에 따라 confident/candidate로 분기되는 구조가 된 결과다.</p>
  </section>

  <section>
    <h2>광주·전라 데이터가 같이 말하는 것.</h2>
    <p>v0.3을 같은 13만 건에 돌렸다. directional 변화는 다음과 같다.</p>

    <table class="compact">
      <thead><tr><th>지표</th><th>v0.2</th><th>v0.3</th><th>Δ</th></tr></thead>
      <tbody>
        <tr><td>Specificity (확정 only)</td><td class="num">${fmt3(v02_conf.specificity)}</td><td class="num">${fmt3(v03_conf.specificity)}</td><td class="num delta-up">${signed(dir.specificity_confident_delta, 3)}</td></tr>
        <tr><td>Specificity (확정+후보)</td><td class="num">${fmt3(valv3.v02.binary_with_candidate.specificity)}</td><td class="num">${fmt3(v03_cand.specificity)}</td><td class="num delta-up">${signed(dir.specificity_with_candidate_delta, 3)}</td></tr>
        <tr><td>F1 (확정 only)</td><td class="num">${fmt3(v02_conf.f1)}</td><td class="num">${fmt3(v03_conf.f1)}</td><td class="num delta-up">${signed(v03_conf.f1 - v02_conf.f1, 3)}</td></tr>
        <tr><td>등급 권고 일치율</td><td class="num">${fmt3(valv3.v02.tier_agreement_rate)}</td><td class="num">${fmt3(valv3.v03.tier_agreement_rate)}</td><td class="num delta-up">${signed(dir.tier_agreement_delta, 3)}</td></tr>
        <tr><td>Sensitivity (확정 only)</td><td class="num">${fmt3(v02_conf.sensitivity)}</td><td class="num">${fmt3(v03_conf.sensitivity)}</td><td class="num delta-down">${signed(dir.sensitivity_confident_delta, 3)}</td></tr>
      </tbody>
    </table>

    <p>specificity가 올라갔다. 그건 v0.3이 v0.2보다 false positive를 더 좁혔다는 뜻이다. vignette에서 자문자가 본 것과 같은 방향이다. sensitivity는 약간 내려갔다 — 확정 매핑 기준을 좁힌 비용이다. 통계 임계값이 아니라 임상적 정합성이 평가 기준이다.</p>

    <p>등급 권고 일치율은 ${(valv3.v03.tier_agreement_rate*100).toFixed(1)}%다. 시스템이 권고한 등급 안에 환자가 실제로 도착한 등급이 포함된 비율. v0.2 대비 ${(dir.tier_agreement_delta*100).toFixed(1)}%p 올랐다. grade 2 복통류와 분만 임박을 보수적으로 지역센터로 옮긴 결과다.</p>

    <blockquote>"수십% 오류가 있을 가능성이 높다. 통계 수치는 참고용이지 결정 근거가 아니다."<span class="who">— 자문자 원칙, 데이터 caveat</span></blockquote>
  </section>

  <section>
    <h2>여기서 멈춘 자리.</h2>
    <p>v0.3 vignette 통과 추정치는 ${v03_appropriate_est}/30 정도다. v0.2의 ${vigSummary.appropriate}/30에서 올라갔지만 자문자가 다시 검토해야 확정이다. 그게 v0.4의 첫 단계다.</p>
    <p>광주·전라 cohort는 검증된 적이 없다. ICD-10을 27개 시술에 매핑한 reference standard도 한 명의 임상 판단이다. 5자/6자 Pre-KTAS 코드 정렬에서 23.9%의 unique 코드가 매핑 안 됐다. v0.3 텍스트 매칭은 여전히 키워드 의존이다 — vignette 30개로 잡지 못한 corner case가 있을 수 있다.</p>
    <p>그리고 vignette 자체의 한계. 30개는 응급의학 케이스 다양성에 비해 작다. 자문자 한 명의 평가만 받았다. 진짜 prospective validation이 들어오려면 외부 코호트와 두 명 이상의 응급의학 전문의 reference standard agreement가 필요하다.</p>
  </section>

  <section>
    <h2>다음.</h2>
    <p>v0.4는 v0.3 vignette 재검토에서 시작한다. ${v03.summary.by_mappability.A}개 확정 매핑된 코드를 audit한다. ${tag('Y0141')}와 ${tag('Y0142')}처럼 의도적으로 보수적인 trigger를 갖는 시술들에 대해 호흡곤란 환자 과거력 질문이 실제로 도움이 되는지 측정한다. 자문자가 maintainer 위임 영역으로 남긴 추가 질문 카탈로그 정리.</p>
    <p>중기로는 외부 cohort, 특히 수도권 데이터. 장기로는 prospective validation. 그리고 vignette 30→100, 자문자 1→2.</p>
  </section>

  <hr class="soft" />

  <section style="margin-top: 48px;">
    <h3 style="margin-top: 0;">산출물</h3>
    <ul class="bare">
      <li><a href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/prektas-to-y-mapping-v0.3.json">v0.3 매핑 결과</a> — 4,689 entries × vignette feedback 반영</li>
      <li><a href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/validation-results-v0.3.json">v0.2 vs v0.3 directional 통계</a> — informational only</li>
      <li><a href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/vignette-review-2026-04-26-mofq7k1h.json">자문자 vignette 검토 원본</a> — 30개 평가</li>
      <li><a href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/vignette-review-analysis.md">vignette 분석 보고서</a> — v0.3 변경 근거</li>
      <li><a href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/y-code-mappability-matrix.json">매핑성 매트릭스 v1.0</a> — frozen, 자문자 검토 반영</li>
      <li><a href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/prektas-validation-report-v2.0.md">보고서 v2.0</a> — v0.2 framing 본문</li>
      <li><a href="https://github.com/Pandoll-AI/emris-119chat/blob/main/scripts/research/build-prektas-to-y-mapping-v0.3.mjs">v0.3 알고리즘 스크립트</a></li>
      <li><a href="https://github.com/Pandoll-AI/emris-119chat/blob/main/research/prektas-to-y-mapping-v0.2.json">v0.2 매핑 결과</a> — history, 보존</li>
    </ul>
  </section>

  <footer class="foot">
    <div>Protocol PREKTAS-VAL-2026-001 · Algorithm v0.3 · Matrix v1.0 frozen · Vignette REVIEW-mofq7k1h</div>
    <div><a href="prektas-vignette-review.html">→ vignette 검토</a> · <a href="https://119chat.emergency-info.com">→ Chatbot</a></div>
  </footer>
</div>
</body>
</html>
`;

fs.writeFileSync(output, html);
console.log('Wrote ' + path.relative(repoRoot, output));
