#!/usr/bin/env node

/**
 * vignette 자문 페이지에 vignettes-with-output.json 데이터를 inline 임베드.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const templatePath = path.join(repoRoot, 'prektas-vignette-review.html');
const dataPath = path.join(repoRoot, 'research/vignettes-with-output.json');

let template = fs.readFileSync(templatePath, 'utf8');
const data = fs.readFileSync(dataPath, 'utf8');

// JSON.stringify된 데이터를 그대로 임베드
const replaced = template.replace('__VIGNETTES_DATA__', data);
fs.writeFileSync(templatePath, replaced);
console.log('Inlined vignettes-with-output.json into prektas-vignette-review.html');
console.log('  data size:', (data.length / 1024).toFixed(1) + 'KB');
