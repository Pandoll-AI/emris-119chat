#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const sourceCsvPath = path.join(repoRoot, 'data/raw/Pre-KTAS_codebook.csv');
const outputPath = path.join(repoRoot, 'data/prektas-codebook.json');

const VERSION = '2.0.0';

const GROUP_BY_KO = { '성인': 'adult', '소아': 'pediatric' };

function parseCsv(text) {
  const normalized = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    if (ch === '"') {
      if (inQuotes && normalized[i + 1] === '"') { cell += '"'; i += 1; }
      else { inQuotes = !inQuotes; }
      continue;
    }
    if (ch === ',' && !inQuotes) { row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && normalized[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => String(v || '').trim() !== ''));
}

function toEntry(row, lineNumber) {
  const [group_ko, code, l2_code, l2_name, l3_code, l3_name, l4_code, l4_name, grade_raw] = row.map((v) => String(v || '').trim());

  const group = GROUP_BY_KO[group_ko];
  if (!group) {
    throw new Error(`line ${lineNumber}: unknown group "${group_ko}" (expected 성인 or 소아)`);
  }
  if (!/^[CD][A-Z]{4}$/.test(code)) {
    throw new Error(`line ${lineNumber}: malformed Pre-KTAS code "${code}"`);
  }
  const expectedGroupPrefix = group === 'adult' ? 'C' : 'D';
  if (code[0] !== expectedGroupPrefix) {
    throw new Error(`line ${lineNumber}: code "${code}" prefix does not match 구분 "${group_ko}"`);
  }
  if (code[1] !== l2_code || code[2] !== l3_code || code.slice(3, 5) !== l4_code) {
    throw new Error(`line ${lineNumber}: code "${code}" does not match level codes (${l2_code}/${l3_code}/${l4_code})`);
  }
  if (!l2_name || !l3_name || !l4_name) {
    throw new Error(`line ${lineNumber}: code "${code}" is missing one or more level names`);
  }
  const grade = Number(grade_raw);
  if (!Number.isInteger(grade) || grade < 1 || grade > 5) {
    throw new Error(`line ${lineNumber}: invalid grade "${grade_raw}" for code "${code}"`);
  }

  return {
    code,
    group,
    grade,
    level2: { code: l2_code, name: l2_name },
    level3: { code: l3_code, name: l3_name },
    level4: { code: l4_code, name: l4_name },
  };
}

function buildStats(entries) {
  let adult = 0;
  let pediatric = 0;
  const level2Names = new Set();
  for (const entry of entries) {
    if (entry.group === 'adult') adult += 1;
    else pediatric += 1;
    level2Names.add(entry.level2.name);
  }
  return {
    total: entries.length,
    by_group: { adult, pediatric },
    level2_category_count: level2Names.size,
  };
}

function main() {
  const text = fs.readFileSync(sourceCsvPath, 'utf8');
  const sha256 = crypto.createHash('sha256').update(text).digest('hex');
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error('CSV has no data rows');
  }
  const [header, ...dataRows] = rows;
  const expectedHeader = ['구분', '분류코드', '2단계_코드', '2단계_명칭', '3단계_코드', '3단계_명칭', '4단계_코드', '4단계_명칭', '중증도'];
  const trimmedHeader = header.map((h) => String(h || '').replace(/^﻿/, '').trim());
  if (trimmedHeader.join('|') !== expectedHeader.join('|')) {
    throw new Error(`Unexpected CSV header:\n  got:      ${trimmedHeader.join('|')}\n  expected: ${expectedHeader.join('|')}`);
  }

  const entries = dataRows.map((row, idx) => toEntry(row, idx + 2));
  entries.sort((a, b) => a.code.localeCompare(b.code));

  const codebook = {
    version: VERSION,
    source: {
      file: path.relative(repoRoot, sourceCsvPath),
      sha256,
      extracted_at: new Date().toISOString(),
    },
    stats: buildStats(entries),
    entries,
  };

  fs.writeFileSync(outputPath, JSON.stringify(codebook, null, 2) + '\n');
  console.log('Wrote ' + path.relative(repoRoot, outputPath));
  console.log('  total=' + codebook.stats.total
    + ', adult=' + codebook.stats.by_group.adult
    + ', pediatric=' + codebook.stats.by_group.pediatric
    + ', level2_categories=' + codebook.stats.level2_category_count);
}

main();
