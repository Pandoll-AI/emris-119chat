#!/usr/bin/env node

/**
 * 30 vignette × v0.3.1 출력 + v0.3 비교 + 지난번 v0.3 자문 평가 attach.
 * 출력: research/vignettes-with-v0_3_1-output.json
 *
 * v0.3 (mogf0py8) 자문자 평가 27/30 적절. 잔여 3건(VIG-14·18·25) 패치한 v0.3.1 출력을
 * 자문자가 재평가하기 위한 데이터. 변경된 vignette는 v02_to_v03_changes 대신
 * v03_to_v031_changes 필드로 명시.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const vigPath = path.join(repoRoot, 'research/vignettes-v1.0-draft.json');
const v03Path = path.join(repoRoot, 'research/prektas-to-y-mapping-v0.3.json');
const codebookPath = path.join(repoRoot, 'data/prektas-codebook.json');
const v03ReviewPath = path.join(repoRoot, 'research/vignette-review-v0_3-2026-04-27-mogf0py8.json');
const outPath = path.join(repoRoot, 'research/vignettes-with-v0_3_1-output.json');

const vig = JSON.parse(fs.readFileSync(vigPath, 'utf8'));
const v031 = JSON.parse(fs.readFileSync(v03Path, 'utf8'));   // 현재 mapping은 v0.3.1
const codebook = JSON.parse(fs.readFileSync(codebookPath, 'utf8'));
const v03Review = JSON.parse(fs.readFileSync(v03ReviewPath, 'utf8'));

// 이전 v0.3 출력은 vignettes-with-v0_3-output.json에 보존되어 있음 (Phase 11f-prep 산출물)
const v03OutputPath = path.join(repoRoot, 'research/vignettes-with-v0_3-output.json');
const v03PrevEnriched = JSON.parse(fs.readFileSync(v03OutputPath, 'utf8'));
const v03ByVigId = {};
for (const v of v03PrevEnriched.vignettes) v03ByVigId[v.id] = v.v03_output;

const codeToV031 = {};
for (const m of v031.mappings) codeToV031[m.code] = m;
const codeToEntry = {};
for (const e of codebook.entries) codeToEntry[e.code] = e;

const extractOutput = (entry) => entry ? {
  mappability: entry.mappability,
  y_candidates: entry.y_candidates,
  c_tier_codes: entry.c_tier_codes || [],
  tier_recommendation: entry.tier_recommendation,
  questions: entry.questions,
  rationale: entry.rationale,
  cpr_special: entry.cpr_special || false,
} : { error: 'estimated_pre_code not found', code: null };

const enriched = vig.vignettes.map(v => {
  const code = v.estimated_pre_code;
  const v031entry = codeToV031[code];
  const codebookEntry = codeToEntry[code];
  const v03out = v03ByVigId[v.id] || null;

  let codebookInfo = null;
  if (codebookEntry) {
    codebookInfo = {
      group: codebookEntry.group,
      grade: codebookEntry.grade,
      level2: codebookEntry.level2.name,
      level3: codebookEntry.level3.name,
      level4: codebookEntry.level4.name,
    };
  }

  const v031out = extractOutput(v031entry);

  // v0.3 → v0.3.1 diff
  const v03ys = v03out ? (v03out.y_candidates || []).map(c => c.code+':'+c.confidence).sort().join(',') : '';
  const v031ys = (v031out.y_candidates || []).map(c => c.code+':'+c.confidence + (c.entry_demoted?'(demoted)':'')).sort().join(',');
  const yChanged = v03ys !== v031ys;
  const mappabilityChanged = v03out && v03out.mappability !== v031out.mappability;
  const tierChanged = v03out && JSON.stringify(v03out.tier_recommendation || {}) !== JSON.stringify(v031out.tier_recommendation || {});
  const v03qs = v03out ? JSON.stringify((v03out.questions || []).slice().sort()) : '';
  const v031qs = JSON.stringify((v031out.questions || []).slice().sort());
  const questionsChanged = v03qs !== v031qs;

  const prevEval = v03Review.vignette_evaluations[v.id] || null;

  return {
    ...v,
    codebook_info: codebookInfo,
    v031_output: v031out,
    v03_output: v03out,
    v03_to_v031_changes: {
      y_candidates_changed: yChanged,
      mappability_changed: !!mappabilityChanged,
      tier_changed: !!tierChanged,
      questions_changed: questionsChanged,
      any_change: yChanged || mappabilityChanged || tierChanged || questionsChanged,
    },
    v03_review: prevEval,
  };
});

const out = {
  ...vig,
  status: 'enriched_with_v0_3_1_output_and_v0_3_comparison',
  enriched_at: new Date().toISOString(),
  source_v03_review: 'research/vignette-review-v0_3-2026-04-27-mogf0py8.json',
  v031_target: 'v0.3.1 잔여 3건 패치 후 자문자 confirm. 30/30 추정 → 명시 확정.',
  vignettes: enriched,
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote ' + path.relative(repoRoot, outPath));
console.log('Vignettes:', enriched.length);

const changeStats = enriched.reduce((acc, v) => {
  if (v.v03_to_v031_changes.any_change) acc.changed++;
  else acc.same++;
  return acc;
}, { changed: 0, same: 0 });
console.log('v0.3 → v0.3.1 변경:', changeStats.changed + ' / 동일: ' + changeStats.same);

const targets = ['VIG-14', 'VIG-18', 'VIG-25'];
console.log('\n잔여 3건 패치 적용 확인:');
for (const id of targets) {
  const v = enriched.find(x => x.id === id);
  const prev = v.v03_review;
  console.log('  ' + id + ' ' + v.estimated_pre_code + ': ' + prev.evaluation + ' → v0.3.1: m=' + v.v031_output.mappability + ' tier=' + v.v031_output.tier_recommendation.preferred + ' (' + v.v031_output.tier_recommendation.source + ')');
}
