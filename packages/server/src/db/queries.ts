import { db } from './db';
import { unifyViewKey } from './path-utils';

// ===== Path Normalization =====

export function normalizePath(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (!segment) return segment;

      // 1. pure numeric id
      if (/^\d+$/.test(segment)) return ':id';

      // 2. uuid
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          segment
        )
      ) {
        return ':id';
      }

      // 3. very high entropy hashes only (strict)
      if (/^[a-f0-9]{28,}$/i.test(segment)) return ':id';

      // 4. numeric with prefix patterns (order-123, user_456)
      if (/^[a-z]+[-_]\d+$/.test(segment)) return ':id';

      return segment;
    })
    .join('/');
}

// ===== Insert =====

export interface InsertEvent {
  id: string;
  type: string;
  schema_version?: number;
  timestamp: number;
  session_id: string;
  app_id: string;
  user_id?: string;
  visitor_id?: string;
  is_new_visitor?: number;
  device_user_agent?: string;
  device_screen?: string;
  device_language?: string;
  page_path: string;
  page_search?: string;
  page_hash?: string;
  page_title?: string;
  source_type: string;
  source_path?: string;
  source_search?: string;
  source_title?: string;
  source_referrer_url?: string;
  source_chain_index?: number;
  payload?: string;
}

const insertEventStmt = db.prepare(`
  INSERT OR IGNORE INTO events (
    id, type, schema_version, timestamp, session_id, app_id, user_id, visitor_id, is_new_visitor,
    device_user_agent, device_screen, device_language,
    page_path, page_search, page_hash, page_title,
    source_type, source_path, source_search, source_title,
    source_referrer_url, source_chain_index, payload
  ) VALUES (
    @id, @type, @schema_version, @timestamp, @session_id, @app_id, @user_id, @visitor_id, @is_new_visitor,
    @device_user_agent, @device_screen, @device_language,
    @page_path, @page_search, @page_hash, @page_title,
    @source_type, @source_path, @source_search, @source_title,
    @source_referrer_url, @source_chain_index, @payload
  )
`);

const upsertChainStmt = db.prepare(`
  INSERT INTO chains (session_id, app_id, user_id, entries, updated_at)
  VALUES (@session_id, @app_id, @user_id, @entries, @updated_at)
  ON CONFLICT(session_id) DO UPDATE SET
    user_id = @user_id,
    entries = @entries,
    updated_at = @updated_at
`);

const insertMany = db.transaction((items: InsertEvent[]) => {
  for (const item of items) {
    insertEventStmt.run(item);
  }
});

export function insertEvents(events: InsertEvent[]): void {
  insertMany(events);
}

export function upsertChain(params: {
  session_id: string;
  app_id: string;
  user_id?: string;
  entries: string;
  updated_at: number;
}): void {
  upsertChainStmt.run(params);
}

// ===== Queries =====

export function getEventsCount(options: {
  appId?: string;
  pagePath?: string;
  pathMatch?: 'contains' | 'prefix' | 'exact';
  sessionId?: string;
  userId?: string;
  type?: string;
  startTime?: number;
  endTime?: number;
}): number {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (options.appId) { clauses.push('app_id = @appId'); params.appId = options.appId; }
  if (options.pagePath) {
    const match = options.pathMatch ?? 'contains';
    if (match === 'exact') {
      clauses.push('page_path = @pagePath'); params.pagePath = options.pagePath;
    } else if (match === 'prefix') {
      clauses.push('page_path LIKE @pagePath'); params.pagePath = `${options.pagePath}%`;
    } else {
      clauses.push('page_path LIKE @pagePath'); params.pagePath = `%${options.pagePath}%`;
    }
  }
  if (options.sessionId) { clauses.push('session_id = @sessionId'); params.sessionId = options.sessionId; }
  if (options.userId) { clauses.push('user_id = @userId'); params.userId = options.userId; }
  if (options.type) { clauses.push('type = @type'); params.type = options.type; }
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const row = db.prepare(`SELECT COUNT(*) as total FROM events ${where}`).get(params) as { total: number };
  return row.total;
}

