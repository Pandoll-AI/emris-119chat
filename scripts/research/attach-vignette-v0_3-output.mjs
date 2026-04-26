#!/usr/bin/env node

/**
 * 각 vignette의 estimated_pre_code에 대해 v0.3 알고리즘 출력 + v0.2 비교를 attach.
 * Output: research/vignettes-with-v0_3-output.json
 *
 * 자문자가 v0.3 출력을 재평가할 때 v0.2 출력도 같이 보고 무엇이 바뀌었는지 알 수 있게 한다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const vigPath = path.join(repoRoot, 'research/vignettes-v1.0-draft.json');
const v02Path = path.join(repoRoot, 'research/prektas-to-y-mapping-v0.2.json');
const v03Path = path.join(repoRoot, 'research/prektas-to-y-mapping-v0.3.json');
const codebookPath = path.join(repoRoot, 'data/prektas-codebook.json');
const prevReviewPath = path.join(repoRoot, 'research/vignette-review-2026-04-26-mofq7k1h.json');
const outPath = path.join(repoRoot, 'research/vignettes-with-v0_3-output.json');

const vig = JSON.parse(fs.readFileSync(vigPath, 'utf8'));
const v02 = JSON.parse(fs.readFileSync(v02Path, 'utf8'));
const v03 = JSON.parse(fs.readFileSync(v03Path, 'utf8'));
const codebook = JSON.parse(fs.readFileSync(codebookPath, 'utf8'));
const prevReview = JSON.parse(fs.readFileSync(prevReviewPath, 'utf8'));

const codeToV02 = {};
for (const m of v02.mappings) codeToV02[m.code] = m;
const codeToV03 = {};
for (const m of v03.mappings) codeToV03[m.code] = m;
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
  const v02entry = codeToV02[code];
  const v03entry = codeToV03[code];
  const codebookEntry = codeToEntry[code];

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

  // v0.2 vs v0.3 diff 자동 분석
  const v02out = extractOutput(v02entry);
  const v03out = extractOutput(v03entry);
  const v02ys = (v02out.y_candidates || []).map(c => c.code+':'+c.confidence).sort().join(',');
  const v03ys = (v03out.y_candidates || []).map(c => c.code+':'+c.confidence).sort().join(',');
  const yChanged = v02ys !== v03ys;
  const mappabilityChanged = v02out.mappability !== v03out.mappability;
  const tierChanged = JSON.stringify(v02out.tier_recommendation || {}) !== JSON.stringify(v03out.tier_recommendation || {});
  const v02qs = JSON.stringify((v02out.questions || []).slice().sort());
  const v03qs = JSON.stringify((v03out.questions || []).slice().sort());
  const questionsChanged = v02qs !== v03qs;

  const prevEval = prevReview.vignette_evaluations[v.id] || null;

  return {
    ...v,
    codebook_info: codebookInfo,
    v02_output: v02out,
    v03_output: v03out,
    v02_to_v03_changes: {
      y_candidates_changed: yChanged,
      mappability_changed: mappabilityChanged,
      tier_changed: tierChanged,
      questions_changed: questionsChanged,
      any_change: yChanged || mappabilityChanged || tierChanged || questionsChanged,
    },
    v02_review: prevEval,
  };
});

const out = {
  ...vig,
  status: 'enriched_with_v03_output_and_v02_comparison',
  enriched_at: new Date().toISOString(),
  source_v02_review: 'research/vignette-review-2026-04-26-mofq7k1h.json',
  v03_target: 'v0.3 vignette confirm 후 production 통합 (Phase 11f)',
  vignettes: enriched,
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote ' + path.relative(repoRoot, outPath));
console.log('Vignettes:', enriched.length);

const changeStats = enriched.reduce((acc, v) => {
  if (v.v02_to_v03_changes.any_change) acc.changed++;
  else acc.same++;
  return acc;
}, { changed: 0, same: 0 });
console.log('v0.2 → v0.3 변경: ' + changeStats.changed + ' / 동일: ' + changeStats.same);

const byMap03 = {};
enriched.forEach(v => {
  const m = v.v03_output.mappability || 'error';
  byMap03[m] = (byMap03[m] || 0) + 1;
});
console.log('v0.3 mappability:', byMap03);

const prevImproved = enriched.filter(v => v.v02_review && (v.v02_review.evaluation === 'inappropriate' || v.v02_review.evaluation === 'partial') && v.v02_to_v03_changes.any_change);
console.log('v0.2에서 partial/inappropriate였고 v0.3에서 변경된 vignette:', prevImproved.length);
prevImproved.forEach(v => console.log('  ' + v.id + ' ('+v.v02_review.evaluation+'): ' + v.estimated_pre_code));
