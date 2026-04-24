#!/usr/bin/env node

/**
 * Pre-KTAS → 응급의료센터 등급 추천 생성기.
 *
 * 입력:
 *   - research/prektas-to-y-mapping.json (v0.1 Y코드 매핑)
 *   - data/y-code-to-center-tier.json    (27 Y코드 tier 분류)
 *   - data/prektas-codebook.json          (grade 참조)
 *
 * 추천 룰:
 *   1. Y코드 후보가 있으면
 *      - 모든 후보가 regional-only → primary=regional
 *      - 하나라도 local_center 가능 → primary=local_center (권역 세이브 적용)
 *   2. Y코드 후보 없음
 *      - grade 1–2 → primary=local_center (권역 세이브 적용)
 *      - grade 3   → primary=local_institution, acceptable includes local_center
 *      - grade 4–5 → primary=local_institution, acceptable includes local_center
 *
 * 출력:
 *   research/prektas-tier-recommendation.json — per-code tier 추천 + summary
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const mappingPath = path.join(repoRoot, 'research/prektas-to-y-mapping.json');
const tierPath = path.join(repoRoot, 'data/y-code-to-center-tier.json');
const outputPath = path.join(repoRoot, 'research/prektas-tier-recommendation.json');

const TIER_ORDER = { local_institution: 0, local_center: 1, regional: 2 };

function recommend(mapEntry, yTierLookup) {
  const { candidates, grade, code } = mapEntry;

  if (candidates.length > 0) {
    const candidateTiers = candidates.map((y) => {
      const t = yTierLookup[y];
      if (!t) throw new Error(`Y코드 ${y}의 tier 정의 없음 (code=${code})`);
      return t;
    });
    const anyLocalCenter = candidateTiers.some((t) => t.acceptable.includes('local_center'));
    const localCenterCandidates = candidates.filter((_, i) => candidateTiers[i].acceptable.includes('local_center'));
    const regionalOnlyCandidates = candidates.filter((_, i) => !candidateTiers[i].acceptable.includes('local_center'));

    if (anyLocalCenter) {
      return {
        primary: 'local_center',
        acceptable: ['local_center', 'regional'],
        regional_save_applied: true,
        source: 'y_candidates_local_center_possible',
        rationale: regionalOnlyCandidates.length
          ? `Y후보 ${candidates.join('/')} 중 ${localCenterCandidates.join('/')}가 지역센터 가능. 지역센터 우선, 권역은 여유시.`
          : `Y후보 ${candidates.join('/')} 전부 지역센터 가능. 권역 세이브.`,
      };
    }
    return {
      primary: 'regional',
      acceptable: ['regional'],
      regional_save_applied: false,
      source: 'y_candidates_regional_only',
      rationale: `Y후보 ${candidates.join('/')} 모두 권역 전용 (신경외과·NICU·화상센터·혈관중재 등).`,
    };
  }

  if (grade === 1 || grade === 2) {
    return {
      primary: 'local_center',
      acceptable: ['local_center', 'regional'],
      regional_save_applied: true,
      source: 'grade_1_2_unmapped',
      rationale: `grade ${grade} 중증이나 27 Y코드에 해당 없음 (내과적 중증/비수술 영역). 지역센터 기본, 여유시 권역.`,
    };
  }
  if (grade === 3) {
    return {
      primary: 'local_institution',
      acceptable: ['local_institution', 'local_center'],
      regional_save_applied: false,
      source: 'grade_3_unmapped',
      rationale: 'grade 3 준긴급. 지역기관 기본, 여유시 지역센터.',
    };
  }
  return {
    primary: 'local_institution',
    acceptable: ['local_institution', 'local_center'],
    regional_save_applied: false,
    source: `grade_${grade}_unmapped`,
    rationale: `grade ${grade} 경증. 지역기관 기본, 여유시 지역센터.`,
  };
}

function summarize(recommendations, mapEntries) {
  const byPrimary = { regional: 0, local_center: 0, local_institution: 0 };
  const bySource = {};
  const byLevel2 = {};
  const byYCode = {};
  let saveApplied = 0;
  let saveEligible = 0; // non-경증: Y코드 있거나 grade ≤ 2

  for (let i = 0; i < recommendations.length; i += 1) {
    const rec = recommendations[i];
    const m = mapEntries[i];
    byPrimary[rec.primary] += 1;
    bySource[rec.source] = (bySource[rec.source] || 0) + 1;
    const lv2 = m.level2;
    if (!byLevel2[lv2]) byLevel2[lv2] = { total: 0, regional: 0, local_center: 0, local_institution: 0, save_applied: 0 };
    byLevel2[lv2].total += 1;
    byLevel2[lv2][rec.primary] += 1;
    if (rec.regional_save_applied) byLevel2[lv2].save_applied += 1;

    if (m.candidates.length > 0 || m.grade <= 2) saveEligible += 1;
    if (rec.regional_save_applied) saveApplied += 1;

    for (const y of m.candidates) {
      if (!byYCode[y]) byYCode[y] = { total: 0, primary_regional: 0, primary_local_center: 0 };
      byYCode[y].total += 1;
      if (rec.primary === 'regional') byYCode[y].primary_regional += 1;
      else if (rec.primary === 'local_center') byYCode[y].primary_local_center += 1;
    }
  }

  return {
    total_codes: recommendations.length,
    by_primary_tier: byPrimary,
    by_source: bySource,
    save_eligible: saveEligible,
    save_applied: saveApplied,
    save_rate_among_eligible: saveEligible > 0 ? Number((saveApplied / saveEligible).toFixed(4)) : 0,
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

  // Per-entry full output
  const perEntry = entries.map((m, i) => ({
    code: m.code,
    group: m.group,
    grade: m.grade,
    level2: m.level2,
    level3: m.level3,
    level4: m.level4,
    y_candidates: m.candidates,
    primary_tier: recommendations[i].primary,
    acceptable_tiers: recommendations[i].acceptable,
    regional_save_applied: recommendations[i].regional_save_applied,
    source: recommendations[i].source,
    rationale: recommendations[i].rationale,
  }));

  const summary = summarize(recommendations, entries);

  const out = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    inputs: {
      mapping: path.relative(repoRoot, mappingPath),
      mapping_version: mapping.version,
      tier_definitions: path.relative(repoRoot, tierPath),
      tier_version: tierDoc.version,
    },
    tier_definitions: tierDoc.tier_definitions,
    rules: {
      'Y-candidates_present + any_candidate_allows_local_center': 'primary=local_center, save=true',
      'Y-candidates_present + all_candidates_regional_only': 'primary=regional, save=false',
      'Y-candidates_absent + grade<=2': 'primary=local_center, save=true',
      'Y-candidates_absent + grade==3': 'primary=local_institution (지역센터 acceptable)',
      'Y-candidates_absent + grade>=4': 'primary=local_institution (지역센터 acceptable)',
    },
    summary,
    recommendations: perEntry,
  };

  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote ' + path.relative(repoRoot, outputPath));
  console.log('  total=' + summary.total_codes);
  console.log('  primary=regional: ' + summary.by_primary_tier.regional);
  console.log('  primary=local_center: ' + summary.by_primary_tier.local_center);
  console.log('  primary=local_institution: ' + summary.by_primary_tier.local_institution);
  console.log('  save_eligible=' + summary.save_eligible + ' / save_applied=' + summary.save_applied + ' (rate=' + (summary.save_rate_among_eligible * 100).toFixed(1) + '%)');
}

main();
