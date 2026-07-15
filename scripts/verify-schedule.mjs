#!/usr/bin/env node
// Regression check for the SCHEDULE generator in index.html.
//
// The collection calendar used to be a fully hand-typed literal covering
// 2026-05-04〜2026-12-28 (156 rows). That literal was reverse-engineered into
// a small rule (weekday + rotation) plus explicit exception tables. This
// script re-generates the calendar from index.html's current generator code
// and diffs it against a frozen snapshot of the original hand-typed data, so
// any future change to the anchors/rotation tables that breaks the known-good
// 2026 calendar is caught immediately.
//
// Run: node scripts/verify-schedule.mjs
//
// When extending to a new year: add the new year's holidays / special events
// to index.html, generate a fresh REFERENCE_SCHEDULE from the *official* city
// calendar for that year (not from the generator itself — that would be
// circular), and add a second comparison block below.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
if (!scriptMatch) {
  console.error('Could not find <script> block in index.html');
  process.exit(1);
}

const sandbox = {
  console,
  document: {
    getElementById: () => ({
      addEventListener() {},
      classList: { add() {}, remove() {} },
      textContent: '',
      innerHTML: '',
    }),
    addEventListener() {},
  },
  Date,
  Math,
  Object,
};
vm.createContext(sandbox);
vm.runInContext(scriptMatch[1] + '\nthis.__SCHEDULE = SCHEDULE;', sandbox);
const generated = sandbox.__SCHEDULE;

// Frozen snapshot of the original hand-typed 2026-05-04〜2026-12-28 calendar
// (156 rows), captured before the generator refactor. This is the ground
// truth the generator must reproduce exactly.
const REFERENCE_SCHEDULE_2026 = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'reference-schedule-2026.json'), 'utf8')
);

let ok = true;
if (generated.length !== REFERENCE_SCHEDULE_2026.length) {
  ok = false;
  console.error(
    `Row count mismatch: generated=${generated.length} reference=${REFERENCE_SCHEDULE_2026.length}`
  );
}

const n = Math.min(generated.length, REFERENCE_SCHEDULE_2026.length);
for (let i = 0; i < n; i++) {
  const g = JSON.stringify(generated[i]);
  const r = JSON.stringify(REFERENCE_SCHEDULE_2026[i]);
  if (g !== r) {
    ok = false;
    console.error(`Row ${i} mismatch:\n  generated: ${g}\n  reference: ${r}`);
  }
}

if (ok) {
  console.log(`OK: generated schedule matches reference exactly (${n} rows).`);
  process.exit(0);
} else {
  console.error('FAILED: generated schedule does not match the official 2026 reference.');
  process.exit(1);
}
