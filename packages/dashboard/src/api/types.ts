/**
 * API type contracts for Event Gadget Dashboard.
 *
 * These types define the **transport layer** between server and dashboard.
 * They are NOT database schema — server is responsible for mapping
 * internal storage to these DTOs. Frontend must never depend on
 * DB column names or raw payload formats.
 */

// ===== Shared =====

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: {
    /** unix ms — when the server generated this response */
    generatedAt?: number;
    /** server-assigned request ID for tracing */
    requestId?: string;
  };
}

export interface ApiError {
  ok: false;
  /** Stable machine-readable code for frontend branching (e.g. 'NOT_FOUND', 'INVALID_PARAMS') */
  code: string;
  /** Human-readable description */
  message: string;
  /** Optional structured details (validation errors, etc.) */
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type { QueryParamValue } from './client';

// ===== Shared =====

export type RankingType = 'click' | 'impression';

import type { QueryParamValue } from './client';

/** All known event types from the tracker SDK */
export type EventType =
  | 'pageview'
  | 'click'
  | 'impression'
  | 'form_interaction'
  | 'dwell'
  | 'custom';

export type InteractionType =
  | 'focus'
  | 'change'
  | 'submit'
  | 'init'
  | 'pushState'
  | 'replaceState'
  | 'popstate';

// ===== GET /api/pages =====

export interface PagesRequest {
  [key: string]: QueryParamValue;
  appId?: string;
  /** unix ms */
  startTime?: number;
  /** unix ms */
  endTime?: number;
}

export interface PageStatsDTO {
  pagePath: string;
  pageTitle: string;
  views: number;
  uniqueSessions: number;
  uniqueUsers: number;
}

// ===== GET /api/events =====

export interface EventsRequest {
  [key: string]: QueryParamValue;
  appId?: string;
  pagePath?: string;
  pathMatch?: 'contains' | 'prefix' | 'exact';
  sessionId?: string;
  userId?: string;
  type?: EventType;
  limit?: number;
  offset?: number;
  /** unix ms */
  startTime?: number;
  /** unix ms */
  endTime?: number;
}

/** Normalized event DTO — no raw payload, no snake_case */
export interface EventDTO {
  id: string;
  type: EventType;
  /** unix ms */
  timestamp: number;
  sessionId: string;
  appId: string;
  userId: string | null;
  pagePath: string;
  pageTitle: string | null;
  sourceType: string;
  sourcePath: string | null;
  /** Normalized display label extracted from payload by server */
  label: string | null;
  /** e.g. 'focus'|'change'|'submit' for form_interaction; 'init'|'pushState'|'replaceState'|'popstate' for pageview */
  interactionType: InteractionType | null;
}

// ===== GET /api/journeys =====

export interface JourneysRequest {
  [key: string]: QueryParamValue;
  appId?: string;
  /** unix ms */
  startTime?: number;
  /** unix ms */
  endTime?: number;
  limit?: number;
}

export interface JourneyDTO {
  sourcePath: string;
  targetPath: string;
  count: number;
}

// ===== GET /api/chains =====

export interface ChainsRequest {
  [key: string]: QueryParamValue;
  appId?: string;
  userId?: string;
  limit?: number;
}

export interface ChainDTO {
  sessionId: string;
  appId: string;
  userId: string | null;
  entries: ChainEntryDTO[];
  /** true if server capped the entries array (defense against pathological sessions) */
  truncated?: boolean;
  /** unix ms */
  updatedAt: number;
}

export interface ChainEntryDTO {
  path: string;
  search: string | null;
  hash: string | null;
  title: string | null;
  /** unix ms */
  enteredAt: number;
}

// ===== GET /api/rankings (Slice B) =====

export interface RankingDTO {
  label: string;
  count: number;
  pagePath: string;
}

// ===== GET /api/overview =====

export interface OverviewRequest {
  [key: string]: QueryParamValue;
  appId?: string;
  /** unix ms */
  from?: number;
  /** unix ms */
  to?: number;
}

export interface OverviewTotalsDTO {
  uniqueVisitors: number;
  uniqueSessions: number;
  pageViews: number;
  /** average session duration in milliseconds */
  avgSessionMs: number;
  newVisitors: number;
  returningVisitors: number;
  /** Visitors whose is_new_visitor flag was NULL — typically older SDK data
   *  or restored sessions where the flag was lost. Counted separately to
   *  avoid silently inflating the returning bucket. */
  unknownVisitors: number;
}

export interface OverviewDTO {
  current: OverviewTotalsDTO;
  /** Same-length prior window. null when from/to not provided. */
  previous: OverviewTotalsDTO | null;
  compareRange: { from: number; to: number } | null;
  trend: Array<{ ts: number; views: number }>;
}

// ===== Funnels =====

export type FunnelStep =
  | { kind: 'page'; path: string }
  | { kind: 'click'; dataTrack: string };

export interface FunnelOptionPage { value: string; count: number; title: string | null }
export interface FunnelOptionClick { value: string; count: number; sampleText: string | null }
export interface FunnelOptionsDTO {
  pages: FunnelOptionPage[];
  clicks: FunnelOptionClick[];
}

export interface FunnelDTO {
  id: string;
  name: string;
  steps: FunnelStep[];
  counts: number[];
  createdAt: number;
  updatedAt: number;
}

export interface SuggestedFunnelDTO {
  name: string;
  steps: FunnelStep[];
  counts: number[];
}

export interface FunnelAnalysisDTO {
  steps: FunnelStep[];
  counts: number[];
}

// ===== Rankings (with CTR) =====

export interface RankingsRequest {
  [key: string]: QueryParamValue;
  appId?: string;
  /** unix ms */
  startTime?: number;
  /** unix ms */
  endTime?: number;
}

export interface RankingItemDTO {
  /** Raw data-track key — stable identifier for editing labels. */
  key: string;
  /** Human-friendly label (alias if set in Labels page, else element text or key). */
  label: string;
  clicks: number;
  impressions: number;
  /** clicks/impressions, null when impressions === 0. */
  ctr: number | null;
}

// ===== Labels =====

export interface LabelDTO {
  rawKey: string;
  alias: string;
  /** unix ms */
  updatedAt: number;
}

// ===== Diagnostics =====

export interface DiagnosticsDTO {
  deadButtons: Array<{ key: string; label: string; clicks: number; deadRatio: number }>;
  highBouncePages: Array<{ path: string; visits: number; bounces: number; bounceRatio: number }>;
  formFailures: Array<{ formId: string | null; fieldHint: string | null; submits: number; failures: number }>;
  rageClicks: Array<{ key: string; label: string; incidents: number; sessions: number }>;
}

// ===== User Segments =====

export type SegmentOp = 'visited' | 'not_visited' | 'clicked' | 'not_clicked';

export interface SegmentCondition {
  op: SegmentOp;
  value: string;
}

export interface SegmentPreviewDTO {
  matchingVisitors: number;
  totalVisitors: number;
  sampleVisitorIds: string[];
}

export interface UnidentifiedViewsRequest {
  [key: string]: QueryParamValue;
  appId?: string;
  from?: number;
  to?: number;
  /** Minimum click count for a URL to be flagged (default 5). */
  minClicks?: number;
  /** Max URLs to return (default 20). */
  limit?: number;
}

export interface UnidentifiedViewItemDTO {
  pagePath: string;
  clicks: number;
  pageTitle: string | null;
}

export interface AppItemDTO {
  appId: string;
  eventCount: number;
  /** unix ms */
  lastEventAt: number;
}

export interface VisitorStatsRequest {
  [key: string]: QueryParamValue;
  appId?: string;
  from?: number;
  to?: number;
}

export interface VisitorStatsDTO {
  total: number;
  /** visitors with ≥ 2 sessions in this window */
  returning: number;
  /** visitors with ≥ 5 sessions in this window */
  heavy: number;
  /** top 10 visitors by session count */
  top: Array<{ visitorId: string; sessionCount: number; lastSeen: number }>;
}
