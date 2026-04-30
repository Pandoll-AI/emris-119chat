#!/usr/bin/env node

/**
 * v0.3.1 vignette 재평가 페이지 빌드.
 * VIGNETTES_DATA 블록을 v0.3.1 enriched 데이터로 교체.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const templatePath = path.join(repoRoot, 'prektas-vignette-review-v0_3_1.html');
const dataPath = path.join(repoRoot, 'research/vignettes-with-v0_3_1-output.json');

const template = fs.readFileSync(templatePath, 'utf8');
const data = fs.readFileSync(dataPath, 'utf8');

const blockRegex = /const VIGNETTES_DATA = \{[\s\S]*?\n\};/;
if (!blockRegex.test(template)) {
  console.error('VIGNETTES_DATA 블록을 찾지 못했다.');
  process.exit(1);
}

const replaced = template.replace(blockRegex, 'const VIGNETTES_DATA = ' + data + ';');
fs.writeFileSync(templatePath, replaced);

console.log('Inlined vignettes-with-v0_3_1-output.json into prektas-vignette-review-v0_3_1.html');
console.log('  data size:', (data.length / 1024).toFixed(1) + 'KB');
console.log('  vignettes:', JSON.parse(data).vignettes.length);
