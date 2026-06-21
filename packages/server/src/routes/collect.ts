import { Router, type Request, type Response } from 'express';
import { insertEvents, upsertChain, type InsertEvent } from '../db/queries';
import { err } from '../db/dto';

interface TrackEvent {
  id: string;
  type: string;
  schemaVersion: number;
  timestamp: number;
  sessionId: string;
  appId: string;
  userId?: string;
  visitorId?: string;
  isNewVisitor?: boolean;
  device?: { userAgent?: string; screen?: string; language?: string };
  page?: { path: string; search?: string; hash?: string; title?: string };
  source?: { type: string; path?: string; search?: string; title?: string; referrerUrl?: string; chainIndex?: number };
  payload?: Record<string, unknown>;
}

interface TrackBatch {
  appId: string;
  sessionId: string;
  userId?: string;
  events: TrackEvent[];
  chain?: { sessionId: string; entries: Array<{ path: string; search: string; hash: string; title: string; enteredAt: number }> };
}

/** Lightweight per-event validation. Returns an error string when the event is
 *  unsafe to insert, or null when it can proceed. We deliberately do NOT use
 *  zod here to avoid taking a dependency just for shape-checking 6 fields. */
function validateEvent(e: unknown, batchAppId: string): string | null {
  if (!e || typeof e !== 'object') return 'event is not an object';
  const o = e as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) return 'id missing';
  if (typeof o.type !== 'string' || !o.type) return 'type missing';
  if (typeof o.timestamp !== 'number' || !Number.isFinite(o.timestamp)) return 'timestamp invalid';
  if (typeof o.sessionId !== 'string' || !o.sessionId) return 'sessionId missing';
  if (typeof o.appId !== 'string' || !o.appId) return 'appId missing';
  // Cross-batch shield: event.appId must equal batch.appId.
  if (o.appId !== batchAppId) return `cross-app event (event.appId=${o.appId}, batch.appId=${batchAppId})`;
  return null;
}

interface CanonicalEvent {
  type: string;
  schemaVersion: number;
  payload?: Record<string, unknown>;
}

const CURRENT_EVENT_SCHEMA_VERSION = 2;

function normalizeEvent(e: TrackEvent): CanonicalEvent {
  const version = e.schemaVersion ?? 1;

  switch (version) {
    case 1:
      return normalizeV1(e);
    case 2:
      return normalizeV2(e);
    default:
      return fallbackNormalize(e);
  }
}

function normalizeV1(e: TrackEvent): CanonicalEvent {
  return { type: e.type, schemaVersion: 1, payload: e.payload };
}

function normalizeV2(e: TrackEvent): CanonicalEvent {
  return { type: e.type, schemaVersion: 2, payload: e.payload };
}

function fallbackNormalize(e: TrackEvent): CanonicalEvent {
  return { type: e.type, schemaVersion: e.schemaVersion ?? 1, payload: e.payload };
}

const router = Router();

router.post('/', (req: Request, res: Response): void => {
  const batch: TrackBatch = req.body;

  if (!batch?.events?.length) {
    res.status(400).json(err('EMPTY_BATCH', 'Empty batch'));
    return;
  }

  if (!batch.appId) {
    res.status(400).json(err('MISSING_APP_ID', 'Missing appId'));
    return;
  }

  // Validate each event; drop the bad ones, keep the good ones. This prevents
  // a single malformed event from triggering a NOT NULL constraint that
  // rolls back the whole transaction and 500s the request — which would put
  // the SDK into an infinite retry loop on the same bad batch.
  const dropped: Array<{ id: unknown; reason: string }> = [];
  const cleanRaw: TrackEvent[] = [];
  for (const e of batch.events) {
    const reason = validateEvent(e, batch.appId);
    if (reason) {
      dropped.push({ id: (e as { id?: unknown })?.id, reason });
    } else {
      cleanRaw.push(e);
    }
  }
  if (dropped.length > 0) {
    console.warn(`[Event Gadget] dropped ${dropped.length} invalid events:`, dropped.slice(0, 5));
  }
  if (cleanRaw.length === 0) {
    // Nothing valid — return 200 (not 500) so SDK retry doesn't loop forever.
    res.json({ ok: true, received: 0, dropped: dropped.length });
    return;
  }

  const events: InsertEvent[] = cleanRaw.map((e: TrackEvent) => ({
    id: e.id,
    type: e.type,
    schema_version: e.schemaVersion ?? 1,
    timestamp: e.timestamp,
    session_id: e.sessionId,
    app_id: e.appId,
    user_id: e.userId,
    visitor_id: e.visitorId,
    is_new_visitor: typeof e.isNewVisitor === 'boolean' ? (e.isNewVisitor ? 1 : 0) : undefined,
    device_user_agent: e.device?.userAgent,
    device_screen: e.device?.screen,
    device_language: e.device?.language,
    page_path: e.page?.path ?? '/',
    page_search: e.page?.search,
    page_hash: e.page?.hash,
    page_title: e.page?.title,
    source_type: e.source?.type ?? 'direct',
    source_path: e.source?.path,
    source_search: e.source?.search,
    source_title: e.source?.title,
    source_referrer_url: e.source?.referrerUrl,
    source_chain_index: e.source?.chainIndex,
    payload: e.payload ? JSON.stringify(e.payload) : undefined,
  }));

  try {
    insertEvents(events);

    if (batch.chain) {
      upsertChain({
        session_id: batch.chain.sessionId,
        app_id: batch.appId,
        user_id: batch.userId,
        entries: JSON.stringify(batch.chain.entries),
        updated_at: Math.floor(Date.now() / 1000),
      });
    }

    res.json({ ok: true, received: events.length, dropped: dropped.length });
  } catch (errRaw) {
    console.error('[Event Gadget] collect error:', errRaw);
    res.status(500).json(err('INTERNAL_ERROR', 'Internal error'));
  }
});

export default router;
