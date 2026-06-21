import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Anchor data dir to a stable location regardless of dev/prod entrypoint.
// - Default: <server-package>/data/tracker.db
// - Override with EG_DATA_DIR env var (e.g. /data on Railway with a Volume).
//
// We can't use __dirname because in dev (tsx src/index.ts) it resolves under
// src/, while in prod (node dist/index.js) it resolves under dist/ — that
// would silently create a SECOND, empty DB next to the real one. Using
// process.cwd()-relative resolution + an explicit override keeps both paths
// pointing at the same file.
const DATA_DIR = process.env.EG_DATA_DIR
  || path.resolve(__dirname, '..', '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'tracker.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    runMigrations(_db);
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

const CURRENT_SCHEMA_VERSION = 6;

const migrations: Record<number, (db: Database.Database) => void> = {
  1: (db) => {
    db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      app_id TEXT NOT NULL,
      user_id TEXT,
      device_user_agent TEXT,
      device_screen TEXT,
      device_language TEXT,
      page_path TEXT NOT NULL,
      page_search TEXT,
      page_hash TEXT,
      page_title TEXT,
      source_type TEXT NOT NULL,
      source_path TEXT,
      source_search TEXT,
      source_title TEXT,
      source_referrer_url TEXT,
      source_chain_index INTEGER,
      payload TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_app ON events(app_id);
    CREATE INDEX IF NOT EXISTS idx_events_page_path ON events(page_path);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);

    CREATE TABLE IF NOT EXISTS chains (
      session_id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL,
      user_id TEXT,
      entries TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_chains_app ON chains(app_id);
    CREATE INDEX IF NOT EXISTS idx_chains_user_id ON chains(user_id);
    `);
  },

  2: (db) => {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_events_app_time ON events(app_id, timestamp)`);
  },
  3: (db) => {
    db.exec(`ALTER TABLE events ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1`);
  },
  4: (db) => {
    db.exec(`
      ALTER TABLE events ADD COLUMN visitor_id TEXT;
      ALTER TABLE events ADD COLUMN is_new_visitor INTEGER;
      CREATE INDEX IF NOT EXISTS idx_events_visitor ON events(visitor_id);
    `);
  },
  5: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS funnels (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        name TEXT NOT NULL,
        steps TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_funnels_app ON funnels(app_id);
    `);
  },
  6: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS labels (
        app_id TEXT NOT NULL,
        raw_key TEXT NOT NULL,
        alias TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (app_id, raw_key)
      );
      CREATE INDEX IF NOT EXISTS idx_labels_app ON labels(app_id);
    `);
  },
};

function runMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);

  const row = db.prepare(
    "SELECT value FROM meta WHERE key = 'schema_version'"
  ).get() as { value?: string } | undefined;

  let version = Number(row?.value ?? 0);

  while (version < CURRENT_SCHEMA_VERSION) {
    version++;

    const migration = migrations[version];
    if (!migration) {
      throw new Error(`[DB] Missing migration v${version}`);
    }

    db.transaction(() => {
      console.log(`[db] migrate ${version - 1} -> ${version}`);
      migration(db);
      db.prepare(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)"
      ).run(String(version));
    })();
  }
}

if (Object.keys(migrations).length !== CURRENT_SCHEMA_VERSION) {
  throw new Error('[DB] Migration version mismatch');
}
