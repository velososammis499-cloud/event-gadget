/**
 * Server-side DTO mapping layer.
 * Transforms DB rows (snake_case) to transport DTOs (camelCase).
 * Frontend must never see raw DB column names or payload JSON strings.
 */

import type { InsertEvent } from './queries';

// ===== Event DTO =====

export interface EventDTO {
  id: string;
  type: string;
  timestamp: number;
  sessionId: string;
  appId: string;
  userId: string | null;
  pagePath: string;
  pageTitle: string | null;
  sourceType: string;
  sourcePath: string | null;
  label: string | null;
  interactionType: string | null;
}

function extractLabel(row: InsertEvent, aliasMap?: Map<string, string>): string | null {
  const payload = row.payload;
  if (!payload) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (typeof parsed.dataTrack === 'string' && parsed.dataTrack) {
    const alias = aliasMap?.get(parsed.dataTrack);
    return alias ?? parsed.dataTrack;
  }
  if (typeof parsed.text === 'string' && parsed.text) {
    const tag = typeof parsed.tagName === 'string' ? parsed.tagName : '';
    return `${tag}: ${parsed.text.slice(0, 50)}`.trim();
  }
  if (typeof parsed.id === 'string' && parsed.id) {
    const tag = typeof parsed.tagName === 'string' ? parsed.tagName : '';
    return `${tag}#${parsed.id}`;
  }
  return null;
}

function extractInteractionType(row: InsertEvent): string | null {
  const payload = row.payload;
  if (!payload) return null;

  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (typeof parsed.trigger === 'string') return parsed.trigger;
    if (typeof parsed.action === 'string') return parsed.action;
    if (typeof parsed.level === 'string') return parsed.level;
  } catch {
    // ignore
  }
  return null;
}

export function toEventDTO(row: InsertEvent, aliasMap?: Map<string, string>): EventDTO {
  return {
    id: row.id,
    type: row.type,
    timestamp: row.timestamp,
    sessionId: row.session_id,
    appId: row.app_id,
    userId: row.user_id ?? null,
    pagePath: row.page_path,
    pageTitle: row.page_title ?? null,
    sourceType: row.source_type,
    sourcePath: row.source_path ?? null,
    label: extractLabel(row, aliasMap),
    interactionType: extractInteractionType(row),
  };
}

// ===== Page Stats DTO =====

export interface PageStatsDTO {
  pagePath: string;
  pageTitle: string;
  views: number;
  uniqueSessions: number;
  uniqueUsers: number;
}

export function toPageStatsDTO(row: { page_path: string; page_title: string; views: number; unique_sessions: number; unique_users: number }): PageStatsDTO {
  return {
    pagePath: row.page_path,
    pageTitle: row.page_title,
    views: row.views,
    uniqueSessions: row.unique_sessions,
    uniqueUsers: row.unique_users,
  };
}

// ===== Journey DTO =====

export interface JourneyDTO {
  sourcePath: string;
  targetPath: string;
  count: number;
}

export function toJourneyDTO(row: { source_path: string; target_path: string; count: number }): JourneyDTO {
  return {
    sourcePath: row.source_path,
    targetPath: row.target_path,
    count: row.count,
  };
}

// ===== Chain DTO =====

export interface ChainEntryDTO {
  path: string;
  search: string | null;
  hash: string | null;
  title: string | null;
  enteredAt: number;
}

export interface ChainDTO {
  sessionId: string;
  appId: string;
  userId: string | null;
  entries: ChainEntryDTO[];
  truncated?: boolean;
  updatedAt: number;
}

const MAX_CHAIN_ENTRIES = 100;

interface ChainRow {
  session_id: string;
  app_id: string;
  user_id: string | null;
  entries: string;
  updated_at: number;
}

export function toChainDTO(row: ChainRow): ChainDTO {
  let entries: ChainEntryDTO[] = [];
  let truncated = false;

  try {
    const raw = JSON.parse(row.entries) as Array<{ path: string; search?: string; hash?: string; title?: string; enteredAt: number }>;
    if (raw.length > MAX_CHAIN_ENTRIES) {
      truncated = true;
      entries = raw.slice(0, MAX_CHAIN_ENTRIES).map(toChainEntryDTO);
    } else {
      entries = raw.map(toChainEntryDTO);
    }
  } catch {
    // corrupted entries — return empty
  }

  return {
    sessionId: row.session_id,
    appId: row.app_id,
    userId: row.user_id,
    entries,
    truncated: truncated || undefined,
    updatedAt: row.updated_at * 1000, // DB stores unix seconds → convert to ms
  };
}

function toChainEntryDTO(entry: { path: string; search?: string; hash?: string; title?: string; enteredAt: number }): ChainEntryDTO {
  return {
    path: entry.path,
    search: entry.search ?? null,
    hash: entry.hash ?? null,
    title: entry.title ?? null,
    enteredAt: entry.enteredAt,
  };
}

// ===== API Envelope =====

export function ok<T>(data: T) {
  return { ok: true as const, data };
}

export function err(code: string, message: string, details?: unknown) {
  return { ok: false as const, code, message, details };
}
