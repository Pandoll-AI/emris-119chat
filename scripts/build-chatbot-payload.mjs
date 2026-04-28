#!/usr/bin/env node

/**
 * 챗봇용 정본 데이터 페이로드 빌더 (Phase 11f).
 *
 * v0.3 매핑 결과 + 매핑성 매트릭스를 합쳐 lib/chatbot-payload.js 생성.
 * index.html이 <script src="lib/chatbot-payload.js"> 로 로드. window.PrektasData expose.
 *
 * Lite payload (v0.3 schema):
 * - entries: 4,689 codes × {c, g, gr, l2c/l2n, l3c/l3n, l4c/l4n}
 * - rec: code → { y(flat), m(mappability), yc(confidence map), t(tier), qs(questions), ct(c_tier_codes) }
 * - questions: v0.3 question catalog (id → {prompt, options, purpose})
 * - questionEffects: id → option_idx → {y_keep|y_remove|tags}
 * - diseases: 27 Y코드 정의
 * - yTier: Y코드 → tier acceptable
 * - tierDefinitions: tier → label
 *
 * 변경 (v0.1 → v0.3):
 * - rec.y: flat list (backward compat, confident + candidate 모두)
 * - rec.m: 'A' | 'B' | 'C' | 'unmapped' (LLM/UI가 표현 분기에 사용)
 * - rec.yc: { code: 'confident'|'candidate' } map
 * - rec.t: v0.3 tier_recommendation (preferred/acceptable/source)
 * - rec.qs: v0.3 entry별 질문 ID 리스트
 * - rec.ct: c_tier_codes (단정 X, tier 권고용 Y)
 * - questionEffects 신규 6개: dyspnea_history, dyspnea_severity, rosc_status,
 *   neonatal_assessment, pregnancy_emergency, airway_burn
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'lib');
const output = path.join(outputDir, 'chatbot-payload.js');

const codebook = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/prektas-codebook.json'), 'utf8'));
const v03 = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/prektas-to-y-mapping-v0.3.json'), 'utf8'));
const tierDoc = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/prektas-tier-recommendation.json'), 'utf8'));
const diseases = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/emris-severe-emergency-diseases.json'), 'utf8'));
const yTierDoc = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/y-code-to-center-tier.json'), 'utf8'));
const matrix = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research/y-code-mappability-matrix.json'), 'utf8'));

// v0.3 mappings → rec[code] 압축 형태
const recByCode = {};
for (const m of v03.mappings) {
  const yFlat = (m.y_candidates || []).map(c => c.code);
  const ycMap = {};
  for (const c of m.y_candidates || []) ycMap[c.code] = c.confidence;
  recByCode[m.code] = {
    y: yFlat,
    m: m.mappability,
    yc: ycMap,
    t: m.tier_recommendation || null,
    qs: m.questions || [],
    ct: m.c_tier_codes || [],
    cpr: m.cpr_special || false,
  };
}

const yTier = {};
for (const t of yTierDoc.y_code_tiers) yTier[t.code] = t.acceptable;

// questionEffects — v0.1 9개 + v0.3 신규 6개.
// 신규 질문은 일부만 Y filtering (neonatal·pregnancy), 나머지(dyspnea·rosc·airway)는 tags로 LLM·UI에 전달.
const questionEffects = {
  // ── 기존 v0.1 ──
  chest_pain_character: { options: [
    { y_keep: ['Y0010'] },
    { y_keep: ['Y0041', 'Y0042'] },
    { y_keep: null },
  ]},
  aortic_location: { options: [
    { y_keep: ['Y0010', 'Y0041'] },
    { y_keep: ['Y0042'] },
  ]},
  onset_time_stroke: { options: [
    { y_keep: null },
    { y_remove: ['Y0020'] },
    { y_remove: ['Y0020'] },
  ]},
  trauma_or_spontaneous: { options: [
    { y_keep: ['Y0032'] },
    { y_remove: ['Y0032'] },
  ]},
  pregnancy_status: { options: [
    { y_keep: ['Y0111', 'Y0112'] },
    { y_keep: ['Y0111', 'Y0112'] },
    { y_keep: ['Y0113'] },
    { y_keep: null },
  ]},
  foreign_body_site: { options: [
    { y_keep: ['Y0082'] },
    { y_keep: ['Y0092'] },
  ]},
  burn_severity: { options: [
    { y_keep: ['Y0120'] },
    { y_remove: ['Y0120'] },
    { y_remove: ['Y0120'] },
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
  // psychiatric_intent (v0.3 — Y0150 confident vs not)
  psychiatric_intent: { options: [
    { y_keep: ['Y0150'] },
    { y_remove: ['Y0150'] },
  ]},
  // eye_severity (v0.3 — Y0160 confident vs not)
  eye_severity: { options: [
    { y_keep: ['Y0160'] },
    { y_keep: ['Y0160'] },
    { y_remove: ['Y0160'] },
  ]},

  // ── v0.3 신규 ──
  dyspnea_history: {
    multi_select: true,
    options: [
      { tags: ['cardiac_history'] },                   // 심장질환
      { tags: ['renal_history', 'dialysis_likely'] },  // 신기능 저하/투석
      { tags: ['copd_history'] },                      // 만성 호흡기
      { tags: ['infectious', 'isolation_required'] },  // 감염성 → 격리병상 필요
      { tags: [] },                                     // 없음
    ],
  },
  dyspnea_severity: {
    multi_select: true,
    options: [
      { tags: ['ventilator_likely'] },                 // SpO2 ≤92%
      { tags: ['ventilator_likely'] },                 // 대화 어려운 호흡곤란
      { tags: ['ventilator_likely', 'icu_required'] }, // 의식 저하/혼수
      { tags: [] },                                     // 없음
    ],
  },
  rosc_status: {
    options: [
      { tags: ['rosc_achieved', 'hypothermia_treatment'], tier_override: 'regional' },          // ROSC 달성 → 권역 (저체온치료)
      { tags: ['rosc_unsuccessful', 'nearest_facility'], tier_override: 'local_institution' },  // ROSC 미달성 → 가장 가까운
      { tags: ['cpr_in_progress'], tier_override: 'local_institution' },
    ],
  },
  neonatal_assessment: {
    multi_select: true,
    options: [
      { y_keep: ['Y0100'], tags: ['preterm', 'nicu_required'] },          // <37주
      { y_keep: ['Y0100'], tags: ['low_birth_weight', 'nicu_required'] }, // <2500g
      { y_keep: ['Y0100'], tags: ['neonatal_distress', 'nicu_required'] },// 호흡부전·청색증
      { y_remove: ['Y0100'], tags: [] },                                   // 정상
    ],
  },
  pregnancy_emergency: {
    options: [
      { y_keep: ['Y0111', 'Y0100', 'Y0112'], tags: ['amniotic_leak', 'delivery_room_required'] }, // 양수누출
      { y_keep: ['Y0112'], tags: ['placenta_previa', 'obstetric_surgery'] },                        // 무통성 출혈
      { y_keep: ['Y0112'], tags: ['placenta_abruption', 'obstetric_surgery'] },                     // 복통+출혈
      { y_keep: ['Y0111'], tags: ['active_labor', 'delivery_room_required'] },                      // 진통
      { tags: [] },                                                                                  // 없음
    ],
  },
  airway_burn: {
    options: [
      { y_keep: ['Y0091', 'Y0120'], tags: ['inhalation_injury', 'bronchoscopy_required'] },         // 의심 → ·성인 기관지 내시경· 추가
      { y_remove: ['Y0091'], tags: [] },                                                              // 없음
    ],
  },
};

// Lite entries — 키 단축
const liteEntries = codebook.entries.map((e) => ({
  c: e.code, g: e.group, gr: e.grade,
  l2c: e.level2.code, l2n: e.level2.name,
  l3c: e.level3.code, l3n: e.level3.name,
  l4c: e.level4.code, l4n: e.level4.name,
}));

const payload = {
  meta: {
    codebook_version: codebook.version,
    mapping_version: v03.version,
    matrix_version: matrix.version,
    generated_at: new Date().toISOString(),
  },
  entries: liteEntries,
  rec: recByCode,
  questions: v03.question_catalog,
  questionEffects,
  diseases: diseases.diseases,
  yTier,
  tierDefinitions: tierDoc.tier_definitions,
  strategyDefinitions: tierDoc.strategy_definitions,
  // v0.3 신규: equipment_dimensions metadata (LLM이 tags 해석 시 참조)
  equipmentDimensions: {
    isolation_required: '음압격리(npir)/일반격리(generalAvailable)/코호트격리(cohortAvailable) 중 우선',
    ventilator_likely: 'SpO₂ ≤92% / 대화 불능 / 의식 저하 — EMRIS API에 별도 필드 없음. erMessages "장비 부족" 단서.',
    nicu_required: 'NICU/incubator — EMRIS API에 별도 필드 없음. childEmergencyAvailable로 부분 추정.',
    delivery_room_required: 'deliveryRoomAvailable',
    bronchoscopy_required: '·성인 기관지 내시경· 가용 (Y0091 EP-08)',
    obstetric_surgery: '·산과 응급수술· 가용 (Y0112 EP-08)',
    icu_required: '중환자실 카테고리 (EP-06/EP-07)',
    hypothermia_treatment: '저체온치료 — 별도 필드 없음. 권역응급의료센터 직송 권고.',
    nearest_facility: 'ROSC 미달성 시 가장 가까운 병원 (등급 무관).',
  },
};

// catalog options ↔ questionEffects 정합성 검증.
// entry.qs에 부여된 모든 question은 catalog에 옵션 라벨이 있어야 하고,
// 그 길이가 effects 옵션 길이와 일치해야 한다. 어긋나면 빌드 실패시켜
// 챗봇 런타임에서 옵션 라벨 누락/포지셔널 컨트랙트 깨짐을 사전 차단한다.
{
  const usedQids = new Set();
  for (const rec of Object.values(recByCode)) {
    for (const qid of (rec.qs || [])) usedQids.add(qid);
  }
  const errors = [];
  for (const qid of usedQids) {
    const q = payload.questions[qid];
    const eff = payload.questionEffects[qid];
    if (!q) { errors.push(`[catalog 누락] ${qid} — entry.qs에 부여됐지만 question_catalog에 정의 없음`); continue; }
    if (!eff || !Array.isArray(eff.options)) { errors.push(`[effects 누락] ${qid}`); continue; }
    if (!Array.isArray(q.options) || q.options.length === 0) {
      errors.push(`[options 라벨 누락] ${qid} — effects.options=${eff.options.length}개 있는데 catalog options 비어있음`);
      continue;
    }
    if (q.options.length !== eff.options.length) {
      errors.push(`[옵션 개수 불일치] ${qid} — catalog=${q.options.length}, effects=${eff.options.length}`);
    }
  }
  if (errors.length > 0) {
    console.error('chatbot-payload 정합성 검증 실패:');
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
}

const json = JSON.stringify(payload).replace(/</g, '\\u003c');

const js = `/* AUTO-GENERATED by scripts/build-chatbot-payload.mjs — DO NOT EDIT */
/* Phase 11f: 챗봇 v0.3 매핑 페이로드 (mappability + confidence + 신규 질문 catalog) */
window.PrektasData = ${json};
`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(output, js);
const sizeKB = (js.length / 1024).toFixed(1);
console.log('Wrote ' + path.relative(repoRoot, output));
console.log('  size: ' + sizeKB + ' KB');
console.log('  entries=' + liteEntries.length + ', diseases=' + payload.diseases.length + ', y_tier=' + Object.keys(yTier).length);
console.log('  mapping=v' + v03.version + ', matrix=v' + matrix.version);
const byMap = {};
for (const r of Object.values(recByCode)) byMap[r.m] = (byMap[r.m]||0)+1;
console.log('  mappability:', byMap);
