#!/usr/bin/env node

/**
 * Pre-KTAS → 응급의료센터 등급 추천 v1.1.
 *
 * v1.0 → v1.1 변경:
 *   - Y-tier를 "권역 전용 / 지역센터 가능" 이분법 → acceptable 리스트로 일반화.
 *   - 정신과·안과 등 전문과 응급은 권역·지역센터 공동 커버(한국 의료 자원 현실 반영).
 *   - 복합 Y후보는 acceptable 교집합으로 결정 (안전 보수적).
 *   - grade 3 unmapped는 "지역기관 기본"에서 "지역센터 우선"으로 전환
 *     (단순 폐렴·경중등도 외상은 지역센터가 적합).
 *   - 개념 변경: "regional_save_applied" 대신 "tier_strategy" 4범주로 분류.
 *
 * 출력: research/prektas-tier-recommendation.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const mappingPath = path.join(repoRoot, 'research/prektas-to-y-mapping.json');
const tierPath = path.join(repoRoot, 'data/y-code-to-center-tier.json');
const outputPath = path.join(repoRoot, 'research/prektas-tier-recommendation.json');

function intersectAcceptable(yCodes, yTierLookup) {
  if (yCodes.length === 0) return null;
  const firstOrder = yTierLookup[yCodes[0]].acceptable.slice();
  let allowed = new Set(firstOrder);
  for (let i = 1; i < yCodes.length; i += 1) {
    const t = yTierLookup[yCodes[i]];
    if (!t) throw new Error(`Y코드 ${yCodes[i]}의 tier 정의 없음`);
    const s = new Set(t.acceptable);
    allowed = new Set([...allowed].filter((x) => s.has(x)));
  }
  return firstOrder.filter((x) => allowed.has(x));
}

function classifyStrategy(acceptable) {
  const ordered = acceptable.join(',');
  if (ordered === 'regional') return 'regional_only';
  if (ordered === 'regional,local_center') return 'regional_or_local_center';
  if (ordered === 'local_center,regional') return 'local_center_or_regional';
  if (ordered === 'local_center,local_institution') return 'local_center_preferred';
  if (ordered === 'local_institution,local_center') return 'local_institution_preferred';
  if (ordered === 'local_institution') return 'local_institution_only';
  if (ordered === 'local_center') return 'local_center_only';
  return 'other:' + ordered;
}

function recommend(mapEntry, yTierLookup) {
  const { candidates, grade, code } = mapEntry;

  if (candidates.length > 0) {
    const acceptable = intersectAcceptable(candidates, yTierLookup);
    if (!acceptable || acceptable.length === 0) {
      throw new Error(`후보 ${candidates.join('/')}의 tier 교집합이 비어있음 (${code})`);
    }
    const strategy = classifyStrategy(acceptable);
    return {
      acceptable_tiers: acceptable,
      preferred_tier: acceptable[0],
      tier_strategy: strategy,
      source: 'y_candidates',
      rationale:
        strategy === 'regional_only'
          ? `Y후보 ${candidates.join('/')} 중 하나 이상이 권역 전용(NICU/화상센터/수부외과/IR/흉부대동맥 등). 권역만 안전.`
          : `Y후보 ${candidates.join('/')} — 권역·지역센터 공동 커버 가능.`,
    };
  }

  if (grade === 1 || grade === 2) {
    return {
      acceptable_tiers: ['regional', 'local_center'],
      preferred_tier: 'regional',
      tier_strategy: 'regional_or_local_center',
      source: 'grade_1_2_unmapped',
      rationale: `grade ${grade} 중증이나 27 Y코드 외 (내과적 위기·쇼크·패혈증 등). 권역·대형 지역센터 중 가까운 곳.`,
    };
  }
  if (grade === 3) {
    return {
      acceptable_tiers: ['local_center', 'local_institution'],
      preferred_tier: 'local_center',
      tier_strategy: 'local_center_preferred',
      source: 'grade_3_unmapped',
      rationale: 'grade 3 준긴급 (단순 폐렴·경중등도 외상 등). 지역센터 우선, 지역기관 수용 가능.',
    };
  }
  return {
    acceptable_tiers: ['local_institution', 'local_center'],
    preferred_tier: 'local_institution',
    tier_strategy: 'local_institution_preferred',
    source: `grade_${grade}_unmapped`,
    rationale: `grade ${grade} 경증. 지역기관 우선, 여유 있으면 지역센터.`,
  };
}

function summarize(recommendations, mapEntries) {
  const byPreferred = { regional: 0, local_center: 0, local_institution: 0 };
  const byStrategy = {};
  const bySource = {};
  const byLevel2 = {};
  const byYCode = {};
  let regionalRequired = 0;
  let regionalOrLocal = 0;

  for (let i = 0; i < recommendations.length; i += 1) {
    const rec = recommendations[i];
    const m = mapEntries[i];
    byPreferred[rec.preferred_tier] += 1;
    byStrategy[rec.tier_strategy] = (byStrategy[rec.tier_strategy] || 0) + 1;
    bySource[rec.source] = (bySource[rec.source] || 0) + 1;

    const lv2 = m.level2;
    if (!byLevel2[lv2]) byLevel2[lv2] = { total: 0, regional: 0, local_center: 0, local_institution: 0, regional_only: 0 };
    byLevel2[lv2].total += 1;
    byLevel2[lv2][rec.preferred_tier] += 1;
    if (rec.tier_strategy === 'regional_only') byLevel2[lv2].regional_only += 1;

    if (rec.tier_strategy === 'regional_only') regionalRequired += 1;
    if (rec.tier_strategy === 'regional_or_local_center') regionalOrLocal += 1;

    for (const y of m.candidates) {
      if (!byYCode[y]) byYCode[y] = { total: 0, regional_only: 0, regional_or_local_center: 0, other: 0 };
      byYCode[y].total += 1;
      if (rec.tier_strategy === 'regional_only') byYCode[y].regional_only += 1;
      else if (rec.tier_strategy === 'regional_or_local_center') byYCode[y].regional_or_local_center += 1;
      else byYCode[y].other += 1;
    }
  }

  return {
    total_codes: recommendations.length,
    by_preferred_tier: byPreferred,
    by_strategy: byStrategy,
    by_source: bySource,
    regional_required: regionalRequired,
    regional_or_local_center: regionalOrLocal,
    by_level2: byLevel2,
    by_y_code: byYCode,
  };
}

function main() {
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  const tierDoc = JSON.parse(fs.readFileSync(tierPath, 'utf8'));

  const yTierLookup = {};
  for (const t of tierDoc.y_code_tiers) yTierLookup[t.code] = t;

  const entries = mapping.mappings;
  const recommendations = entries.map((m) => recommend(m, yTierLookup));

  const perEntry = entries.map((m, i) => ({
    code: m.code,
    group: m.group,
    grade: m.grade,
    level2: m.level2,
    level3: m.level3,
    level4: m.level4,
    y_candidates: m.candidates,
    acceptable_tiers: recommendations[i].acceptable_tiers,
    preferred_tier: recommendations[i].preferred_tier,
    tier_strategy: recommendations[i].tier_strategy,
    source: recommendations[i].source,
    rationale: recommendations[i].rationale,
  }));

  const summary = summarize(recommendations, entries);

  const out = {
    version: '1.1.0',
    generated_at: new Date().toISOString(),
    inputs: {
      mapping: path.relative(repoRoot, mappingPath),
      mapping_version: mapping.version,
      tier_definitions: path.relative(repoRoot, tierPath),
      tier_version: tierDoc.version,
    },
    tier_definitions: tierDoc.tier_definitions,
    strategy_definitions: {
      regional_only: '권역만 수용 가능 (NICU·화상센터·수부외과·IR·흉부대동맥 등 극소수 시설).',
      regional_or_local_center: '권역 및 대형 지역센터 공동 커버. 가까운 곳으로.',
      local_center_preferred: '지역센터 우선, 지역기관 수용 가능. grade 3 단순 폐렴·경중등도 외상 등.',
      local_institution_preferred: '지역기관 우선, 여유 있으면 지역센터. grade 4–5 경증.',
    },
    rules: {
      'Y-candidates_present': 'acceptable = 후보들의 acceptable 교집합 (안전 보수적).',
      'no_Y_and_grade<=2': 'acceptable = [regional, local_center]',
      'no_Y_and_grade==3': 'acceptable = [local_center, local_institution]',
      'no_Y_and_grade>=4': 'acceptable = [local_institution, local_center]',
    },
    summary,
    recommendations: perEntry,
  };

  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote ' + path.relative(repoRoot, outputPath));
  console.log('  total=' + summary.total_codes);
  console.log('  preferred=regional: ' + summary.by_preferred_tier.regional);
  console.log('  preferred=local_center: ' + summary.by_preferred_tier.local_center);
  console.log('  preferred=local_institution: ' + summary.by_preferred_tier.local_institution);
  console.log('  strategy=regional_only: ' + (summary.by_strategy.regional_only || 0));
  console.log('  strategy=regional_or_local_center: ' + (summary.by_strategy.regional_or_local_center || 0));
  console.log('  strategy=local_center_preferred: ' + (summary.by_strategy.local_center_preferred || 0));
  console.log('  strategy=local_institution_preferred: ' + (summary.by_strategy.local_institution_preferred || 0));
}

main();
