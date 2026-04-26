#!/usr/bin/env node

/**
 * 각 vignette의 estimated_pre_code에 대해 v0.2 알고리즘 출력을 lookup해서 attach.
 * Output: research/vignettes-with-output.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const vigPath = path.join(repoRoot, 'research/vignettes-v1.0-draft.json');
const v02Path = path.join(repoRoot, 'research/prektas-to-y-mapping-v0.2.json');
const codebookPath = path.join(repoRoot, 'data/prektas-codebook.json');
const outPath = path.join(repoRoot, 'research/vignettes-with-output.json');

const vig = JSON.parse(fs.readFileSync(vigPath, 'utf8'));
const v02 = JSON.parse(fs.readFileSync(v02Path, 'utf8'));
const codebook = JSON.parse(fs.readFileSync(codebookPath, 'utf8'));

const codeToV02 = {};
for (const m of v02.mappings) codeToV02[m.code] = m;
const codeToEntry = {};
for (const e of codebook.entries) codeToEntry[e.code] = e;

const enriched = vig.vignettes.map(v => {
  const code = v.estimated_pre_code;
  const v02entry = codeToV02[code];
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

  let systemOutput = null;
  if (v02entry) {
    systemOutput = {
      mappability: v02entry.mappability,
      y_candidates: v02entry.y_candidates,
      c_tier_codes: v02entry.c_tier_codes || [],
      tier_recommendation: v02entry.tier_recommendation,
      questions: v02entry.questions,
      rationale: v02entry.rationale,
    };
  } else {
    systemOutput = {
      error: 'estimated_pre_code not found in v0.2 mapping',
      code: code,
    };
  }

  return {
    ...v,
    codebook_info: codebookInfo,
    system_output: systemOutput,
  };
});

const out = {
  ...vig,
  status: 'enriched_with_v02_output',
  enriched_at: new Date().toISOString(),
  vignettes: enriched,
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote ' + path.relative(repoRoot, outPath));
console.log('Vignettes:', enriched.length);
const errors = enriched.filter(v => v.system_output && v.system_output.error);
if (errors.length) {
  console.log('Lookup errors:', errors.length);
  errors.forEach(v => console.log('  ' + v.id + ': ' + v.estimated_pre_code));
}
const byMap = {};
enriched.forEach(v => {
  const m = v.system_output.mappability || 'error';
  byMap[m] = (byMap[m] || 0) + 1;
});
console.log('Mappability distribution:', byMap);
