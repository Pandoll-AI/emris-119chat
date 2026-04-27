#!/usr/bin/env node

/**
 * Pre-KTAS → EMRIS 27 Y-codes 매핑 v0.3.
 *
 * v0.2 → v0.3 변경 (vignette validation 결과 기반):
 *   1. fp_pattern over-trigger 좁히기:
 *      - ·심근경색 재관류·: "압박" 단독 X, 활력 변화 동반 시만 confident
 *      - ·정신과 응급입원·: level3 진단명만 X, level4의 "자살시도/뚜렷한 자살의도" 명시 시만 confident
 *      - ·안과 응급수술·: 단순 결막 충혈 unmapped, 외상·시력 저하 동반 시만 candidate
 *   2. Y코드 over-firing 정리:
 *      - ·저체중 출생· 자동 co-trigger 제거 (분만 trigger와 분리)
 *      - ·사지 접합· 정밀 부위 분기 (수지 vs 사지)
 *      - ·성인 기관지 내시경· 화상+기도 화상 시 추가 candidate
 *   3. tier conservative shift (한국 응급의료 현실):
 *      - grade 2 복통류 → preferred=local_center
 *      - 분만 임박 → preferred=local_center (권역 강제 X)
 *   4. CPR/ROSC 분기 special rule
 *   5. 임신 응급 강화 (자문자 자기 결정 재고):
 *      - 양수누출 + 임신주수 → 분만·저체중·산과수술 후보
 *      - 임신 + 무통성 출혈 → 산과수술 confident
 *   6. 신규 추가 질문 catalog
 *
 * 자문자 vignette validation 적절성 47% → v0.3 목표 80%+
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const codebookPath = path.join(repoRoot, 'data/prektas-codebook.json');
const matrixPath = path.join(repoRoot, 'research/y-code-mappability-matrix.json');
const yTierPath = path.join(repoRoot, 'data/y-code-to-center-tier.json');
const outputPath = path.join(repoRoot, 'research/prektas-to-y-mapping-v0.3.json');

// ────────── Question catalog (v0.3 확장) ──────────
const QUESTIONS = {
  onset_time_stroke: { id: 'onset_time_stroke', prompt: '증상 발생 후 경과 시간은?', purpose: '뇌경색 재관류중재 적응' },
  trauma_or_spontaneous: { id: 'trauma_or_spontaneous', prompt: '외상 여부?', purpose: '외상성/자발성 뇌출혈 구분' },
  pregnancy_status: { id: 'pregnancy_status', prompt: '임신 상태는?', purpose: '산과/부인과 분기' },
  burn_severity: { id: 'burn_severity', prompt: '화상 중증도(BSA)?', purpose: '·중증 화상· 적응 판정' },
  airway_burn: { id: 'airway_burn', prompt: '기도 화상·연기 흡입 의심?', purpose: '·성인 기관지 내시경· 추가 candidate' },
  bleeding_site: { id: 'bleeding_site', prompt: '출혈 부위는?', purpose: '상부/하부 위장관 분기' },
  foreign_body_site: { id: 'foreign_body_site', prompt: '이물 부위?', purpose: '위장관/기도 분기' },
  chest_pain_character: { id: 'chest_pain_character', prompt: '흉통 양상 + 활력 변화?', purpose: '·심근경색 재관류· 적응' },
  replantation_part: { id: 'replantation_part', prompt: '절단 부위 (손가락·발가락 vs 팔·다리)?', purpose: '·수지 접합· vs ·사지 접합· 분기' },
  psychiatric_intent: { id: 'psychiatric_intent', prompt: '자살시도/자해 의도/급성 정신증 명시?', purpose: '·정신과 응급입원· 적응' },
  eye_severity: { id: 'eye_severity', prompt: '안구 외상·시력 저하·천공 여부?', purpose: '·안과 응급수술· 적응' },
  // v0.3 신규
  dyspnea_history: {
    id: 'dyspnea_history',
    prompt: '환자 과거력 (해당 모두)?',
    options: ['심장질환', '신기능 저하/투석 필요', '만성 호흡기 질환', '감염성 질환 (격리병상 필요)', '없음'],
    purpose: 'tier 결정 + ·응급 혈액투석·/·응급 CRRT· trigger 보강',
  },
  dyspnea_severity: {
    id: 'dyspnea_severity',
    prompt: '중증도 (해당 모두)?',
    options: ['SpO2 ≤92%', '대화 어려운 호흡곤란', '의식 저하/혼수', '없음'],
    purpose: '기계호흡 필요 → 권역 직송',
  },
  rosc_status: {
    id: 'rosc_status',
    prompt: 'CPR 후 ROSC 상태?',
    options: ['ROSC 달성', 'ROSC 미달성', 'CPR 진행 중'],
    purpose: 'ROSC 달성→권역(저체온치료), 미달성→가장 가까운 병원',
  },
  neonatal_assessment: {
    id: 'neonatal_assessment',
    prompt: '신생아 평가 (해당 모두)?',
    options: ['임신주수 <37주', '출생체중 <2500g', '호흡부전·청색증', '정상'],
    purpose: '·저체중 출생· trigger + NICU 권고',
  },
  pregnancy_emergency: {
    id: 'pregnancy_emergency',
    prompt: '임신 응급 신호?',
    options: ['양수누출', '무통성 출혈 (전치태반 의심)', '복통+출혈 (태반박리 의심)', '진통', '없음'],
    purpose: '·분만·/·산과 응급수술·/·저체중 출생· 분기',
  },
};

// ────────── Helpers ──────────
const hasAny = (text, words) => words.some((w) => text.includes(w));
const hasAll = (text, words) => words.every((w) => text.includes(w));

function loadJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

const codebook = loadJSON(codebookPath);
const matrix = loadJSON(matrixPath);
const yTier = loadJSON(yTierPath);

function ycodeGroup(yCode) {
  return matrix.y_codes[yCode] ? matrix.y_codes[yCode].group : null;
}

// ────────── Trigger rules (v0.3) ──────────

function ruleCardiac(entry, text) {
  if (entry.level2.name !== '심혈관계') return null;
  // v0.3: 비심장성 흉통은 unmapped, 심장성 흉통(level3)은 candidate 기본,
  //       level4에 "심장성 통증/심장성 흉통/압박/심근/STEMI" 명시 시 confident 승격.
  const cardiacL4 = hasAny(entry.level4.name, ['심장성 통증', '심장성 흉통', '압박', '조이', '쥐어짜', '심근', 'STEMI']);
  const tearing = hasAny(text, ['찢어', '이동성']);
  const chestCardiacL3 = entry.level3.name === '흉통(심장성)';
  const nonCardiacChestL3 = entry.level3.name === '흉통(비심장성)';
  const abdomen = hasAny(text, ['복부', '복통']);
  const shock = hasAny(entry.level4.name, ['쇼크', '혈역학적 장애']);

  // 비심장성 흉통은 trigger 안 함 (atypical chest pain over-trigger 제거)
  if (nonCardiacChestL3) return null;

  const triggered = new Set();
  const questions = [];
  const reasons = [];

  if (chestCardiacL3) {
    if (cardiacL4) {
      triggered.add('Y0010');
      questions.push(QUESTIONS.chest_pain_character.id);
      reasons.push('흉통(심장성) + 심장성 features → ·심근경색 재관류· confident');
    } else {
      // CICAx류 — level4가 호흡곤란/쇼크/의식변화 등이라도 심장성 흉통 맥락이면 candidate
      triggered.add('Y0010');
      questions.push(QUESTIONS.chest_pain_character.id);
      reasons.push('흉통(심장성) → ·심근경색 재관류· 후보 (level4 character 질문 필요)');
    }
    if (tearing) {
      triggered.add('Y0041');
      reasons.push('찢어지는 흉통 → ·흉부 대동맥 응급· tier 추가');
    }
  }

  // 박동성 복통 + 쇼크 → ·복부 대동맥 응급· tier
  if (abdomen && (tearing || hasAny(text, ['박동성']) || shock)) {
    triggered.add('Y0042');
    triggered.add('Y0060');
    reasons.push('박동성 복통 + 쇼크 의심 → 권역/지역센터 tier (·복부 대동맥 응급· / ·복부 응급수술·)');
  }

  if (triggered.size === 0) return null;
  return { triggered_y: triggered, questions, rationale: reasons.join('; ') };
}

function ruleNeuro(entry, text) {
  if (entry.level2.name !== '신경계') return null;
  // v0.3: Y0032 specific feature only (편마비/GCS/극심한 두통)
  const focalDeficit = hasAny(text, ['편마비', '사지약화', 'FAST', '뇌졸중']);
  const dysarthria = hasAny(text, ['구음장애', '발음']);
  const severeHeadache = hasAny(text, ['벼락두통', '극심한 두통', '갑작스러운 심한']);
  const headTrauma = hasAny(text, ['두부외상', '두부손상']);
  const lowGCS = hasAny(text, ['GCS', '의식수준의 변화', '무의식', '의식변화']);

  const triggered = new Set();
  const questions = [];
  const reasons = [];

  if (focalDeficit || dysarthria) {
    triggered.add('Y0020');
    triggered.add('Y0032');
    questions.push(QUESTIONS.onset_time_stroke.id);
    questions.push(QUESTIONS.trauma_or_spontaneous.id);
    reasons.push('국소 신경결손 → ·뇌경색 재관류·/·뇌출혈 수술· 후보');
  }
  if (severeHeadache) {
    triggered.add('Y0031');
    triggered.add('Y0032');
    questions.push(QUESTIONS.trauma_or_spontaneous.id);
    reasons.push('극심한 두통 → ·거미막하출혈 수술·/·뇌출혈 수술· 후보');
  }
  if (headTrauma) {
    triggered.add('Y0032');
    reasons.push('두부외상 → ·뇌출혈 수술· 후보');
  }
  if (lowGCS && triggered.size === 0) {
    triggered.add('Y0020');
    questions.push(QUESTIONS.onset_time_stroke.id);
    reasons.push('의식변화 단독 → ·뇌경색 재관류·만 후보');
  }

  if (triggered.size === 0) return null;
  return { triggered_y: triggered, questions, rationale: reasons.join('; ') };
}

function ruleObgyn(entry, text) {
  if (entry.level2.name !== '임신/여성생식계') return null;
  // v0.3: 자문자 자기 결정 재고 — 임신 응급은 confident 회복
  const labor = hasAny(text, ['분만', '진통', '출산']);
  const pregnancy20plus = entry.level3.name === '20주 이상의 임신';
  const amnioticLeak = hasAny(text, ['양수누출', '양막파열']);
  const placentaPrevia = hasAny(text, ['전치태반']);
  const placentaAbruption = hasAny(text, ['태반조기박리', '태반박리']);
  const eclampsia = hasAny(text, ['자간', '전자간', 'HELLP']);
  const persistentBleed = hasAny(text, ['지속되는 질 출혈', '대량 출혈', '자궁외임신']);
  const surgical = hasAny(text, ['제왕절개', '수술']);

  const triggered = new Set();
  const questions = [];
  const reasons = [];

  if (labor) {
    // ·분만· confident — Y0100·Y0112 자동 co-trigger 제거 (자문자 의견)
    triggered.add('Y0111');
    reasons.push('분만 임박 → ·분만· confident');
  }
  if (amnioticLeak && pregnancy20plus) {
    // 양수누출 + 임신주수 정보 → 분만·저체중·산과수술 모두 후보
    triggered.add('Y0111');
    triggered.add('Y0100');
    triggered.add('Y0112');
    questions.push(QUESTIONS.pregnancy_emergency.id);
    questions.push(QUESTIONS.neonatal_assessment.id);
    reasons.push('양수누출 + 임신 20주+ → ·분만·/·저체중 출생·/·산과 응급수술· 모두 후보');
  }
  if (persistentBleed || placentaPrevia || placentaAbruption || eclampsia) {
    // 임신 응급 출혈/태반/자간 → ·산과 응급수술· confident (v0.3 강화)
    triggered.add('Y0112');
    questions.push(QUESTIONS.pregnancy_emergency.id);
    reasons.push('임신 응급 출혈/태반/자간 → ·산과 응급수술· confident');
  }
  if (surgical && !labor) {
    triggered.add('Y0112');
    questions.push(QUESTIONS.pregnancy_status.id);
    reasons.push('산과 수술 의심 → ·산과 응급수술· 후보');
  }

  if (triggered.size === 0) return null;
  return { triggered_y: triggered, questions, rationale: reasons.join('; ') };
}

function ruleGi(entry, text) {
  if (entry.level2.name !== '소화기계') return null;

  const hematemesis = hasAny(text, ['토혈', '혈변', '위장관 출혈', '흑색변']);
  const foreignBody = hasAny(text, ['이물', '삼킴', '흡인']);
  const biliary = hasAny(text, ['담낭', '담도', '황달', '우상복부']);
  const abdominalAcute = hasAny(text, ['복막염', '천공', '장폐색', '복부 응급']);
  const intussusception = hasAny(text, ['장중첩']);
  const tearingAbd = hasAny(text, ['찢어', '박동성']) && hasAny(text, ['복통', '복부']);
  const shock = hasAny(text, ['쇼크', '혈역학적 장애']);

  const triggered = new Set();
  const questions = [];
  const reasons = [];
  const confidenceOverrides = {};

  if (hematemesis) {
    const yCode = entry.group === 'pediatric' ? 'Y0082' : 'Y0081';
    triggered.add(yCode);
    questions.push(QUESTIONS.bleeding_site.id);
    // v0.3.1: 영유아 + grade≥3 (mild 흑색변) → candidate로 demote (자문자 VIG-18 의견)
    if (entry.group === 'pediatric' && entry.grade >= 3) {
      confidenceOverrides[yCode] = 'candidate';
      reasons.push('영유아 mild 흑색변 (grade ' + entry.grade + ') → ·영유아 위장관 내시경· candidate (entry-level demote)');
    } else {
      reasons.push('토혈/흑색변 → ·' + (entry.group === 'pediatric' ? '영유아' : '성인') + ' 위장관 내시경· confident');
    }
  }
  if (foreignBody && entry.group === 'pediatric') {
    triggered.add('Y0082');
    triggered.add('Y0092');
    questions.push(QUESTIONS.foreign_body_site.id);
    reasons.push('소아 이물 → ·영유아 위장관 내시경·/·영유아 기관지 내시경· 분기');
  }
  if (biliary) {
    triggered.add('Y0051');
    triggered.add('Y0052');
    reasons.push('담낭/담도 의심 → tier만 (영상 전 구별 불가)');
  }
  if (abdominalAcute || tearingAbd || shock) {
    if (entry.group === 'pediatric') {
      triggered.add('Y0070');
      reasons.push('소아 복부 응급 → tier만');
    } else {
      triggered.add('Y0060');
      if (tearingAbd || shock) triggered.add('Y0042');
      reasons.push('복부 응급 → tier만');
    }
  }
  if (intussusception && entry.group === 'pediatric') {
    triggered.add('Y0070');
    reasons.push('영유아 장중첩 의심 → tier만');
  }

  if (triggered.size === 0) return null;
  return { triggered_y: triggered, questions, rationale: reasons.join('; '), confidenceOverrides };
}

function ruleAmputation(entry, text) {
  // v0.3: 절단 키워드가 명시된 경우만 trigger. 신경계 "사지약화" 같은 limbs 키워드는 제외.
  // L3 = "절단" 또는 L4에 "절단" 명시 → 부위 분기 후보
  const isAmputationL3 = entry.level3.name === '절단';
  const amputationKeyword = hasAny(entry.level4.name, ['절단', '접합']);
  const earAmputation = entry.level2.name === '입,목/얼굴' || /귀의 손상/.test(entry.level3.name);

  if (!isAmputationL3 && !amputationKeyword) return null;
  // 귀 절단(CFFCE 등)은 수지/사지 접합 적응 X
  if (earAmputation) return null;

  const triggered = new Set();
  const questions = [];
  const reasons = [];

  // 부위 미상 — 코드만으로는 손가락/발가락 vs 팔/다리 구별 불가, 둘 다 후보
  triggered.add('Y0131');
  triggered.add('Y0132');
  questions.push(QUESTIONS.replantation_part.id);
  reasons.push('절단 → ·수지 접합·/·사지 접합· 후보 (부위 질문으로 분기)');

  return { triggered_y: triggered, questions, rationale: reasons.join('; ') };
}

function ruleAirway(entry, text) {
  if (entry.level2.name !== '호흡기계') return null;
  const foreignBody = hasAny(text, ['이물', '흡인', '기도']);
  const dyspnea = entry.level3.name === '숨참';

  const triggered = new Set();
  const questions = [];
  const reasons = [];

  if (foreignBody) {
    const yCode = entry.group === 'pediatric' ? 'Y0092' : 'Y0091';
    triggered.add(yCode);
    questions.push(QUESTIONS.foreign_body_site.id);
    reasons.push('기도 이물 → ·' + (entry.group === 'pediatric' ? '영유아' : '성인') + ' 기관지 내시경· confident');
  }
  if (dyspnea) {
    // v0.3: 호흡곤란 환자에 dyspnea_history + dyspnea_severity 질문 — Y 후보 결정 X, tier 보강만
    questions.push(QUESTIONS.dyspnea_history.id);
    questions.push(QUESTIONS.dyspnea_severity.id);
    reasons.push('호흡곤란 → 과거력·중증도 질문 (Y코드 단정 X, tier 결정용)');
  }

  if (triggered.size === 0 && !dyspnea) return null;
  return { triggered_y: triggered, questions, rationale: reasons.join('; ') };
}

function ruleBurn(entry, text) {
  if (!hasAny(text, ['화상'])) return null;
  const triggered = new Set(['Y0120']);
  const questions = [QUESTIONS.burn_severity.id, QUESTIONS.airway_burn.id];
  // v0.3: 기도 화상 의심 시 ·성인 기관지 내시경· 추가 candidate
  if (hasAny(text, ['기도 화상', '연기 흡입', '안면 화상', '그을음'])) {
    triggered.add('Y0091');
  }
  return {
    triggered_y: triggered,
    questions,
    rationale: '화상 → ·중증 화상· (BSA 분기) + 기도 화상 의심 시 ·성인 기관지 내시경· 추가',
  };
}

function rulePsych(entry, text) {
  if (entry.level2.name !== '정신건강') return null;
  // v0.3: level4의 explicit positive marker만 trigger.
  // "우울함, 자살 생각은 없음" 등 negative-stated 경증은 unmapped.
  const l4 = entry.level4.name;
  const explicitPositiveMarkers = [
    '계획적인 자살시도',
    '뚜렷한 자살의도',
    '자신 혹은 타인을 해치려는 구체적인 계획',
    '충동을 억제할 수 없는',
    '급성 정신병',
    '폭력 또는 안전하지 않은 상황',
    '조절되지 않는 행동',
    '타인이나 주변환경에 대해 급성으로 발생한 문제',
    '육체적 폭행 또는 성폭행',
    '도주의 가능성이나 안전에 대한 위험', // CBECC grade 2
  ];

  if (!hasAny(l4, explicitPositiveMarkers)) return null;

  return {
    triggered_y: new Set(['Y0150']),
    questions: [QUESTIONS.psychiatric_intent.id],
    rationale: '자해/명시적 자살시도/급성 정신증 → ·정신과 응급입원· confident (v0.3: level4 specific feature 명시 시만)',
  };
}

function ruleEye(entry, text) {
  if (entry.level2.name !== '눈') return null;
  // v0.3: 단순 결막 충혈/단순 눈병/단순 각막외상 unmapped
  const exclusionKeywords = ['단순 각막', '결막염', '눈병', '눈충혈/분비물, 만성', '눈충혈,분비물, 만성'];
  if (hasAny(text, exclusionKeywords)) return null;

  // 단순 충혈 (acute라도) — 시력 저하/외상 동반 신호 없으면 unmapped
  const simpleConjunctivitis = entry.level3.name === '눈충혈,분비물' || entry.level3.name === '눈충혈/분비물';
  const severeFeature = hasAny(text, ['시력 저하', '시력장애', '관통', '천공', '안구 외상', '안구 파열', '제포', '안내 이물', '급성 통증(8-10)']);

  if (simpleConjunctivitis && !severeFeature) return null;

  // 안구 외상·시력 위협 명시 → ·안과 응급수술· candidate
  // 천공/관통 명시 → confident 승격
  const penetrating = hasAny(text, ['천공', '관통', '안구 파열', '제포']);

  return {
    triggered_y: new Set(['Y0160']),
    questions: [QUESTIONS.eye_severity.id],
    rationale: penetrating
      ? '안구 천공/관통 → ·안과 응급수술· confident'
      : '안구 외상·시력 위협 → ·안과 응급수술· 후보',
    conditional_promote_to_A: penetrating,
  };
}

function ruleRenal(entry, text) {
  // ·응급 혈액투석·/·응급 CRRT· — C 그룹, tier만
  const dialysisTrig = hasAny(text, ['투석', '고칼륨', '요독', '심폐부종', '산증', '신부전', '신기능']);
  if (!dialysisTrig) return null;
  return {
    triggered_y: new Set(['Y0141', 'Y0142']),
    questions: [],
    rationale: '투석 적응 의심 → ·응급 혈액투석·/·응급 CRRT· tier (현장 단정 X)',
  };
}

function ruleNeonatal(entry, text) {
  // v0.3: 신생아 trigger 정밀화
  // "방금 태어난 신생아" + 임신주수<37 또는 호흡부전 → ·저체중 출생· candidate
  if (entry.group !== 'pediatric') return null;
  if (!hasAny(text, ['신생아', '저체중', '조산', '방금 태어난', '미숙아'])) return null;

  return {
    triggered_y: new Set(['Y0100']),
    questions: [QUESTIONS.neonatal_assessment.id],
    rationale: '신생아 평가 → ·저체중 출생· candidate (질문으로 정밀화)',
  };
}

function ruleCprArrest(entry, text) {
  // v0.3 신규: 심정지 관련 시나리오 → ROSC 분기 질문
  if (!hasAny(text, ['심정지', 'CPR', '맥박 없음', '심폐소생'])) return null;
  return {
    triggered_y: new Set(),  // Y코드 trigger 안 함 — 27 외
    questions: [QUESTIONS.rosc_status.id],
    rationale: '심정지 → ROSC 상태 질문으로 tier 결정 (ROSC 미달성 → 가장 가까운, 달성 → 권역)',
    cpr_special: true,
  };
}

const RULES = [
  ruleCardiac,
  ruleNeuro,
  ruleObgyn,
  ruleGi,
  ruleAmputation,
  ruleAirway,
  ruleBurn,
  rulePsych,
  ruleEye,
  ruleRenal,
  ruleNeonatal,
  ruleCprArrest,
];

// ────────── Main classification ──────────
function classify(entry) {
  const text = [entry.level2.name, entry.level3.name, entry.level4.name].join(' ');
  const allTriggered = new Set();
  const allQuestions = [];
  const reasons = [];
  let conditionalPromote = false;
  let cprSpecial = false;
  const confidenceOverrides = {};

  for (const rule of RULES) {
    const result = rule(entry, text);
    if (!result) continue;
    result.triggered_y.forEach(y => allTriggered.add(y));
    result.questions.forEach(q => { if (!allQuestions.includes(q)) allQuestions.push(q); });
    if (result.rationale) reasons.push(result.rationale);
    if (result.conditional_promote_to_A) conditionalPromote = true;
    if (result.cpr_special) cprSpecial = true;
    if (result.confidenceOverrides) Object.assign(confidenceOverrides, result.confidenceOverrides);
  }

  // y_candidates 빌드 (매트릭스 group → confidence, v0.3.1 entry-level override 적용)
  const y_candidates = [];
  let cTierCandidates = [];
  for (const yCode of allTriggered) {
    const matrixGrp = ycodeGroup(yCode);
    const override = confidenceOverrides[yCode];
    // v0.3.1: override='candidate' && matrix='A' → effectively B (entry-level demote)
    const effectiveGrp = (override === 'candidate' && matrixGrp === 'A') ? 'B' : matrixGrp;
    if (effectiveGrp === 'A') {
      y_candidates.push({ code: yCode, confidence: 'confident' });
    } else if (effectiveGrp === 'B') {
      if (yCode === 'Y0160' && conditionalPromote) {
        y_candidates.push({ code: yCode, confidence: 'confident', promoted: true });
      } else {
        const candObj = { code: yCode, confidence: 'candidate' };
        if (override === 'candidate' && matrixGrp === 'A') candObj.entry_demoted = true;
        y_candidates.push(candObj);
      }
    } else if (effectiveGrp === 'C') {
      cTierCandidates.push(yCode);
    }
  }

  // mappability
  let mappability;
  const hasConfident = y_candidates.some(c => c.confidence === 'confident');
  const hasCandidate = y_candidates.some(c => c.confidence === 'candidate');
  if (hasConfident) mappability = 'A';
  else if (hasCandidate) mappability = 'B';
  else if (cTierCandidates.length > 0) mappability = 'C';
  else mappability = 'unmapped';

  // tier (v0.3: conservative shift)
  const tier = computeTier(entry, y_candidates, cTierCandidates, cprSpecial);

  return {
    code: entry.code,
    group: entry.group,
    grade: entry.grade,
    level2: entry.level2.name,
    level3: entry.level3.name,
    level4: entry.level4.name,
    mappability,
    y_candidates,
    c_tier_codes: cTierCandidates,
    tier_recommendation: tier,
    questions: allQuestions.slice(0, 4),  // v0.3: 최대 4개 (호흡곤란 환자 dyspnea_history+dyspnea_severity 등)
    rationale: reasons.length ? reasons.join('; ') : 'no specific feature matched',
    cpr_special: cprSpecial,
  };
}

// ────────── Tier (v0.3 conservative shift) ──────────
function computeTier(entry, y_candidates, cTierCandidates, cprSpecial) {
  // CPR special: ROSC 질문으로 결정 — default 권고는 권역 (ROSC 달성 가정), 응답 따라 변경
  if (cprSpecial) {
    return {
      preferred: 'regional',
      acceptable: ['regional', 'local_center', 'local_institution'],
      source: 'cpr_rosc_dependent',
      note: 'ROSC 미달성 → preferred=local_institution (가장 가까운). 달성 → preferred=regional (저체온치료).',
    };
  }

  // v0.3.1: 복통/복부종괴 + 쇼크/혈역학 grade 1+2 — c_tier-only일 때 local_center 우선 (자문자 VIG-25 의견)
  if (cTierCandidates.length > 0 && y_candidates.length === 0) {
    const isAbdL3 = entry.level2.name === '소화기계' &&
      (entry.level3.name === '복통' || entry.level3.name === '복부종괴/팽만');
    const isShockL4 = /쇼크|혈역학/.test(entry.level4.name);
    if (isAbdL3 && isShockL4 && (entry.grade === 1 || entry.grade === 2)) {
      return {
        preferred: 'local_center',
        acceptable: ['local_center', 'regional'],
        source: 'v031_abd_shock_grade12_conservative',
      };
    }
  }

  // Y코드 후보 있음 → y_tier 룩업
  const allYCodes = y_candidates.map(c => c.code).concat(cTierCandidates);
  if (allYCodes.length > 0) {
    const sets = allYCodes.map(y => {
      const t = yTier.y_codes && yTier.y_codes[y];
      if (t && t.acceptable_tiers) return new Set(t.acceptable_tiers);
      return null;
    }).filter(Boolean);

    if (sets.length > 0) {
      const common = [...sets[0]].filter(t => sets.every(s => s.has(t)));
      if (common.length > 0) {
        return {
          preferred: common[0],
          acceptable: common,
          source: 'y_tier_intersection',
        };
      }
      const union = new Set();
      sets.forEach(s => s.forEach(t => union.add(t)));
      const order = ['regional', 'local_center', 'local_institution'];
      const sorted = order.filter(t => union.has(t));
      return {
        preferred: sorted[0] || 'regional',
        acceptable: sorted,
        source: 'y_tier_union',
      };
    }
  }

  // v0.3.1 conservative shift — grade 2 복통/복부종괴는 local_center 우선 (자문자 의견: VIG-14)
  if (entry.level2.name === '소화기계' &&
      (entry.level3.name === '복통' || entry.level3.name === '복부종괴/팽만') &&
      entry.grade === 2) {
    return { preferred: 'local_center', acceptable: ['local_center', 'local_institution', 'regional'], source: 'v031_conservative_abdpain_mass' };
  }
  // 분만 임박은 산과 가능 지역센터로
  if (entry.level2.name === '임신/여성생식계' && entry.level3.name === '20주 이상의 임신' &&
      hasAny([entry.level4.name].join(' '), ['진통(자궁수축'])) {
    return { preferred: 'local_center', acceptable: ['local_center', 'regional'], source: 'v03_labor_local_center' };
  }

  // grade fallback
  if (entry.grade === 1 || entry.grade === 2) {
    return { preferred: 'regional', acceptable: ['regional', 'local_center'], source: 'grade_fallback' };
  }
  if (entry.grade === 3) {
    return { preferred: 'local_center', acceptable: ['local_center', 'local_institution', 'regional'], source: 'grade_fallback' };
  }
  return { preferred: 'local_institution', acceptable: ['local_institution', 'local_center'], source: 'grade_fallback' };
}

// ────────── Summary ──────────
function summarize(entries, mappings) {
  const byMappability = { A: 0, B: 0, C: 0, unmapped: 0 };
  const byLevel2 = {};
  const byCandidateY = {};
  const byCTierY = {};
  const byTierPreferred = {};

  for (let i = 0; i < entries.length; i++) {
    const m = mappings[i];
    byMappability[m.mappability] = (byMappability[m.mappability] || 0) + 1;

    const lv2 = entries[i].level2.name;
    byLevel2[lv2] = byLevel2[lv2] || { total: 0, A: 0, B: 0, C: 0, unmapped: 0 };
    byLevel2[lv2].total += 1;
    byLevel2[lv2][m.mappability] += 1;

    m.y_candidates.forEach(c => { byCandidateY[c.code] = (byCandidateY[c.code] || 0) + 1; });
    m.c_tier_codes.forEach(y => { byCTierY[y] = (byCTierY[y] || 0) + 1; });

    const tier = m.tier_recommendation.preferred;
    byTierPreferred[tier] = (byTierPreferred[tier] || 0) + 1;
  }

  return { by_mappability: byMappability, by_level2: byLevel2, by_candidate_y: byCandidateY, by_c_tier_y: byCTierY, by_tier_preferred: byTierPreferred };
}

// ────────── Main ──────────
function main() {
  console.log('Building Pre-KTAS → Y-code mapping v0.3...');
  console.log('  Entries:', codebook.entries.length);
  console.log('  Matrix:', matrix.version + ' (' + matrix.status + ')');
  console.log('  Source: vignette validation feedback (47% appropriate → target 80%+)');

  const mappings = codebook.entries.map(classify);
  const summary = summarize(codebook.entries, mappings);

  const output = {
    version: '0.3.1',
    algorithm: 'v0.3.1 — 잔여 3건 패치 (VIG-14·18·25)',
    generated_at: new Date().toISOString(),
    inputs: {
      codebook: 'data/prektas-codebook.json',
      mappability_matrix: 'research/y-code-mappability-matrix.json v' + matrix.version,
      vignette_review: 'research/vignette-review-2026-04-26-mofq7k1h.json',
      analysis: 'research/vignette-review-analysis.md',
      v03_review: 'research/vignette-review-v0_3-2026-04-27-mogf0py8.json',
    },
    changes_from_v02: [
      'fp over-trigger 좁히기: ·심근경색 재관류·(흉통 character 명시), ·정신과 응급입원·(level4 자살시도/급성정신증), ·안과 응급수술·(시력저하/외상 명시)',
      'Y코드 over-firing 정리: ·저체중 출생· 자동 co-trigger 제거, ·사지 접합· 부위 분기 정밀화',
      '·성인 기관지 내시경· 화상+기도 화상 시 추가 candidate',
      'CPR/ROSC 분기 special rule (rosc_status 질문)',
      '임신 응급 강화: 양수누출+임신주수 → 분만/저체중/산과수술 모두 trigger; 무통성 출혈/태반 → 산과수술 confident',
      'tier conservative shift: grade 2 복통류 → local_center, 분만 임박 → local_center',
      '신규 질문 catalog: dyspnea_history, dyspnea_severity, rosc_status, neonatal_assessment, pregnancy_emergency, airway_burn',
    ],
    changes_from_v03: [
      'VIG-14: tier conservative shift L3 확장 — 복통 → 복통/복부종괴/팽만 grade 2 모두 local_center 우선',
      'VIG-18: 영유아 + grade≥3 + hematemesis trigger → Y0082 confidence demote (entry-level, matrix 변경 X)',
      'VIG-25: 복통/복부종괴 + 쇼크/혈역학 grade 1+2 c_tier-only → local_center 우선',
    ],
    question_catalog: QUESTIONS,
    summary,
    mappings,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log('  Wrote ' + path.relative(repoRoot, outputPath));
  console.log('  by_mappability:', summary.by_mappability);
  console.log('  by_tier_preferred:', summary.by_tier_preferred);
  console.log('Done.');
}

main();