export function getEvents(options: {
  appId?: string;
  pagePath?: string;
  pathMatch?: 'contains' | 'prefix' | 'exact';
  sessionId?: string;
  userId?: string;
  type?: string;
  limit?: number;
  offset?: number;
  startTime?: number;
  endTime?: number;
}): InsertEvent[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (options.appId) { clauses.push('app_id = @appId'); params.appId = options.appId; }
  if (options.pagePath) {
    const match = options.pathMatch ?? 'contains';
    if (match === 'exact') {
      clauses.push('page_path = @pagePath'); params.pagePath = options.pagePath;
    } else if (match === 'prefix') {
      clauses.push('page_path LIKE @pagePath'); params.pagePath = `${options.pagePath}%`;
    } else {
      clauses.push('page_path LIKE @pagePath'); params.pagePath = `%${options.pagePath}%`;
    }
  }
  if (options.sessionId) { clauses.push('session_id = @sessionId'); params.sessionId = options.sessionId; }
  if (options.userId) { clauses.push('user_id = @userId'); params.userId = options.userId; }
  if (options.type) { clauses.push('type = @type'); params.type = options.type; }
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  return db.prepare(`SELECT * FROM events ${where} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }) as InsertEvent[];
}

export function getPageStats(options: {
  appId?: string;
  startTime?: number;
  endTime?: number;
}): Array<{
  page_path: string;
  page_title: string;
  views: number;
  unique_sessions: number;
  unique_users: number;
}> {
  const clauses: string[] = ["type = 'pageview'"];
  const params: Record<string, unknown> = {};

  if (options.appId) { clauses.push('app_id = @appId'); params.appId = options.appId; }
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }

  const where = `WHERE ${clauses.join(' AND ')}`;

  const rows = db.prepare(`
    SELECT
      page_path,
      page_title,
      COUNT(*) as views,
      COUNT(DISTINCT session_id) as unique_sessions,
      COUNT(DISTINCT user_id) as unique_users
    FROM events ${where}
    GROUP BY page_path
    ORDER BY views DESC
    LIMIT 50
  `).all(params) as Array<{
    page_path: string;
    page_title: string;
    views: number;
    unique_sessions: number;
    unique_users: number;
  }>;

  // Merge rows that normalize to the same path
  const merged = new Map<string, { page_path: string; page_title: string; views: number; unique_sessions: number; unique_users: number }>();
  for (const row of rows) {
    const key = normalizePath(unifyViewKey(row.page_path));
    const existing = merged.get(key);
    if (existing) {
      existing.views += row.views;
      existing.unique_sessions += row.unique_sessions;
      existing.unique_users += row.unique_users;
    } else {
      merged.set(key, { ...row, page_path: key });
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.views - a.views);
}

export function getJourneys(options: {
  appId?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): Array<{
  source_path: string;
  target_path: string;
  count: number;
}> {
  const clauses: string[] = [
    "type = 'pageview'",
    "source_type = 'internal'",
    "source_path IS NOT NULL",
    "source_path != ''",
  ];
  const params: Record<string, unknown> = {};

  if (options.appId) { clauses.push('app_id = @appId'); params.appId = options.appId; }
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }

  const where = `WHERE ${clauses.join(' AND ')}`;
  const FINAL_LIMIT = options.limit ?? 50;
  const dbLimit = Math.min(Math.max(FINAL_LIMIT * 3, 500), 2000);

  const rows = db.prepare(`
    SELECT
      source_path,
      page_path as target_path
    FROM events
    ${where}
    LIMIT ${dbLimit}
  `).all(params) as Array<{
    source_path: string;
    target_path: string;
  }>;

  const merged = new Map<string, {
    source_path: string;
    target_path: string;
    count: number;
  }>();

  for (const row of rows) {
    const src = normalizePath(unifyViewKey(row.source_path));
    const tgt = normalizePath(unifyViewKey(row.target_path));

    const key = `${src}::${tgt}`;

    const existing = merged.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      merged.set(key, {
        source_path: src,
        target_path: tgt,
        count: 1,
      });
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, FINAL_LIMIT);
}

export function getChains(options: {
  appId?: string;
  userId?: string;
  limit?: number;
}): Array<{
  session_id: string;
  app_id: string;
  user_id: string | null;
  entries: string;
  updated_at: number;
}> {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (options.appId) { clauses.push('app_id = @appId'); params.appId = options.appId; }
  if (options.userId) { clauses.push('user_id = @userId'); params.userId = options.userId; }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = options.limit ?? 20;

  return db.prepare(`SELECT * FROM chains ${where} ORDER BY updated_at DESC LIMIT @limit`)
    .all({ ...params, limit }) as Array<{
      session_id: string;
      app_id: string;
      user_id: string | null;
      entries: string;
      updated_at: number;
    }>;
}

// ===== Labels (raw dataTrack → human alias) =====

export interface LabelRow {
  app_id: string;
  raw_key: string;
  alias: string;
  updated_at: number;
}

export function listLabels(appId: string): LabelRow[] {
  return db.prepare(`SELECT * FROM labels WHERE app_id = @appId ORDER BY raw_key ASC`).all({ appId }) as LabelRow[];
}

export function upsertLabel(appId: string, rawKey: string, alias: string): void {
  db.prepare(`
    INSERT INTO labels (app_id, raw_key, alias, updated_at)
    VALUES (@appId, @rawKey, @alias, unixepoch())
    ON CONFLICT(app_id, raw_key) DO UPDATE SET alias = @alias, updated_at = unixepoch()
  `).run({ appId, rawKey, alias });
}

export function deleteLabel(appId: string, rawKey: string): void {
  db.prepare(`DELETE FROM labels WHERE app_id = @appId AND raw_key = @rawKey`).run({ appId, rawKey });
}

/** Read-through alias map for an app. Returns Map<rawKey, alias>. */
export function getAliasMap(appId: string): Map<string, string> {
  const rows = db.prepare(`SELECT raw_key, alias FROM labels WHERE app_id = @appId`).all({ appId }) as Array<{ raw_key: string; alias: string }>;
  const m = new Map<string, string>();
  for (const r of rows) m.set(r.raw_key, r.alias);
  return m;
}

// ===== Rankings (click/impression by data-track key, with CTR) =====

export interface RankingRow {
  /** The raw data-track value, or the fallback display label when no data-track was set. */
  key: string;
  /** Human-friendly label (alias if set, else extracted from payload text). */
  label: string;
  clicks: number;
  impressions: number;
  /** clicks / impressions, or null when impressions === 0. */
  ctr: number | null;
}

/** Aggregated click + impression counts keyed by data-track for an app + window.
 *  Used to compute CTR ("did users click on what they saw?"). */
export function getRankings(options: {
  appId: string;
  startTime?: number;
  endTime?: number;
}): RankingRow[] {
  const clauses: string[] = ['app_id = @appId', "type IN ('click', 'impression')"];
  const params: Record<string, unknown> = { appId: options.appId };
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }
  const where = `WHERE ${clauses.join(' AND ')}`;

  // Pull (type, payload) pairs and aggregate in JS — needed to read dataTrack out of JSON payload.
  const rows = db.prepare(`SELECT type, payload FROM events ${where}`).all(params) as Array<{ type: string; payload: string | null }>;

  const buckets = new Map<string, { clicks: number; impressions: number; sampleText: string | null }>();
  for (const row of rows) {
    if (!row.payload) continue;
    let p: { dataTrack?: string; text?: string };
    try { p = JSON.parse(row.payload) as { dataTrack?: string; text?: string }; } catch { continue; }
    const key = p.dataTrack;
    if (!key) continue; // ignore unlabeled events — CTR only makes sense per "named" element
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { clicks: 0, impressions: 0, sampleText: null };
      buckets.set(key, bucket);
    }
    if (row.type === 'click') bucket.clicks++;
    else if (row.type === 'impression') bucket.impressions++;
    if (!bucket.sampleText && p.text) bucket.sampleText = p.text;
  }

  const aliasMap = getAliasMap(options.appId);

  return Array.from(buckets.entries())
    .map(([key, { clicks, impressions, sampleText }]) => ({
      key,
      label: aliasMap.get(key) ?? sampleText ?? key,
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : null,
    }))
    .sort((a, b) => (b.clicks + b.impressions) - (a.clicks + a.impressions));
}



export interface OverviewTotals {
  uniqueVisitors: number;
  uniqueSessions: number;
  pageViews: number;
  avgSessionMs: number;
  newVisitors: number;
  returningVisitors: number;
  unknownVisitors: number;
}

/** Aggregates for one time window. Uses COALESCE(user_id, visitor_id) so that
 *  hosts that *do* supply a real user_id get unified deduplication while hosts
 *  that don't still get a meaningful "users" count from the cookie fallback. */
export function getOverviewTotals(options: {
  appId?: string;
  startTime?: number;
  endTime?: number;
}): OverviewTotals {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (options.appId) { clauses.push('app_id = @appId'); params.appId = options.appId; }
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const totals = db.prepare(`
    SELECT
      COUNT(DISTINCT COALESCE(user_id, visitor_id)) as unique_visitors,
      COUNT(DISTINCT session_id) as unique_sessions,
      SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) as page_views
    FROM events ${where}
  `).get(params) as { unique_visitors: number; unique_sessions: number; page_views: number };

  // New vs returning — a visitor is "new" in this window iff their earliest
  // event in this window has is_new_visitor=1 (i.e. their tracking cookie
  // was created during this visit). If their earliest event in window has
  // is_new_visitor=0, they already existed before this window → returning.
  const visitorFlags = db.prepare(`
    SELECT vid, is_new_visitor FROM (
      SELECT COALESCE(user_id, visitor_id) as vid,
             is_new_visitor,
             ROW_NUMBER() OVER (PARTITION BY COALESCE(user_id, visitor_id) ORDER BY timestamp) as rn
      FROM events ${where}
    ) WHERE rn = 1
  `).all(params) as Array<{ vid: string | null; is_new_visitor: number | null }>;

  let newVisitors = 0;
  let returningVisitors = 0;
  let unknownVisitors = 0;
  for (const row of visitorFlags) {
    if (!row.vid) continue;
    if (row.is_new_visitor === 1) newVisitors++;
    else if (row.is_new_visitor === 0) returningVisitors++;
    else unknownVisitors++;
  }

  // Avg session active time: prefer SDK dwell events (heartbeat=false emits
  // the final accumulated active duration on visibilitychange/pagehide — it
  // already excludes tab-hidden time). Fall back to MAX-MIN timestamp span
  // for sessions without any final dwell event (very short sessions, old data
  // without dwell collector, page closed before dwell could fire). Without
  // this fallback the metric would silently halve when half the sessions
  // never closed cleanly.
  const session = db.prepare(`
    WITH session_active AS (
      SELECT
        session_id,
        MAX(timestamp) - MIN(timestamp) AS ts_span,
        SUM(CASE
              WHEN type = 'dwell'
               AND json_extract(payload, '$.heartbeat') = 0
              THEN CAST(json_extract(payload, '$.duration') AS INTEGER)
              ELSE 0
            END) AS dwell_total
      FROM events ${where}
      GROUP BY session_id
      HAVING COUNT(*) > 1
    )
    SELECT AVG(CASE WHEN dwell_total > 0 THEN dwell_total ELSE ts_span END) AS avg_ms
    FROM session_active
  `).get(params) as { avg_ms: number | null };

  return {
    uniqueVisitors: totals.unique_visitors ?? 0,
    uniqueSessions: totals.unique_sessions ?? 0,
    pageViews: totals.page_views ?? 0,
    avgSessionMs: Math.round(session.avg_ms ?? 0),
    newVisitors,
    returningVisitors,
    unknownVisitors,
  };
}

/** Hourly bucket counts of pageviews. Used by overview trend chart. */
export function getHourlyTrend(options: {
  appId?: string;
  startTime?: number;
  endTime?: number;
}): Array<{ ts: number; views: number }> {
  const clauses: string[] = ["type = 'pageview'"];
  const params: Record<string, unknown> = {};
  if (options.appId) { clauses.push('app_id = @appId'); params.appId = options.appId; }
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }
  const where = `WHERE ${clauses.join(' AND ')}`;

  // Bucket = floor(timestamp_ms / hour_ms) * hour_ms
  const HOUR_MS = 3_600_000;
  const rows = db.prepare(`
    SELECT (timestamp / ${HOUR_MS}) * ${HOUR_MS} as ts, COUNT(*) as views
    FROM events ${where}
    GROUP BY ts
    ORDER BY ts ASC
  `).all(params) as Array<{ ts: number; views: number }>;

  return rows;
}

// ===== Funnels =====

export type FunnelStep =
  | { kind: 'page'; path: string }
  | { kind: 'click'; dataTrack: string };

export interface FunnelRow {
  id: string;
  app_id: string;
  name: string;
  steps: string;
  created_at: number;
  updated_at: number;
}

export function insertFunnel(row: { id: string; app_id: string; name: string; steps: string }): void {
  db.prepare(`
    INSERT INTO funnels (id, app_id, name, steps, updated_at)
    VALUES (@id, @app_id, @name, @steps, unixepoch())
  `).run(row);
}

export function updateFunnel(id: string, patch: { name?: string; steps?: string }): void {
  const sets: string[] = ['updated_at = unixepoch()'];
  const params: Record<string, unknown> = { id };
  if (patch.name !== undefined) { sets.push('name = @name'); params.name = patch.name; }
  if (patch.steps !== undefined) { sets.push('steps = @steps'); params.steps = patch.steps; }
  db.prepare(`UPDATE funnels SET ${sets.join(', ')} WHERE id = @id`).run(params);
}

export function deleteFunnel(id: string): void {
  db.prepare('DELETE FROM funnels WHERE id = @id').run({ id });
}

export function listFunnels(appId: string): FunnelRow[] {
  return db.prepare(`
    SELECT * FROM funnels WHERE app_id = @appId ORDER BY updated_at DESC
  `).all({ appId }) as FunnelRow[];
}

export function getFunnel(id: string): FunnelRow | undefined {
  return db.prepare('SELECT * FROM funnels WHERE id = @id').get({ id }) as FunnelRow | undefined;
}

/** Distinct page paths + data-track keys seen for an app, ranked by event count.
 *  Drives the "step picker" dropdown — every option is from the host's real data,
 *  no hardcoded business terms. */
export function getFunnelOptions(appId: string, limit = 100): {
  pages: Array<{ value: string; count: number; title: string | null }>;
  clicks: Array<{ value: string; count: number; sampleText: string | null }>;
} {
  const rawPages = db.prepare(`
    SELECT page_path as value, COUNT(*) as count,
           (SELECT page_title FROM events WHERE app_id = @appId AND page_path = e.page_path AND page_title IS NOT NULL LIMIT 1) as title
    FROM events e
    WHERE app_id = @appId AND type = 'pageview'
    GROUP BY page_path
    ORDER BY count DESC
    LIMIT @limit
  `).all({ appId, limit }) as Array<{ value: string; count: number; title: string | null }>;

  // 合并 legacy '#view=' 与 canonical '?view=':同一视图被算两条时,合并为一条。
  const pageMap = new Map<string, { value: string; count: number; title: string | null }>();
  for (const row of rawPages) {
    const key = unifyViewKey(row.value);
    const cur = pageMap.get(key);
    if (cur) {
      cur.count += row.count;
      if (!cur.title && row.title) cur.title = row.title;
    } else {
      pageMap.set(key, { value: key, count: row.count, title: row.title });
    }
  }
  const pages = Array.from(pageMap.values()).sort((a, b) => b.count - a.count);

  // data-track values from click events. We pull text sample from payload for display.
  const clickRows = db.prepare(`
    SELECT payload FROM events
    WHERE app_id = @appId AND type = 'click' AND payload IS NOT NULL
  `).all({ appId }) as Array<{ payload: string }>;

  const trackMap = new Map<string, { count: number; sample: string | null }>();
  for (const row of clickRows) {
    try {
      const p = JSON.parse(row.payload) as { dataTrack?: string; text?: string };
      const key = p.dataTrack;
      if (!key) continue;
      const cur = trackMap.get(key);
      if (cur) {
        cur.count++;
        if (!cur.sample && p.text) cur.sample = p.text;
      } else {
        trackMap.set(key, { count: 1, sample: p.text ?? null });
      }
    } catch { /* ignore */ }
  }

  const clicks = Array.from(trackMap.entries())
    .map(([value, { count, sample }]) => ({ value, count, sampleText: sample }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { pages, clicks };
}

/** Match an event row against a funnel step. */
function matchStep(row: { type: string; page_path: string; payload: string | null }, step: FunnelStep): boolean {
  if (step.kind === 'page') {
    return row.type === 'pageview' && unifyViewKey(row.page_path) === unifyViewKey(step.path);
  }
  if (step.kind === 'click') {
    if (row.type !== 'click' || !row.payload) return false;
    try {
      const p = JSON.parse(row.payload) as { dataTrack?: string };
      return p.dataTrack === step.dataTrack;
    } catch { return false; }
  }
  return false;
}

export interface FunnelAnalysis {
  steps: FunnelStep[];
  /** Visitor count that reached each step (Step 0 = entered Step 1). */
  counts: number[];
}

/** Compute how many unique visitors completed steps 1..N in order within the
 *  same session. Each session contributes at most one to each step's count. */
export function analyzeFunnel(options: {
  appId: string;
  steps: FunnelStep[];
  startTime?: number;
  endTime?: number;
}): FunnelAnalysis {
  if (options.steps.length === 0) return { steps: [], counts: [] };

  const clauses: string[] = ['app_id = @appId'];
  const params: Record<string, unknown> = { appId: options.appId };
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }
  // Optimization: only pull events whose type can possibly match any step
  const types = Array.from(new Set(options.steps.map(s => s.kind === 'page' ? 'pageview' : 'click')));
  clauses.push(`type IN (${types.map(t => `'${t}'`).join(',')})`);

  const where = `WHERE ${clauses.join(' AND ')}`;
  const rows = db.prepare(`
    SELECT session_id, type, page_path, payload, timestamp
    FROM events ${where}
    ORDER BY session_id ASC, timestamp ASC
  `).all(params) as Array<{ session_id: string; type: string; page_path: string; payload: string | null; timestamp: number }>;

  // Per-session: how far did this session progress through the funnel?
  // furthestStep[session] = max index reached (0..N, 0 means none).
  const reached: number[] = new Array(options.steps.length).fill(0);
  let currentSession: string | null = null;
  let stepIdx = 0;

  function flushSession() {
    if (stepIdx > 0) {
      for (let i = 0; i < stepIdx; i++) reached[i]++;
    }
  }

  for (const row of rows) {
    if (row.session_id !== currentSession) {
      flushSession();
      currentSession = row.session_id;
      stepIdx = 0;
    }
    if (stepIdx < options.steps.length && matchStep(row, options.steps[stepIdx])) {
      stepIdx++;
    }
  }
  flushSession();

  return { steps: options.steps, counts: reached };
}

/** Suggest 1-3 high-value funnels automatically using the journeys data. */
export function getSuggestedFunnels(options: {
  appId: string;
  startTime?: number;
  endTime?: number;
}): Array<{ name: string; steps: FunnelStep[]; counts: number[] }> {
  // Use top journey pairs as seeds: A→B with high count.
  const journeys = getJourneys({
    appId: options.appId,
    startTime: options.startTime,
    endTime: options.endTime,
    limit: 30,
  });

  if (journeys.length === 0) return [];

  const suggestions: Array<{ name: string; steps: FunnelStep[]; counts: number[] }> = [];
  const usedTargets = new Set<string>();

  // For each top journey pair, try to extend it: A→B, then B→? from the same pool.
  for (const j of journeys.slice(0, 8)) {
    if (usedTargets.has(j.source_path + '::' + j.target_path)) continue;

    const steps: FunnelStep[] = [
      { kind: 'page', path: j.source_path },
      { kind: 'page', path: j.target_path },
    ];

    // Look for extension B→C
    const ext = journeys.find(k => k.source_path === j.target_path && k.target_path !== j.source_path);
    if (ext) {
      steps.push({ kind: 'page', path: ext.target_path });
      usedTargets.add(j.target_path + '::' + ext.target_path);
    }

    const analysis = analyzeFunnel({
      appId: options.appId,
      steps,
      startTime: options.startTime,
      endTime: options.endTime,
    });

    // Drop suggestions that are too thin (< 2 sessions reach the last step)
    if (analysis.counts[analysis.counts.length - 1] < 2) continue;

    const shortName = (p: string) => {
      for (const m of ['?view=', '#view=']) {
        const idx = p.indexOf(m);
        if (idx >= 0) {
          try { return decodeURIComponent(p.slice(idx + m.length)); } catch { /* fall through */ }
        }
      }
      return p.length > 30 ? p.slice(0, 28) + '…' : p;
    };
    const name = steps.map(s => s.kind === 'page' ? shortName(s.path) : `点击 ${s.dataTrack}`).join(' → ');

    suggestions.push({ name, steps, counts: analysis.counts });
    usedTargets.add(j.source_path + '::' + j.target_path);
    if (suggestions.length >= 3) break;
  }

  return suggestions;
}

// ===== Diagnostics =====

export interface DiagnosticsDTO {
  /** Elements that get clicked but rarely lead to anything (no pageview / form submit within 30s). */
  deadButtons: Array<{ key: string; label: string; clicks: number; deadRatio: number }>;
  /** Pages users bounce off within 5 seconds. */
  highBouncePages: Array<{ path: string; visits: number; bounces: number; bounceRatio: number }>;
  /** Form submits that never led to a navigation — the form probably failed. */
  formFailures: Array<{ formId: string | null; fieldHint: string | null; submits: number; failures: number }>;
  /** Rage clicks: same session, same element, 3+ clicks within 3 seconds. */
  rageClicks: Array<{ key: string; label: string; incidents: number; sessions: number }>;
}

const DEAD_WINDOW_MS = 30_000;
const BOUNCE_WINDOW_MS = 5_000;
const RAGE_WINDOW_MS = 3_000;
const RAGE_MIN_CLICKS = 3;

export function getDiagnostics(options: {
  appId: string;
  startTime?: number;
  endTime?: number;
}): DiagnosticsDTO {
  const clauses: string[] = ['app_id = @appId'];
  const params: Record<string, unknown> = { appId: options.appId };
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }
  const where = `WHERE ${clauses.join(' AND ')}`;

  const events = db.prepare(`
    SELECT id, type, session_id, timestamp, page_path, payload
    FROM events ${where}
    ORDER BY session_id ASC, timestamp ASC
  `).all(params) as Array<{ id: string; type: string; session_id: string; timestamp: number; page_path: string; payload: string | null }>;

  const aliasMap = getAliasMap(options.appId);

  const clickStats = new Map<string, { clicks: number; dead: number; sample: string | null }>();
  const rageStats = new Map<string, { incidents: number; sessions: Set<string> }>();
  const formFails = new Map<string, { submits: number; failures: number; field: string | null }>();

  const sessionGroups = new Map<string, typeof events>();
  for (const e of events) {
    let arr = sessionGroups.get(e.session_id);
    if (!arr) { arr = []; sessionGroups.set(e.session_id, arr); }
    arr.push(e);
  }

  for (const [sessionId, list] of sessionGroups) {
    const recentClicks = new Map<string, number[]>();
    const rageCounted = new Set<string>();

    for (let i = 0; i < list.length; i++) {
      const e = list[i];

      if (e.type === 'click' && e.payload) {
        let p: { dataTrack?: string; text?: string };
        try { p = JSON.parse(e.payload) as { dataTrack?: string; text?: string }; } catch { continue; }
        const key = p.dataTrack;
        if (!key) continue;

        // Dead button check: look forward up to DEAD_WINDOW_MS for a pageview or form submit
        let dead = true;
        for (let j = i + 1; j < list.length; j++) {
          const next = list[j];
          if (next.timestamp - e.timestamp > DEAD_WINDOW_MS) break;
          if (next.type === 'pageview') { dead = false; break; }
          if (next.type === 'form_interaction') {
            try {
              const np = JSON.parse(next.payload ?? '{}') as { action?: string };
              if (np.action === 'submit') { dead = false; break; }
            } catch { /* ignore */ }
          }
        }
        let stat = clickStats.get(key);
        if (!stat) { stat = { clicks: 0, dead: 0, sample: null }; clickStats.set(key, stat); }
        stat.clicks++;
        if (dead) stat.dead++;
        if (!stat.sample && p.text) stat.sample = p.text;

        // Rage click detection
        let recent = recentClicks.get(key);
        if (!recent) { recent = []; recentClicks.set(key, recent); }
        recent.push(e.timestamp);
        while (recent.length && e.timestamp - recent[0] > RAGE_WINDOW_MS) recent.shift();
        if (recent.length >= RAGE_MIN_CLICKS && !rageCounted.has(key)) {
          rageCounted.add(key);
          let r = rageStats.get(key);
          if (!r) { r = { incidents: 0, sessions: new Set() }; rageStats.set(key, r); }
          r.incidents++;
          r.sessions.add(sessionId);
        }
      } else if (e.type === 'form_interaction' && e.payload) {
        let p: { action?: string; formId?: string; fieldName?: string };
        try { p = JSON.parse(e.payload) as typeof p; } catch { continue; }
        if (p.action !== 'submit') continue;
        let failed = true;
        for (let j = i + 1; j < list.length; j++) {
          const next = list[j];
          if (next.timestamp - e.timestamp > DEAD_WINDOW_MS) break;
          if (next.type === 'pageview') { failed = false; break; }
        }
        const fkey = p.formId ?? '(no-form-id)';
        let s = formFails.get(fkey);
        if (!s) { s = { submits: 0, failures: 0, field: null }; formFails.set(fkey, s); }
        s.submits++;
        if (failed) s.failures++;
        if (!s.field && p.fieldName) s.field = p.fieldName;
      }
    }
  }

  // High-bounce pages: pageview with dwell < 5s AND it's the last pageview in the session
  const bounceStats = new Map<string, { visits: number; bounces: number }>();
  for (const list of sessionGroups.values()) {
    const pvs = list.filter(e => e.type === 'pageview');
    for (let i = 0; i < pvs.length; i++) {
      const cur = pvs[i];
      const nextPv = pvs[i + 1];
      const boundaryT = nextPv ? nextPv.timestamp : list[list.length - 1].timestamp;
      const dwell = boundaryT - cur.timestamp;
      let stat = bounceStats.get(cur.page_path);
      if (!stat) { stat = { visits: 0, bounces: 0 }; bounceStats.set(cur.page_path, stat); }
      stat.visits++;
      if (dwell < BOUNCE_WINDOW_MS && !nextPv) stat.bounces++;
    }
  }

  const deadButtons = Array.from(clickStats.entries())
    .filter(([, s]) => s.dead >= 2 && s.dead / s.clicks >= 0.5)
    .map(([key, s]) => ({
      key,
      label: aliasMap.get(key) ?? s.sample ?? key,
      clicks: s.clicks,
      deadRatio: s.dead / s.clicks,
    }))
    .sort((a, b) => b.deadRatio * b.clicks - a.deadRatio * a.clicks)
    .slice(0, 20);

  const highBouncePages = Array.from(bounceStats.entries())
    .filter(([, s]) => s.visits >= 3 && s.bounces / s.visits >= 0.5)
    .map(([path, s]) => ({
      path,
      visits: s.visits,
      bounces: s.bounces,
      bounceRatio: s.bounces / s.visits,
    }))
    .sort((a, b) => b.bounces - a.bounces)
    .slice(0, 20);

  const formFailures = Array.from(formFails.entries())
    .filter(([, s]) => s.failures >= 2)
    .map(([formId, s]) => ({
      formId: formId === '(no-form-id)' ? null : formId,
      fieldHint: s.field,
      submits: s.submits,
      failures: s.failures,
    }))
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 20);

  const rageClicks = Array.from(rageStats.entries())
    .map(([key, s]) => {
      const click = clickStats.get(key);
      return {
        key,
        label: aliasMap.get(key) ?? click?.sample ?? key,
        incidents: s.incidents,
        sessions: s.sessions.size,
      };
    })
    .sort((a, b) => b.incidents - a.incidents)
    .slice(0, 20);

  return { deadButtons, highBouncePages, formFailures, rageClicks };
}

// ===== User Segments =====

export interface SegmentCondition {
  op: 'visited' | 'not_visited' | 'clicked' | 'not_clicked';
  value: string;
}

export interface SegmentPreview {
  matchingVisitors: number;
  totalVisitors: number;
  sampleVisitorIds: string[];
}

export function previewSegment(options: {
  appId: string;
  conditions: SegmentCondition[];
  startTime?: number;
  endTime?: number;
}): SegmentPreview {
  const clauses: string[] = ['app_id = @appId'];
  const params: Record<string, unknown> = { appId: options.appId };
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }
  const where = `WHERE ${clauses.join(' AND ')}`;

  const rows = db.prepare(`
    SELECT COALESCE(user_id, visitor_id) as vid, type, page_path, payload
    FROM events ${where}
  `).all(params) as Array<{ vid: string | null; type: string; page_path: string; payload: string | null }>;

  type VisitorState = { pages: Set<string>; clicks: Set<string> };
  const visitorMap = new Map<string, VisitorState>();
  for (const r of rows) {
    if (!r.vid) continue;
    let st = visitorMap.get(r.vid);
    if (!st) { st = { pages: new Set(), clicks: new Set() }; visitorMap.set(r.vid, st); }
    if (r.type === 'pageview') st.pages.add(unifyViewKey(r.page_path));
    else if (r.type === 'click' && r.payload) {
      try {
        const p = JSON.parse(r.payload) as { dataTrack?: string };
        if (p.dataTrack) st.clicks.add(p.dataTrack);
      } catch { /* ignore */ }
    }
  }

  const matching: string[] = [];
  for (const [vid, st] of visitorMap) {
    let pass = true;
    for (const c of options.conditions) {
      if (!c.value) continue;
      const cv = (c.op === 'visited' || c.op === 'not_visited') ? unifyViewKey(c.value) : c.value;
      if (c.op === 'visited' && !st.pages.has(cv)) { pass = false; break; }
      if (c.op === 'not_visited' && st.pages.has(cv)) { pass = false; break; }
      if (c.op === 'clicked' && !st.clicks.has(cv)) { pass = false; break; }
      if (c.op === 'not_clicked' && st.clicks.has(cv)) { pass = false; break; }
    }
    if (pass) matching.push(vid);
  }

  return {
    matchingVisitors: matching.length,
    totalVisitors: visitorMap.size,
    sampleVisitorIds: matching.slice(0, 20),
  };
}

/** Find URLs where users click a lot but the SDK never inferred a viewLabel.
 *  These are pages where the business owner likely needs to call setView()
 *  manually (e.g. multi-tab SPAs the heuristics don't recognise).
 *
 *  Returns nothing for pages whose page_path already contains a view marker. */
export function getUnidentifiedViews(options: {
  appId: string;
  startTime?: number;
  endTime?: number;
  minClicks?: number;
  limit?: number;
}): Array<{ pagePath: string; clicks: number; pageTitle: string | null }> {
  const minClicks = options.minClicks ?? 5;
  const limit = options.limit ?? 20;

  const clauses = [`app_id = @appId`, `type = 'click'`,
    `page_path NOT LIKE '%?view=%'`, `page_path NOT LIKE '%#view=%'`];
  const params: Record<string, unknown> = { appId: options.appId, minClicks, limit };
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }

  return db.prepare(`
    SELECT page_path AS pagePath, COUNT(*) AS clicks,
           (SELECT page_title FROM events e2 WHERE e2.app_id = @appId AND e2.page_path = e1.page_path AND e2.page_title IS NOT NULL LIMIT 1) AS pageTitle
    FROM events e1
    WHERE ${clauses.join(' AND ')}
    GROUP BY page_path
    HAVING COUNT(*) >= @minClicks
    ORDER BY clicks DESC
    LIMIT @limit
  `).all(params) as Array<{ pagePath: string; clicks: number; pageTitle: string | null }>;
}

/** List all known appId values with their latest event timestamp.
 *  Used by the dashboard FilterBar to populate the App ID picker. */
export function getApps(): Array<{ appId: string; eventCount: number; lastEventAt: number }> {
  return db.prepare(`
    SELECT app_id AS appId, COUNT(*) AS eventCount, MAX(timestamp) AS lastEventAt
    FROM events
    WHERE app_id IS NOT NULL AND app_id != ''
    GROUP BY app_id
    ORDER BY lastEventAt DESC
  `).all() as Array<{ appId: string; eventCount: number; lastEventAt: number }>;
}

/** Per-visitor session counts — full aggregation in DB so we don't sample
 *  chains in the frontend. Used by AudiencePage to compute repeat rate and
 *  heavy-visitor count accurately regardless of total volume. */
export interface VisitorStatsDTO {
  total: number;
  /** visitors with ≥ 2 sessions */
  returning: number;
  /** visitors with ≥ 5 sessions */
  heavy: number;
  /** top 10 visitors by session count */
  top: Array<{ visitorId: string; sessionCount: number; lastSeen: number }>;
}

export function getVisitorStats(options: {
  appId: string;
  startTime?: number;
  endTime?: number;
}): VisitorStatsDTO {
  const clauses: string[] = ['app_id = @appId'];
  const params: Record<string, unknown> = { appId: options.appId };
  if (options.startTime) { clauses.push('timestamp >= @startTime'); params.startTime = options.startTime; }
  if (options.endTime) { clauses.push('timestamp <= @endTime'); params.endTime = options.endTime; }
  const where = clauses.join(' AND ');

  const rows = db.prepare(`
    SELECT COALESCE(user_id, visitor_id) AS vid,
           COUNT(DISTINCT session_id) AS sessionCount,
           MAX(timestamp) AS lastSeen
    FROM events
    WHERE ${where} AND COALESCE(user_id, visitor_id) IS NOT NULL
    GROUP BY vid
    ORDER BY sessionCount DESC
    LIMIT 100
  `).all(params) as Array<{ vid: string; sessionCount: number; lastSeen: number }>;

  // Total visitor count needs its own query (LIMIT 100 above truncates).
  const totalRow = db.prepare(`
    SELECT COUNT(DISTINCT COALESCE(user_id, visitor_id)) AS n
    FROM events
    WHERE ${where} AND COALESCE(user_id, visitor_id) IS NOT NULL
  `).get(params) as { n: number };

  // For "returning" / "heavy" we need full distribution, not the top 100.
  // Run a second aggregate that counts each bucket directly.
  const dist = db.prepare(`
    WITH v AS (
      SELECT COALESCE(user_id, visitor_id) AS vid,
             COUNT(DISTINCT session_id) AS sc
      FROM events
      WHERE ${where} AND COALESCE(user_id, visitor_id) IS NOT NULL
      GROUP BY vid
    )
    SELECT
      SUM(CASE WHEN sc >= 2 THEN 1 ELSE 0 END) AS returning_count,
      SUM(CASE WHEN sc >= 5 THEN 1 ELSE 0 END) AS heavy_count
    FROM v
  `).get(params) as { returning_count: number | null; heavy_count: number | null };

  return {
    total: totalRow.n ?? 0,
    returning: dist.returning_count ?? 0,
    heavy: dist.heavy_count ?? 0,
    top: rows.slice(0, 10).map(r => ({
      visitorId: r.vid,
      sessionCount: r.sessionCount,
      lastSeen: r.lastSeen,
    })),
  };
}
