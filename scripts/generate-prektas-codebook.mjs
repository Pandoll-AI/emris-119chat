#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const sourceKeypadPath = '/Users/sjlee/Projects/prektas-research/prektas-input-keypad.html';
const outputPath = path.join(repoRoot, 'data/prektas-codebook.json');

const VERSION = '1.0.0';

function extractRecordsRaw(html) {
  const match = html.match(/const RECORDS_RAW = (\[[\s\S]*?\]);\s*const records/);
  if (!match) {
    throw new Error('RECORDS_RAW block not found in source keypad HTML. Update the extraction anchor if source file format changed.');
  }
  return JSON.parse(match[1]);
}

function classifyGroup(codeChar) {
  if (codeChar === 'C') return 'adult';
  if (codeChar === 'D') return 'pediatric';
  throw new Error('Unknown Pre-KTAS group prefix: ' + codeChar);
}

function toEntry(raw) {
  const code = String(raw[0] || '').trim();
  if (!/^[CD][A-Z]{4}$/.test(code)) {
    throw new Error('Malformed Pre-KTAS code: ' + JSON.stringify(raw));
  }
  const gradeNum = Number(raw[1]);
  if (!Number.isInteger(gradeNum) || gradeNum < 1 || gradeNum > 5) {
    throw new Error('Invalid grade for ' + code + ': ' + raw[1]);
  }

  const level2Name = String(raw[2] || '').trim();
  const level3Name = String(raw[3] || '').trim();
  const level4Name = String(raw[4] || '').trim();
  const hasAnyLabel = level2Name || level3Name || level4Name;
  const hasAllLabels = level2Name && level3Name && level4Name;
  if (hasAnyLabel && !hasAllLabels) {
    throw new Error('Partial labels on ' + code + ': expected all three of level2/3/4 or none.');
  }
  const reserved = !hasAllLabels;

  return {
    code,
    group: classifyGroup(code[0]),
    grade: gradeNum,
    reserved,
    level2: reserved ? null : { code: code[1], name: level2Name },
    level3: reserved ? null : { code: code[2], name: level3Name },
    level4: reserved ? null : { code: code.slice(3, 5), name: level4Name },
  };
}

function buildStats(entries) {
  let labeled = 0;
  let reserved = 0;
  let adult = 0;
  let pediatric = 0;
  for (const entry of entries) {
    if (entry.reserved) reserved += 1;
    else labeled += 1;
    if (entry.group === 'adult') adult += 1;
    else pediatric += 1;
  }
  return {
    total: entries.length,
    labeled,
    reserved,
    by_group: { adult, pediatric },
  };
}

function main() {
  const html = fs.readFileSync(sourceKeypadPath, 'utf8');
  const sha256 = crypto.createHash('sha256').update(html).digest('hex');
  const raw = extractRecordsRaw(html);

  const entries = raw.map(toEntry);
  entries.sort((a, b) => a.code.localeCompare(b.code));

  const codebook = {
    version: VERSION,
    source: {
      file: path.basename(sourceKeypadPath),
      sha256,
      extracted_at: new Date().toISOString(),
    },
    stats: buildStats(entries),
    entries,
  };

  fs.writeFileSync(outputPath, JSON.stringify(codebook, null, 2) + '\n');
  console.log('Wrote ' + path.relative(repoRoot, outputPath));
  console.log('  total=' + codebook.stats.total + ', labeled=' + codebook.stats.labeled + ', reserved=' + codebook.stats.reserved);
  console.log('  adult=' + codebook.stats.by_group.adult + ', pediatric=' + codebook.stats.by_group.pediatric);
}

main();
