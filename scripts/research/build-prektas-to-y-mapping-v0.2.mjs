#!/usr/bin/env node

/**
 * Pre-KTAS → EMRIS 27 Y-codes 매핑 v0.2.
 *
 * v0.1 대비 변경:
 *   1. 출력 schema 분리: mappability(A/B/C) + y_candidates with confidence + tier_recommendation
 *   2. 매핑성 매트릭스 v1.0 frozen 적용 (research/y-code-mappability-matrix.json)
 *      - A: confidence='confident' — 코드+질문만으로 명확
 *      - B: confidence='candidate' — 후보군, 단정 X
 *      - C: y_candidates=[], tier만 권고
 *   3. Special rules 4건:
 *      - Y0100·Y0111·Y0112 co-trigger (임신 주수 + 분만 임박)
 *      - Y0160 conditional confidence upgrade (안구 천공·관통 명시)
 *      - Y0150 specific feature only (자해·정신증 명시 시만)
 *      - Y0032 specific feature only (편마비·GCS·극심한 두통)
 *
 * 자문자 일관 임상 원칙:
 *   "후보군 narrowing보다 적합한 tier 병원으로 직송 + 병원이 검사 후 결정"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const codebookPath = path.join(repoRoot, 'data/prektas-codebook.json');
const matrixPath = path.join(repoRoot, 'research/y-code-mappability-matrix.json');
const yTierPath = path.join(repoRoot, 'data/y-code-to-center-tier.json');
const outputPath = path.join(repoRoot, 'research/prektas-to-y-mapping-v0.2.json');

// ────────── Question catalog (v0.1 호환 유지) ──────────
const QUESTIONS = {
  onset_time_stroke: { id: 'onset_time_stroke', prompt: '증상 발생 후 경과 시간은?', purpose: '뇌경색 재관류중재 적응' },
  trauma_or_spontaneous: { id: 'trauma_or_spontaneous', prompt: '외상 여부?', purpose: '외상성/자발성 뇌출혈 구분' },
  pregnancy_status: { id: 'pregnancy_status', prompt: '임신 상태는?', purpose: '산과/부인과 분기' },
  burn_severity: { id: 'burn_severity', prompt: '화상 중증도(BSA)?', purpose: 'Y0120 적응 판정' },
  bleeding_site: { id: 'bleeding_site', prompt: '출혈 부위는?', purpose: '상부/하부 위장관 분기' },
  foreign_body_site: { id: 'foreign_body_site', prompt: '이물 부위?', purpose: '위장관/기도 분기' },
  chest_pain_character: { id: 'chest_pain_character', prompt: '흉통 양상?', purpose: 'Y0010 vs 대동맥 식별 (v0.2: Y0010만 trigger)' },
  replantation_part: { id: 'replantation_part', prompt: '절단 부위?', purpose: 'Y0131/Y0132 구분' },
  psychiatric_risk: { id: 'psychiatric_risk', prompt: '자해/타해 위험?', purpose: 'Y0150 적응 (자해·정신증 명시)' },
  eye_emergency_kind: { id: 'eye_emergency_kind', prompt: '안과 응급 양상?', purpose: 'Y0160 적응 (천공·관통은 A 승격)' },
  pregnancy_weeks: { id: 'pregnancy_weeks', prompt: '임신 주수?', purpose: 'Y0100 저체중 후보 (37주 미만)' },
};

// ────────── Helpers ──────────
const hasAny = (text, words) => words.some((w) => text.includes(w));

function loadJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

const codebook = loadJSON(codebookPath);
const matrix = loadJSON(matrixPath);
const yTier = loadJSON(yTierPath);

// 매트릭스 group → confidence 매핑
function groupToConfidence(group) {
  if (group === 'A') return 'confident';
  if (group === 'B') return 'candidate';
  return null; // C는 candidates에서 제외
}

function ycodeGroup(yCode) {
  return matrix.y_codes[yCode] ? matrix.y_codes[yCode].group : null;
}

// ────────── Trigger rules (v0.2) ──────────
// 각 룰: entry 입력, { triggered_y: Set, questions: [...], rationale } 반환
// 후보 Y는 매트릭스 group에 따라 후처리 단계에서 confidence 부여 / C는 제외.

function ruleCardiac(entry, text) {
  if (entry.level2.name !== '심혈관계') return null;
  const compressing = hasAny(text, ['압박', '조이', '쥐어짜']);
  const tearing = hasAny(text, ['찢어', '이동성']);
  const chest = hasAny(text, ['가슴통증', '흉통', '심근', '흉부']);
  const abdomen = hasAny(text, ['복부', '복통', '박동성']);

  const triggered = new Set();
  const questions = [];
  const reasons = [];

  if (chest && compressing) {
    triggered.add('Y0010');
    questions.push(QUESTIONS.chest_pain_character.id);
    reasons.push('압박성 흉통 → Y0010 confident');
  }
  if (chest && tearing) {
    triggered.add('Y0010');
    triggered.add('Y0041'); // C 그룹 — 후처리에서 제외, tier만
    reasons.push('찢어지는 흉통 → Y0010 후보 + Y0041 tier (자문자: 먼저 PCI 가능 병원 직송)');
  }
  if (chest && !compressing && !tearing) {
    triggered.add('Y0010');
    questions.push(QUESTIONS.chest_pain_character.id);
    reasons.push('흉통 character 미명시 → Y0010 후보, 질문으로 분기');
  }
  if (abdomen && tearing) {
    triggered.add('Y0042'); // C 그룹
    triggered.add('Y0060'); // C 그룹
    reasons.push('찢어지는 복통 → 권역/지역센터 tier (자문자: 검사 후 결정)');
  }

  if (triggered.size === 0) return null;
  return {
    triggered_y: triggered,
    questions,
    rationale: reasons.join('; '),
  };
}

function ruleNeuro(entry, text) {
  if (entry.level2.name !== '신경계') return null;

  // Y0032 specific feature only: 편마비/GCS<13/극심한 두통
  const focalDeficit = hasAny(text, ['편마비', '사지약화', 'FAST', '뇌졸중']);
  const dysarthria = hasAny(text, ['구음장애', '발음']);
  const severeHeadache = hasAny(text, ['벼락두통', '극심한 두통', '갑작스러운 심한']);
  const headacheSimple = hasAny(text, ['두통']);
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
    reasons.push('국소 신경결손 → Y0020/Y0032 후보 (시간·외상 분기)');
  }
  if (severeHeadache) {
    triggered.add('Y0031');
    triggered.add('Y0032');
    questions.push(QUESTIONS.trauma_or_spontaneous.id);
    reasons.push('극심한 두통 → Y0031/Y0032 후보');
  }
  if (headTrauma) {
    triggered.add('Y0032');
    reasons.push('두부외상 → Y0032 후보');
  }
  if (lowGCS && triggered.size === 0) {
    // 의식변화 단독은 v0.2에서 Y0032 trigger X (specific feature only)
    triggered.add('Y0020');
    questions.push(QUESTIONS.onset_time_stroke.id);
    reasons.push('의식변화 단독 → Y0020만 후보 (v0.2: Y0032는 specific feature 시만)');
  }
  if (headacheSimple && !severeHeadache && triggered.size === 0) {
    // 단순 두통은 trigger 안 함 (over-trigger 회피)
    return null;
  }

  if (triggered.size === 0) return null;
  return { triggered_y: triggered, questions, rationale: reasons.join('; ') };
}

function ruleObgyn(entry, text) {
  if (entry.level2.name !== '임신/여성생식계') return null;

  const labor = hasAny(text, ['분만', '진통', '출산']);
  const bleeding = hasAny(text, ['질출혈', '대량 출혈', '자궁외임신', '태반']);
  const eclampsia = hasAny(text, ['자간', '전자간', 'HELLP']);
  const surgical = hasAny(text, ['제왕절개', '수술']);

  const triggered = new Set();
  const questions = [];
  const reasons = [];

  if (labor) {
    // Y0100·Y0111·Y0112 co-trigger (자문자 special rule)
    triggered.add('Y0111');
    triggered.add('Y0100'); // 임신 주수 추정으로 저체중 후보
    triggered.add('Y0112'); // 응급 산과수술 동시 가능
    questions.push(QUESTIONS.pregnancy_weeks.id);
    reasons.push('분만 임박 → Y0111 confident + Y0100/Y0112 co-trigger 후보 (자문자)');
  } else if (bleeding || eclampsia || surgical) {
    triggered.add('Y0112');
    questions.push(QUESTIONS.pregnancy_status.id);
    reasons.push('산과 응급 → Y0112 후보');
  }

  if (triggered.size === 0) return null;
  return { triggered_y: triggered, questions, rationale: reasons.join('; ') };
}

function ruleGi(entry, text) {
  if (entry.level2.name !== '소화기계') return null;

  const hematemesis = hasAny(text, ['토혈', '혈변', '위장관 출혈', '흑색변']);
  const foreignBody = hasAny(text, ['이물', '삼킴', '흡인']);
  const biliary = hasAny(text, ['담낭', '담도', '황달', '우상복부']);
  const abdominalAcute = hasAny(text, ['복막염', '천공', '장중첩', '장폐색', '복부 응급']);
  const tearingAbd = hasAny(text, ['찢어', '박동성']) && hasAny(text, ['복통', '복부']);

  const triggered = new Set();
  const questions = [];
  const reasons = [];

  if (hematemesis) {
    const yCode = entry.group === 'pediatric' ? 'Y0082' : 'Y0081';
    triggered.add(yCode);
    questions.push(QUESTIONS.bleeding_site.id);
    reasons.push('토혈/흑색변 → ' + yCode + ' confident');
  }
  if (foreignBody) {
    if (entry.group === 'pediatric') {
      triggered.add('Y0082');
      triggered.add('Y0092');
      questions.push(QUESTIONS.foreign_body_site.id);
      reasons.push('소아 이물 → Y0082/Y0092 분기');
    }
  }
  if (biliary) {
    triggered.add('Y0051'); // C 그룹
    triggered.add('Y0052'); // C 그룹
    reasons.push('담낭/담도 의심 → C 그룹 (영상 전 구별 불가, tier만)');
  }
  if (abdominalAcute || tearingAbd) {
    if (entry.group === 'pediatric') {
      triggered.add('Y0070'); // C 그룹
      reasons.push('소아 복부 응급 → Y0070 C tier');
    } else {
      triggered.add('Y0060'); // C 그룹
      reasons.push('복부 응급 → Y0060 C tier');
    }
  }

  if (triggered.size === 0) return null;
  return { triggered_y: triggered, questions, rationale: reasons.join('; ') };
}

function ruleAmputation(entry, text) {
  if (!hasAny(text, ['절단', '접합'])) return null;
  const triggered = new Set(['Y0131', 'Y0132']);
  return {
    triggered_y: triggered,
    questions: [QUESTIONS.replantation_part.id],
    rationale: '절단/접합 → Y0131/Y0132 부위 분기',
  };
}

function ruleAirway(entry, text) {
  if (entry.level2.name !== '호흡기계') return null;
  const foreignBody = hasAny(text, ['이물', '흡인', '기도']);
  if (foreignBody) {
    const yCode = entry.group === 'pediatric' ? 'Y0092' : 'Y0091';
    return {
      triggered_y: new Set([yCode]),
      questions: [QUESTIONS.foreign_body_site.id],
      rationale: '기도 이물 → ' + yCode + ' confident',
    };
  }
  return null;
}

function ruleBurn(entry, text) {
  if (!hasAny(text, ['화상'])) return null;
  return {
    triggered_y: new Set(['Y0120']),
    questions: [QUESTIONS.burn_severity.id],
    rationale: '화상 → Y0120 (BSA로 중증도 분기)',
  };
}

function rulePsych(entry, text) {
  if (entry.level2.name !== '정신건강') return null;
  // Y0150 specific feature only: 자해·자살시도·급성 정신증
  const selfHarm = hasAny(text, ['자살', '자해', '폭력']);
  const acutePsychosis = hasAny(text, ['기괴', '환각', '망상', '급성 정신']);
  if (selfHarm || acutePsychosis) {
    return {
      triggered_y: new Set(['Y0150']),
      questions: [QUESTIONS.psychiatric_risk.id],
      rationale: '자해/정신증 명시 → Y0150 confident (v0.2: 정신건강 카테고리 전체 trigger 금지)',
    };
  }
  return null;
}

function ruleEye(entry, text) {
  if (entry.level2.name !== '눈') return null;
  // 단순 각막외상·눈병 제외 (자문자 메모)
  if (hasAny(text, ['단순 각막', '결막염', '눈병'])) return null;

  // Y0160 conditional A 승격: 안구 천공·관통상 명시 시
  const penetrating = hasAny(text, ['천공', '관통', '안구 파열', '제포', '안내 이물']);
  return {
    triggered_y: new Set(['Y0160']),
    questions: [QUESTIONS.eye_emergency_kind.id],
    rationale: penetrating
      ? '안구 천공/관통 명시 → Y0160 confident (자문자 conditional A 승격)'
      : '안과 응급 → Y0160 후보',
    conditional_promote_to_A: penetrating,
  };
}

function ruleRenal(entry, text) {
  // Y0141·Y0142 모두 C 그룹. tier만.
  const dialysisTrig = hasAny(text, ['투석', '고칼륨', '요독', '심폐부종', '산증']);
  if (!dialysisTrig) return null;
  return {
    triggered_y: new Set(['Y0141', 'Y0142']),
    questions: [],
    rationale: '투석 적응 의심 → Y0141/Y0142 C tier (자문자: dialysis-specific Pre-KTAS code 부재)',
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
];

// ────────── Main classification ──────────
function classify(entry) {
  const text = [entry.level2.name, entry.level3.name, entry.level4.name].join(' ');
  const allTriggered = new Set();
  const allQuestions = [];
  const reasons = [];
  let conditionalPromote = false;

  for (const rule of RULES) {
    const result = rule(entry, text);
    if (!result) continue;
    result.triggered_y.forEach(y => allTriggered.add(y));
    result.questions.forEach(q => { if (!allQuestions.includes(q)) allQuestions.push(q); });
    if (result.rationale) reasons.push(result.rationale);
    if (result.conditional_promote_to_A) conditionalPromote = true;
  }

  // Build y_candidates from matrix groups
  const y_candidates = [];
  let cTierCandidates = []; // C 그룹 Y코드 (tier 결정에만 사용)
  for (const yCode of allTriggered) {
    const grp = ycodeGroup(yCode);
    if (grp === 'A') {
      y_candidates.push({ code: yCode, confidence: 'confident' });
    } else if (grp === 'B') {
      // Y0160 conditional promote to A
      if (yCode === 'Y0160' && conditionalPromote) {
        y_candidates.push({ code: yCode, confidence: 'confident', promoted: true });
      } else {
        y_candidates.push({ code: yCode, confidence: 'candidate' });
      }
    } else if (grp === 'C') {
      cTierCandidates.push(yCode);
    }
  }

  // Determine mappability
  let mappability;
  const hasConfident = y_candidates.some(c => c.confidence === 'confident');
  const hasCandidate = y_candidates.some(c => c.confidence === 'candidate');
  if (hasConfident) mappability = 'A';
  else if (hasCandidate) mappability = 'B';
  else if (cTierCandidates.length > 0) mappability = 'C';
  else mappability = 'unmapped';

  // Tier recommendation
  const tier = computeTier(entry, y_candidates, cTierCandidates);

  // Limit questions to 3
  const finalQuestions = allQuestions.slice(0, 3);

  return {
    code: entry.code,
    group: entry.group,
    grade: entry.grade,
    level2: entry.level2.name,
    level3: entry.level3.name,
    level4: entry.level4.name,
    mappability,
    y_candidates,
    c_tier_codes: cTierCandidates, // informational only
    tier_recommendation: tier,
    questions: finalQuestions,
    rationale: reasons.length ? reasons.join('; ') : 'no specific feature matched — grade 기반 tier만',
  };
}

// ────────── Tier 계산 ──────────
function computeTier(entry, y_candidates, cTierCandidates) {
  // y-code-to-center-tier 룩업
  const allYCodes = y_candidates.map(c => c.code).concat(cTierCandidates);
  if (allYCodes.length > 0) {
    // Y코드의 acceptable 교집합
    const sets = allYCodes.map(y => {
      const t = yTier.y_codes && yTier.y_codes[y];
      if (t && t.acceptable_tiers) return new Set(t.acceptable_tiers);
      return null;
    }).filter(Boolean);

    if (sets.length > 0) {
      // 교집합
      const common = [...sets[0]].filter(t => sets.every(s => s.has(t)));
      if (common.length > 0) {
        return {
          preferred: common[0],
          acceptable: common,
          source: 'y_tier_intersection',
        };
      }
      // 교집합 없으면 union (보수적)
      const union = new Set();
      sets.forEach(s => s.forEach(t => union.add(t)));
      const order = ['regional', 'local_center', 'local_institution'];
      const sorted = order.filter(t => union.has(t));
      return {
        preferred: sorted[0] || 'regional',
        acceptable: sorted,
        source: 'y_tier_union (no intersection)',
      };
    }
  }

  // Grade fallback
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
    const entry = entries[i];
    const m = mappings[i];
    byMappability[m.mappability] = (byMappability[m.mappability] || 0) + 1;

    const lv2 = entry.level2.name;
    byLevel2[lv2] = byLevel2[lv2] || { total: 0, A: 0, B: 0, C: 0, unmapped: 0 };
    byLevel2[lv2].total += 1;
    byLevel2[lv2][m.mappability] += 1;

    m.y_candidates.forEach(c => {
      byCandidateY[c.code] = (byCandidateY[c.code] || 0) + 1;
    });
    m.c_tier_codes.forEach(y => {
      byCTierY[y] = (byCTierY[y] || 0) + 1;
    });

    const tier = m.tier_recommendation.preferred;
    byTierPreferred[tier] = (byTierPreferred[tier] || 0) + 1;
  }

  return { by_mappability: byMappability, by_level2: byLevel2, by_candidate_y: byCandidateY, by_c_tier_y: byCTierY, by_tier_preferred: byTierPreferred };
}

// ────────── Main ──────────
function main() {
  console.log('Building Pre-KTAS → Y-code mapping v0.2...');
  console.log('  Entries:', codebook.entries.length);
  console.log('  Matrix:', matrix.version + ' (' + matrix.status + ')');

  const mappings = codebook.entries.map(classify);
  const summary = summarize(codebook.entries, mappings);

  const output = {
    version: '0.2.0',
    algorithm: 'v0.2 with mappability matrix v1.0 + 4 special rules',
    generated_at: new Date().toISOString(),
    inputs: {
      codebook: 'data/prektas-codebook.json v' + (codebook.version || '?'),
      mappability_matrix: 'research/y-code-mappability-matrix.json v' + matrix.version,
      y_tier: 'data/y-code-to-center-tier.json',
    },
    schema: {
      mappability: 'A (confident) | B (candidate) | C (tier-only) | unmapped',
      y_candidates: '[{ code, confidence: confident|candidate, promoted? }]',
      c_tier_codes: 'C 그룹 Y코드 (informational, tier 결정에만 사용)',
      tier_recommendation: '{ preferred, acceptable[], source }',
    },
    special_rules_applied: [
      'Y0100·Y0111·Y0112 co-trigger (분만 임박 시)',
      'Y0160 conditional A 승격 (안구 천공·관통 명시)',
      'Y0150 specific feature only (자해·정신증 명시)',
      'Y0032 specific feature only (편마비·GCS·극심한 두통)',
      'Y0041/Y0042 → C tier-only (찢어지는 흉통/복통은 tier 직송)',
      'Y0113 → C tier-only (현장 부인과 응급 식별 불가)',
      'Y0051·Y0052 → C tier-only (영상 전 구별 불가)',
      'Y0060·Y0070 → C tier-only (시술 단정 불가)',
      'Y0141·Y0142 → C tier-only (secondary 적응)',
      'Y0171·Y0172 → C tier-only (IR 적응 결정 불가)',
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
