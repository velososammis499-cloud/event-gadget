/**
 * One-shot migration: replace legacy '#view=' with canonical '?view=' across
 *   - events.page_path
 *   - events.source_path
 *   - chains.entries (JSON column, parsed and rewritten)
 *
 * Behaviour:
 *   - Default mode: writes a timestamped backup next to the DB, then runs all
 *     three updates in a single transaction.
 *   - --dry-run: only counts affected rows; makes no changes, no backup.
 *
 * Idempotent: running it twice is a no-op (the second pass finds 0 affected rows).
 *
 * Usage:
 *   cd packages/server
 *   npx tsx scripts/migrate-view-format.ts --dry-run
 *   npx tsx scripts/migrate-view-format.ts
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = path.resolve(__dirname, '../data/tracker.db');
const DRY_RUN = process.argv.includes('--dry-run');

if (!fs.existsSync(DB_PATH)) {
  console.error(`[migrate] DB not found: ${DB_PATH}`);
  process.exit(1);
}

console.log(`[migrate] target: ${DB_PATH}`);
console.log(`[migrate] mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}`);

const db = new Database(DB_PATH);

// ---- Count first ----
const countEventsPage = (db.prepare(
  `SELECT COUNT(*) AS n FROM events WHERE page_path LIKE '%#view=%'`,
).get() as { n: number }).n;
const countEventsSource = (db.prepare(
  `SELECT COUNT(*) AS n FROM events WHERE source_path LIKE '%#view=%'`,
).get() as { n: number }).n;
const countChains = (db.prepare(
  `SELECT COUNT(*) AS n FROM chains WHERE entries LIKE '%#view=%'`,
).get() as { n: number }).n;

console.log(`[migrate] affected events.page_path:   ${countEventsPage}`);
console.log(`[migrate] affected events.source_path: ${countEventsSource}`);
console.log(`[migrate] affected chains.entries:     ${countChains}`);

if (countEventsPage + countEventsSource + countChains === 0) {
  console.log('[migrate] nothing to do');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('[migrate] DRY RUN — no changes written');
  process.exit(0);
}

// ---- Backup ----
const backupPath = `${DB_PATH}.bak.${Date.now()}`;
fs.copyFileSync(DB_PATH, backupPath);
console.log(`[migrate] backup written: ${backupPath}`);

// ---- Pull chains rows that need JSON rewriting before the transaction ----
const chainsToRewrite = db.prepare(
  `SELECT session_id, entries FROM chains WHERE entries LIKE '%#view=%'`,
).all() as Array<{ session_id: string; entries: string }>;

const rewriteString = (s: unknown): unknown => {
  if (typeof s !== 'string') return s;
  return s.includes('#view=') ? s.replace(/#view=/g, '?view=') : s;
};

const rewriteEntries = (raw: string): string => {
  const arr = JSON.parse(raw) as unknown;
  if (!Array.isArray(arr)) return raw;
  for (const item of arr) {
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      if (typeof o.path === 'string') o.path = rewriteString(o.path);
      if (typeof o.search === 'string') o.search = rewriteString(o.search);
      if (typeof o.hash === 'string') o.hash = rewriteString(o.hash);
    }
  }
  return JSON.stringify(arr);
};

const updateChain = db.prepare(
  `UPDATE chains SET entries = @entries WHERE session_id = @session_id`,
);

const tx = db.transaction(() => {
  const r1 = db.prepare(
    `UPDATE events SET page_path = REPLACE(page_path, '#view=', '?view=') WHERE page_path LIKE '%#view=%'`,
  ).run();
  console.log(`[migrate] events.page_path updated: ${r1.changes}`);

  const r2 = db.prepare(
    `UPDATE events SET source_path = REPLACE(source_path, '#view=', '?view=') WHERE source_path LIKE '%#view=%'`,
  ).run();
  console.log(`[migrate] events.source_path updated: ${r2.changes}`);

  let chainChanges = 0;
  for (const row of chainsToRewrite) {
    const next = rewriteEntries(row.entries);
    if (next !== row.entries) {
      updateChain.run({ session_id: row.session_id, entries: next });
      chainChanges++;
    }
  }
  console.log(`[migrate] chains.entries updated: ${chainChanges}`);
});
tx();

// ---- Verify ----
const left = (db.prepare(
  `SELECT
     (SELECT COUNT(*) FROM events WHERE page_path LIKE '%#view=%') AS p,
     (SELECT COUNT(*) FROM events WHERE source_path LIKE '%#view=%') AS s,
     (SELECT COUNT(*) FROM chains WHERE entries LIKE '%#view=%') AS c`,
).get() as { p: number; s: number; c: number });

console.log(`[migrate] post-check  page_path=${left.p}  source_path=${left.s}  chains=${left.c}`);
if (left.p === 0 && left.s === 0 && left.c === 0) {
  console.log('[migrate] success — backup retained at', backupPath);
} else {
  console.error('[migrate] WARNING: some rows remain. Restore from backup if needed.');
  process.exit(2);
}
