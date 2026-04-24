#!/usr/bin/env node

/**
 * Pre-KTAS (4,689 codes) → EMRIS 중증응급질환 (27 Y-codes) 매핑 v0 baseline.
 *
 * 매핑 전략:
 *   - 0 questions: Pre-KTAS 코드(level2/3/4 + group) 만으로 Y-code 후보 단일 확정 가능.
 *   - 1–3 questions: 후보가 다수일 때 질문으로 분기.
 *   - null:         중증응급질환에 해당하지 않음 (대부분 grade 4–5 경증 or
 *                   정신건강/물질오용의 일부 등).
 *
 * 이 v0는 rule-based baseline. 임상 전문가 리뷰 후 정제되어야 함.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const codebookPath = path.join(repoRoot, 'data/prektas-codebook.json');
const diseasesPath = path.join(repoRoot, 'data/emris-severe-emergency-diseases.json');
const outputMappingPath = path.join(repoRoot, 'research/prektas-to-y-mapping.json');

// ────────── Question catalog ──────────
// Structured, reusable questions. Each has a stable id so downstream UIs/analyses
// can reference them. Types: single-choice with enumerated options.
const QUESTIONS = {
  onset_time_stroke: {
    id: 'onset_time_stroke',
    prompt: '증상 발생 후 경과 시간은?',
    options: ['< 4.5시간', '4.5–24시간', '> 24시간 또는 미상'],
    purpose: '뇌경색 재관류중재 적응 판정 (Y0020)',
  },
  trauma_or_spontaneous: {
    id: 'trauma_or_spontaneous',
    prompt: '외상 여부는?',
    options: ['외상성', '비외상성/자발성'],
    purpose: '외상성 출혈과 자발성 뇌출혈 구분',
  },
  pregnancy_status: {
    id: 'pregnancy_status',
    prompt: '임신 상태는?',
    options: ['임신 20주 미만', '임신 20주 이상', '비임신', '미상'],
    purpose: '산과응급(Y0111/Y0112) vs 부인과응급(Y0113) 분기',
  },
  burn_severity: {
    id: 'burn_severity',
    prompt: '화상 중증도는? (TBSA 기준 또는 부위)',
    options: ['중증(TBSA ≥ 20% 또는 얼굴/기도/회음부)', '중등도', '경증'],
    purpose: 'Y0120 중증화상 적응 판정',
  },
  bleeding_site: {
    id: 'bleeding_site',
    prompt: '출혈 부위는?',
    options: ['상부 위장관(토혈/혈변)', '하부 위장관', '불명'],
    purpose: 'Y0081/Y0082 위장관 응급내시경 적응',
  },
  foreign_body_site: {
    id: 'foreign_body_site',
    prompt: '이물/흡인 의심 부위는?',
    options: ['위장관(삼킴)', '기도(흡인/숨막힘)'],
    purpose: 'Y0082 vs Y0092 구분 (소아)',
  },
  chest_pain_character: {
    id: 'chest_pain_character',
    prompt: '흉통의 특성은?',
    options: ['조이듯이 압박성(심인성 의심)', '찢어지듯 이동성(대동맥 의심)', '비특이적'],
    purpose: 'Y0010 심근경색 vs Y0041 흉부대동맥 구분',
  },
  aortic_location: {
    id: 'aortic_location',
    prompt: '대동맥 응급 의심 부위는?',
    options: ['흉부', '복부'],
    purpose: 'Y0041 vs Y0042 구분',
  },
  replantation_part: {
    id: 'replantation_part',
    prompt: '절단/손상 부위는?',
    options: ['수지(손가락/발가락)', '사지(손·발·팔·다리)'],
    purpose: 'Y0131 수지접합 vs Y0132 사지접합 구분',
  },
  psychiatric_risk: {
    id: 'psychiatric_risk',
    prompt: '즉시 정신과 입원이 필요한 고위험 상태인가?',
    options: ['자살/자해 시도/의도, 타해 위협, 중증 정신병적 증상', '그 외'],
    purpose: 'Y0150 정신과 응급입원 적응',
  },
  dialysis_indication: {
    id: 'dialysis_indication',
    prompt: '응급투석 적응이 있는가? (고칼륨/산증/심폐부종/요독증)',
    options: ['있음 + 혈역학적 안정', '있음 + 혈역학적 불안정(CRRT 고려)', '없음'],
    purpose: 'Y0141 HD vs Y0142 CRRT 구분',
  },
  eye_emergency_kind: {
    id: 'eye_emergency_kind',
    prompt: '시력 위협 외상/응급인가?',
    options: ['안구 관통/파열/화학화상/급성 녹내장', '경증/비응급'],
    purpose: 'Y0160 안과 응급수술 적응',
  },
  onset_acute_or_chronic: {
    id: 'onset_acute_or_chronic',
    prompt: '발병 양상은?',
    options: ['급성(수 시간 이내)', '아급성/만성'],
    purpose: '급성 응급성 여부',
  },
};

// ────────── Keyword sets (Pre-KTAS level2/3/4 텍스트를 대상으로) ──────────
const hasAny = (text, words) => words.some((w) => text.includes(w));

// ────────── Mapping rules ──────────
// Each rule: given an entry {code, group, grade, level2, level3, level4},
// returns null (no match) or {candidates, questions, rationale, confidence}.
// candidates: array of Y-codes. If >1, questions list disambiguates.

function ruleCardiac(entry, textL2L3L4) {
  // 심근경색 (Y0010) / 흉부·복부 대동맥응급 (Y0041/Y0042)
  if (entry.level2.name !== '심혈관계') return null;

  const chest = hasAny(textL2L3L4, ['가슴통증', '흉통', '심근', '압박']);
  const aorta = hasAny(textL2L3L4, ['대동맥', '찢어', '이동성']);
  const abdominalFlag = hasAny(textL2L3L4, ['복부', '복통']);

  if (aorta && !chest) {
    return abdominalFlag
      ? { candidates: ['Y0042'], questions: [], rationale: '복부 대동맥 언급', confidence: 'high' }
      : {
          candidates: ['Y0041', 'Y0042'],
          questions: [QUESTIONS.aortic_location.id],
          rationale: '대동맥 응급 의심 — 부위 분기 필요',
          confidence: 'medium',
        };
  }
  if (chest && !aorta) {
    return {
      candidates: ['Y0010', 'Y0041'],
      questions: [QUESTIONS.chest_pain_character.id],
      rationale: '흉통 — 심근경색/대동맥 감별 1질문',
      confidence: 'medium',
    };
  }
  if (chest && aorta) {
    return {
      candidates: ['Y0010', 'Y0041', 'Y0042'],
      questions: [QUESTIONS.chest_pain_character.id, QUESTIONS.aortic_location.id],
      rationale: '흉통+대동맥 — 2질문 감별',
      confidence: 'medium',
    };
  }
  return null;
}

function ruleNeuro(entry, textL2L3L4) {
  if (entry.level2.name !== '신경계') return null;

  const strokeSymptom = hasAny(textL2L3L4, ['사지약화', '뇌졸중', '편마비', 'FAST']);
  const severeHeadache = hasAny(textL2L3L4, ['두통', '가장 심함', '벼락두통']);
  const headTrauma = hasAny(textL2L3L4, ['두부손상', '두부외상']);
  const alteredLOC = hasAny(textL2L3L4, ['무의식', '의식변화', '의식수준의 변화', 'GCS']);

  if (strokeSymptom) {
    return {
      candidates: ['Y0020', 'Y0032'],
      questions: [QUESTIONS.onset_time_stroke.id, QUESTIONS.trauma_or_spontaneous.id],
      rationale: '국소 신경결손 — 뇌경색/뇌내출혈 감별 2질문(시간·외상)',
      confidence: 'medium',
    };
  }
  if (headTrauma) {
    return {
      candidates: ['Y0032'],
      questions: [],
      rationale: '두부외상 — 외상성 뇌출혈로 분류',
      confidence: 'medium',
    };
  }
  if (severeHeadache) {
    return {
      candidates: ['Y0031', 'Y0032'],
      questions: [QUESTIONS.trauma_or_spontaneous.id],
      rationale: '극심한 두통 — 거미막하/뇌내출혈 감별 1질문',
      confidence: 'medium',
    };
  }
  if (alteredLOC) {
    return {
      candidates: ['Y0020', 'Y0031', 'Y0032'],
      questions: [QUESTIONS.trauma_or_spontaneous.id, QUESTIONS.onset_time_stroke.id],
      rationale: '의식 변화 — 뇌질환 감별 2질문',
      confidence: 'low',
    };
  }
  return null;
}

function ruleObgyn(entry, textL2L3L4) {
  if (entry.level2.name !== '임신/여성생식계') return null;

  const labor = hasAny(textL2L3L4, ['분만', '진통', '출산']);
  const bleeding = hasAny(textL2L3L4, ['질출혈', '대량 출혈', '자궁외임신']);
  const gynSurg = hasAny(textL2L3L4, ['제왕절개', '산과']);

  if (labor) {
    return { candidates: ['Y0111'], questions: [], rationale: '분만 언급 직접 매칭', confidence: 'high' };
  }
  if (bleeding || gynSurg) {
    return {
      candidates: ['Y0112', 'Y0113'],
      questions: [QUESTIONS.pregnancy_status.id],
      rationale: '산과/부인과 응급수술 — 임신 상태로 분기',
      confidence: 'medium',
    };
  }
  return null;
}

function ruleGi(entry, textL2L3L4) {
  if (entry.level2.name !== '소화기계') return null;

  const hematemesis = hasAny(textL2L3L4, ['토혈', '혈변', '위장관 출혈']);
  const foreignBody = hasAny(textL2L3L4, ['이물', '삼킴', '흡인']);
  const biliary = hasAny(textL2L3L4, ['담낭', '담도', '황달']);
  const abdominalAcute = hasAny(textL2L3L4, ['복막염', '천공', '장중첩', '장폐색']);

  if (hematemesis) {
    const ageTag = entry.group === 'pediatric' ? 'Y0082' : 'Y0081';
    return { candidates: [ageTag], questions: [], rationale: 'Pre-KTAS group에서 연령 이미 확정', confidence: 'high' };
  }
  if (foreignBody && entry.group === 'pediatric') {
    return {
      candidates: ['Y0082', 'Y0092'],
      questions: [QUESTIONS.foreign_body_site.id],
      rationale: '소아 이물 — 위장관/기도 분기',
      confidence: 'medium',
    };
  }
  if (biliary) {
    return {
      candidates: ['Y0051', 'Y0052'],
      questions: [],
      rationale: '담낭/담도 질환 그룹',
      confidence: 'medium',
    };
  }
  if (abdominalAcute) {
    if (entry.group === 'pediatric') {
      return { candidates: ['Y0070'], questions: [], rationale: '소아 장중첩/폐색', confidence: 'high' };
    }
    return { candidates: ['Y0060'], questions: [], rationale: '복부 응급수술(성인, 비외상)', confidence: 'medium' };
  }
  return null;
}

function ruleTrauma(entry, textL2L3L4) {
  if (entry.level2.name !== '몸통외상') return null;
  const amputation = hasAny(textL2L3L4, ['절단', '접합', '수지', '사지']);
  if (amputation) {
    return {
      candidates: ['Y0131', 'Y0132'],
      questions: [QUESTIONS.replantation_part.id],
      rationale: '절단/접합 — 부위별 분기',
      confidence: 'medium',
    };
  }
  return null;
}

function ruleMusculo(entry, textL2L3L4) {
  if (entry.level2.name !== '근골격계') return null;
  const amputation = hasAny(textL2L3L4, ['절단', '접합', '수지', '사지']);
  if (amputation) {
    return {
      candidates: ['Y0131', 'Y0132'],
      questions: [QUESTIONS.replantation_part.id],
      rationale: '절단/접합 — 부위별 분기',
      confidence: 'medium',
    };
  }
  return null;
}

function ruleRespiratoryAirway(entry, textL2L3L4) {
  if (entry.level2.name !== '호흡기계') return null;
  const foreignBody = hasAny(textL2L3L4, ['이물', '흡인', '기도']);
  if (foreignBody) {
    const candidate = entry.group === 'pediatric' ? 'Y0092' : 'Y0091';
    return { candidates: [candidate], questions: [], rationale: '기도 이물 — Pre-KTAS group으로 연령 확정', confidence: 'high' };
  }
  return null;
}

function ruleBurn(entry, textL2L3L4) {
  if (!hasAny(textL2L3L4, ['화상'])) return null;
  return {
    candidates: ['Y0120'],
    questions: [QUESTIONS.burn_severity.id],
    rationale: '화상 언급 — 중증도 1질문으로 Y0120 적응 판정',
    confidence: 'medium',
  };
}

function ruleRenal(entry, textL2L3L4) {
  const dialysisTrig = hasAny(textL2L3L4, ['투석', '고칼륨', '요독']);
  if (!dialysisTrig) return null;
  return {
    candidates: ['Y0141', 'Y0142'],
    questions: [QUESTIONS.dialysis_indication.id],
    rationale: '투석 적응 — HD vs CRRT 분기',
    confidence: 'medium',
  };
}

function rulePsych(entry, textL2L3L4) {
  if (entry.level2.name !== '정신건강') return null;
  const highRisk = hasAny(textL2L3L4, ['자살', '자해', '폭력', '기괴', '환각', '정신']);
  if (highRisk) {
    return {
      candidates: ['Y0150'],
      questions: [QUESTIONS.psychiatric_risk.id],
      rationale: '정신과 위기 신호 — 응급입원 적응 1질문',
      confidence: 'medium',
    };
  }
  return null;
}

function ruleEye(entry, textL2L3L4) {
  if (entry.level2.name !== '눈') return null;
  return {
    candidates: ['Y0160'],
    questions: [QUESTIONS.eye_emergency_kind.id],
    rationale: '안과 응급수술 적응 1질문',
    confidence: 'medium',
  };
}

function ruleNeonatal(entry, textL2L3L4) {
  if (entry.group !== 'pediatric') return null;
  if (!hasAny(textL2L3L4, ['신생아', '저체중', '조산', '방금 태어난'])) return null;
  return {
    candidates: ['Y0100'],
    questions: [],
    rationale: '신생아/조산 언급 — 저체중출생아 적응',
    confidence: 'high',
  };
}

const RULES = [
  ruleNeonatal,
  ruleCardiac,
  ruleNeuro,
  ruleObgyn,
  ruleGi,
  ruleTrauma,
  ruleMusculo,
  ruleRespiratoryAirway,
  ruleBurn,
  ruleRenal,
  rulePsych,
  ruleEye,
];

// ────────── Main ──────────

function classify(entry) {
  const text = [entry.level2.name, entry.level3.name, entry.level4.name].join(' ');
  for (const rule of RULES) {
    const result = rule(entry, text);
    if (result) return result;
  }
  return { candidates: [], questions: [], rationale: 'no rule matched — 중증응급질환 외 (or rule gap)', confidence: 'none' };
}

function summarize(entries, mapping) {
  const byQuestionCount = { '0': 0, '1': 0, '2': 0, '3+': 0, unmapped: 0 };
  const byCandidateYCode = {};
  const byLevel2 = {};
  const byConfidence = { high: 0, medium: 0, low: 0, none: 0 };

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const result = mapping[i];
    const lv2 = entry.level2.name;
    byLevel2[lv2] = byLevel2[lv2] || { total: 0, mapped: 0, q0: 0, q1to3: 0, unmapped: 0 };
    byLevel2[lv2].total += 1;

    byConfidence[result.confidence] = (byConfidence[result.confidence] || 0) + 1;

    if (result.candidates.length === 0) {
      byQuestionCount.unmapped += 1;
      byLevel2[lv2].unmapped += 1;
      continue;
    }
    byLevel2[lv2].mapped += 1;
    const qLen = result.questions.length;
    if (qLen === 0) {
      byQuestionCount['0'] += 1;
      byLevel2[lv2].q0 += 1;
    } else {
      if (qLen === 1) byQuestionCount['1'] += 1;
      else if (qLen === 2) byQuestionCount['2'] += 1;
      else byQuestionCount['3+'] += 1;
      byLevel2[lv2].q1to3 += 1;
    }
    for (const y of result.candidates) byCandidateYCode[y] = (byCandidateYCode[y] || 0) + 1;
  }

  return {
    total_codes: entries.length,
    by_question_count: byQuestionCount,
    by_confidence: byConfidence,
    by_candidate_ycode: byCandidateYCode,
    by_level2: byLevel2,
  };
}

function main() {
  const codebook = JSON.parse(fs.readFileSync(codebookPath, 'utf8'));
  const diseases = JSON.parse(fs.readFileSync(diseasesPath, 'utf8'));
  const validYCodes = new Set(diseases.diseases.map((d) => d.code));

  const entries = codebook.entries;
  const mapping = entries.map(classify);

  // Validate: every candidate Y-code must exist in target set.
  for (let i = 0; i < mapping.length; i += 1) {
    for (const y of mapping[i].candidates) {
      if (!validYCodes.has(y)) {
        throw new Error(`Invalid Y-code ${y} emitted for ${entries[i].code}`);
      }
    }
    for (const q of mapping[i].questions) {
      if (!QUESTIONS[q]) throw new Error(`Unknown question id ${q} for ${entries[i].code}`);
    }
  }

  const summary = summarize(entries, mapping);

  const output = {
    version: '0.1.0',
    generated_at: new Date().toISOString(),
    inputs: {
      codebook: path.relative(repoRoot, codebookPath),
      codebook_version: codebook.version,
      diseases: path.relative(repoRoot, diseasesPath),
      diseases_version: diseases.version,
    },
    question_catalog: QUESTIONS,
    summary,
    mappings: entries.map((entry, i) => ({
      code: entry.code,
      group: entry.group,
      grade: entry.grade,
      level2: entry.level2.name,
      level3: entry.level3.name,
      level4: entry.level4.name,
      candidates: mapping[i].candidates,
      questions: mapping[i].questions,
      rationale: mapping[i].rationale,
      confidence: mapping[i].confidence,
    })),
  };

  fs.mkdirSync(path.dirname(outputMappingPath), { recursive: true });
  fs.writeFileSync(outputMappingPath, JSON.stringify(output, null, 2) + '\n');

  console.log('Wrote ' + path.relative(repoRoot, outputMappingPath));
  console.log('  total=' + summary.total_codes
    + ', q0=' + summary.by_question_count['0']
    + ', q1=' + summary.by_question_count['1']
    + ', q2=' + summary.by_question_count['2']
    + ', q3+=' + summary.by_question_count['3+']
    + ', unmapped=' + summary.by_question_count.unmapped);
}

main();
