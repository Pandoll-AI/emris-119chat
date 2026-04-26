#!/usr/bin/env node

/**
 * v0.3 vignette 재평가 페이지 빌드.
 * prektas-vignette-review-v0_3.html 템플릿의 VIGNETTES_DATA 블록을 v0.3 enriched 데이터로 교체.
 *
 * 템플릿은 이미 다음을 포함:
 *  - Phase 11f-prep 헤더 + v0.3 alg meta
 *  - STORAGE_KEY = 'emris_vignette_review_v0_3'
 *  - 추후 추가될 v0.3 + v0.2 비교 렌더 로직 (renderVignettes 수정)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const templatePath = path.join(repoRoot, 'prektas-vignette-review-v0_3.html');
const dataPath = path.join(repoRoot, 'research/vignettes-with-v0_3-output.json');

const template = fs.readFileSync(templatePath, 'utf8');
const data = fs.readFileSync(dataPath, 'utf8');

// VIGNETTES_DATA = { ... }; 블록을 통째로 교체
const blockRegex = /const VIGNETTES_DATA = \{[\s\S]*?\n\};/;
if (!blockRegex.test(template)) {
  console.error('VIGNETTES_DATA 블록을 찾지 못했다.');
  process.exit(1);
}

const replaced = template.replace(blockRegex, 'const VIGNETTES_DATA = ' + data + ';');
fs.writeFileSync(templatePath, replaced);

console.log('Inlined vignettes-with-v0_3-output.json into prektas-vignette-review-v0_3.html');
console.log('  data size:', (data.length / 1024).toFixed(1) + 'KB');
console.log('  vignettes:', JSON.parse(data).vignettes.length);
