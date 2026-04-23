#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const schemaPath = path.join(repoRoot, 'data/schemas/prektas-codebook.schema.json');
const codebookPath = path.join(repoRoot, 'data/prektas-codebook.json');

function loadJson(filepath) {
  if (!fs.existsSync(filepath)) {
    throw new Error('Missing file: ' + filepath);
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function validateSchema(codebook, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats.default(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(codebook);
  return { ok, errors: validate.errors || [] };
}

function validateIntegrity(codebook) {
  const errors = [];
  const { entries, stats } = codebook;

  if (stats.total !== entries.length) {
    errors.push(`stats.total=${stats.total} but entries.length=${entries.length}`);
  }

  const seenCodes = new Set();
  let adult = 0;
  let pediatric = 0;

  const level2Registry = new Map();
  const level3Registry = new Map();
  const level2CodeToName = new Map();

  for (const entry of entries) {
    if (seenCodes.has(entry.code)) {
      errors.push(`duplicate entry code: ${entry.code}`);
    }
    seenCodes.add(entry.code);

    const expectedGroup = entry.code[0] === 'C' ? 'adult' : entry.code[0] === 'D' ? 'pediatric' : null;
    if (!expectedGroup) {
      errors.push(`unknown group prefix for code ${entry.code}`);
    } else if (expectedGroup !== entry.group) {
      errors.push(`group mismatch for ${entry.code}: prefix implies ${expectedGroup}, field says ${entry.group}`);
    }

    if (entry.level2.code !== entry.code[1]) {
      errors.push(`level2.code must equal code[1] for ${entry.code}`);
    }
    if (entry.level3.code !== entry.code[2]) {
      errors.push(`level3.code must equal code[2] for ${entry.code}`);
    }
    if (entry.level4.code !== entry.code.slice(3, 5)) {
      errors.push(`level4.code must equal code[3:5] for ${entry.code}`);
    }

    const l2Key = `${entry.group}:${entry.level2.code}`;
    if (!level2Registry.has(l2Key)) level2Registry.set(l2Key, new Set());
    level2Registry.get(l2Key).add(entry.level2.name);

    if (!level2CodeToName.has(entry.level2.code)) level2CodeToName.set(entry.level2.code, new Set());
    level2CodeToName.get(entry.level2.code).add(entry.level2.name);

    const l3Key = `${l2Key}/${entry.level3.code}`;
    if (!level3Registry.has(l3Key)) level3Registry.set(l3Key, new Set());
    level3Registry.get(l3Key).add(entry.level3.name);

    if (entry.group === 'adult') adult += 1;
    else if (entry.group === 'pediatric') pediatric += 1;
  }

  if (stats.by_group.adult !== adult) errors.push(`stats.by_group.adult=${stats.by_group.adult} but counted ${adult}`);
  if (stats.by_group.pediatric !== pediatric) errors.push(`stats.by_group.pediatric=${stats.by_group.pediatric} but counted ${pediatric}`);

  const level2NameSet = new Set();
  for (const names of level2CodeToName.values()) {
    for (const name of names) level2NameSet.add(name);
  }
  if (stats.level2_category_count !== level2NameSet.size) {
    errors.push(`stats.level2_category_count=${stats.level2_category_count} but counted ${level2NameSet.size}`);
  }

  for (const [key, names] of level2Registry.entries()) {
    if (names.size > 1) {
      errors.push(`level2 code ${key} carries multiple names: ${Array.from(names).join(' | ')}`);
    }
  }
  for (const [key, names] of level3Registry.entries()) {
    if (names.size > 1) {
      errors.push(`level3 code ${key} carries multiple names: ${Array.from(names).join(' | ')}`);
    }
  }
  for (const [code, names] of level2CodeToName.entries()) {
    if (names.size > 1) {
      errors.push(`level2 code "${code}" has inconsistent names across groups: ${Array.from(names).join(' | ')}`);
    }
  }

  return { errors };
}

function main() {
  const schema = loadJson(schemaPath);
  const codebook = loadJson(codebookPath);

  const schemaResult = validateSchema(codebook, schema);
  const integrityResult = validateIntegrity(codebook);

  if (!schemaResult.ok) {
    console.error('Schema validation FAILED:');
    for (const err of schemaResult.errors) {
      console.error(`  ${err.instancePath} ${err.message} ${err.params ? JSON.stringify(err.params) : ''}`);
    }
  } else {
    console.log(`Schema validation: ok (${codebook.entries.length} entries)`);
  }

  if (integrityResult.errors.length) {
    console.error('Integrity FAILED:');
    for (const msg of integrityResult.errors) console.error(`  ${msg}`);
  } else {
    console.log('Integrity: ok');
  }

  const failed = !schemaResult.ok || integrityResult.errors.length > 0;
  process.exit(failed ? 1 : 0);
}

main();
