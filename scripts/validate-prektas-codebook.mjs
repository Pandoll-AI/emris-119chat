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
const allowedCollisionsPath = path.join(repoRoot, 'data/codebook-allowed-collisions.json');

const STRICT = process.argv.slice(2).includes('--strict');

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
  return {
    ok,
    errors: validate.errors || [],
  };
}

function validateIntegrity(codebook) {
  const errors = [];
  const { entries, stats } = codebook;

  if (stats.total !== entries.length) {
    errors.push('stats.total=' + stats.total + ' but entries.length=' + entries.length);
  }

  const seenCodes = new Set();
  let labeled = 0;
  let reserved = 0;
  let adult = 0;
  let pediatric = 0;

  const level2Registry = new Map();
  const level3Registry = new Map();

  for (const entry of entries) {
    if (seenCodes.has(entry.code)) {
      errors.push('Duplicate entry code: ' + entry.code);
    }
    seenCodes.add(entry.code);

    const expectedGroup = entry.code[0] === 'C' ? 'adult' : entry.code[0] === 'D' ? 'pediatric' : null;
    if (!expectedGroup) {
      errors.push('Unknown group prefix for code ' + entry.code);
    } else if (expectedGroup !== entry.group) {
      errors.push('Group mismatch for ' + entry.code + ': code prefix implies ' + expectedGroup + ', field says ' + entry.group);
    }

    if (entry.reserved) {
      reserved += 1;
      if (entry.level2 !== null || entry.level3 !== null || entry.level4 !== null) {
        errors.push('reserved=true requires level2/3/4=null for ' + entry.code);
      }
    } else {
      labeled += 1;
      if (!entry.level2 || entry.level2.code !== entry.code[1]) {
        errors.push('level2.code must equal code[1] for ' + entry.code);
      }
      if (!entry.level3 || entry.level3.code !== entry.code[2]) {
        errors.push('level3.code must equal code[2] for ' + entry.code);
      }
      if (!entry.level4 || entry.level4.code !== entry.code.slice(3, 5)) {
        errors.push('level4.code must equal code[3:5] for ' + entry.code);
      }

      const l2Key = entry.group + ':' + entry.level2.code;
      if (!level2Registry.has(l2Key)) level2Registry.set(l2Key, new Set());
      level2Registry.get(l2Key).add(entry.level2.name);

      const l3Key = l2Key + '/' + entry.level3.code;
      if (!level3Registry.has(l3Key)) level3Registry.set(l3Key, new Set());
      level3Registry.get(l3Key).add(entry.level3.name);
    }

    if (entry.group === 'adult') adult += 1;
    else if (entry.group === 'pediatric') pediatric += 1;
  }

  if (stats.labeled !== labeled) errors.push('stats.labeled=' + stats.labeled + ' but counted ' + labeled);
  if (stats.reserved !== reserved) errors.push('stats.reserved=' + stats.reserved + ' but counted ' + reserved);
  if (stats.by_group.adult !== adult) errors.push('stats.by_group.adult=' + stats.by_group.adult + ' but counted ' + adult);
  if (stats.by_group.pediatric !== pediatric) errors.push('stats.by_group.pediatric=' + stats.by_group.pediatric + ' but counted ' + pediatric);

  const collisions = { level2: [], level3: [] };
  for (const [key, names] of level2Registry.entries()) {
    if (names.size > 1) {
      const [group, code] = key.split(':');
      collisions.level2.push({ group, code, names: Array.from(names).sort() });
    }
  }
  for (const [key, names] of level3Registry.entries()) {
    if (names.size > 1) {
      const [l2Key, level3Code] = key.split('/');
      const [group, level2Code] = l2Key.split(':');
      collisions.level3.push({ group, level2Code, level3Code, names: Array.from(names).sort() });
    }
  }

  return { errors, collisions };
}

function loadAllowedCollisions() {
  if (!fs.existsSync(allowedCollisionsPath)) return { level2: [], level3: [] };
  const data = loadJson(allowedCollisionsPath);
  return {
    level2: (data.level2 || []).map((item) => ({
      key: item.group + ':' + item.code,
      names: [...item.names].sort().join('|'),
    })),
    level3: (data.level3 || []).map((item) => ({
      key: item.group + ':' + item.level2Code + '/' + item.level3Code,
      names: [...item.names].sort().join('|'),
    })),
  };
}

function partitionCollisions(collisions, allowed) {
  const allowedL2 = new Set(allowed.level2.map((item) => item.key + '|' + item.names));
  const allowedL3 = new Set(allowed.level3.map((item) => item.key + '|' + item.names));
  const approved = { level2: [], level3: [] };
  const unapproved = { level2: [], level3: [] };

  for (const item of collisions.level2) {
    const signature = item.group + ':' + item.code + '|' + item.names.join('|');
    if (allowedL2.has(signature)) approved.level2.push(item);
    else unapproved.level2.push(item);
  }
  for (const item of collisions.level3) {
    const signature = item.group + ':' + item.level2Code + '/' + item.level3Code + '|' + item.names.join('|');
    if (allowedL3.has(signature)) approved.level3.push(item);
    else unapproved.level3.push(item);
  }
  return { approved, unapproved };
}

function formatCollision(item) {
  if ('level3Code' in item) {
    return 'level3 ' + item.group + ':' + item.level2Code + '/' + item.level3Code + ' -> ' + item.names.join(' | ');
  }
  return 'level2 ' + item.group + ':' + item.code + ' -> ' + item.names.join(' | ');
}

function main() {
  const schema = loadJson(schemaPath);
  const codebook = loadJson(codebookPath);
  const allowed = loadAllowedCollisions();

  const schemaResult = validateSchema(codebook, schema);
  const integrityResult = validateIntegrity(codebook);
  const { approved, unapproved } = partitionCollisions(integrityResult.collisions, allowed);

  if (!schemaResult.ok) {
    console.error('Schema validation FAILED:');
    for (const err of schemaResult.errors) {
      console.error('  ' + err.instancePath + ' ' + err.message + (err.params ? ' ' + JSON.stringify(err.params) : ''));
    }
  } else {
    console.log('Schema validation: ok (' + codebook.entries.length + ' entries)');
  }

  if (integrityResult.errors.length) {
    console.error('Integrity FAILED:');
    for (const msg of integrityResult.errors) console.error('  ' + msg);
  } else {
    console.log('Integrity: ok');
  }

  const approvedCount = approved.level2.length + approved.level3.length;
  if (approvedCount > 0) {
    console.log('Allowed collisions (' + approvedCount + ') — pre-whitelisted:');
    for (const item of approved.level2) console.log('  - ' + formatCollision(item));
    for (const item of approved.level3) console.log('  - ' + formatCollision(item));
  }

  const unapprovedCount = unapproved.level2.length + unapproved.level3.length;
  if (unapprovedCount > 0) {
    const label = STRICT ? 'UNAPPROVED collisions (strict)' : 'Warnings — not in whitelist';
    const stream = STRICT ? console.error : console.warn;
    stream(label + ' (' + unapprovedCount + '):');
    for (const item of unapproved.level2) stream('  - ' + formatCollision(item));
    for (const item of unapproved.level3) stream('  - ' + formatCollision(item));
    if (!STRICT) {
      console.warn('  (add to data/codebook-allowed-collisions.json to acknowledge, or run with --strict to fail the build)');
    }
  }

  const failed = !schemaResult.ok
    || integrityResult.errors.length > 0
    || (STRICT && unapprovedCount > 0);
  process.exit(failed ? 1 : 0);
}

main();
