import { z } from 'zod';

// ===== schemas — single source of truth =====
export const schemas = {
  pageview: z.object({
    trigger: z.enum(['init', 'pushState', 'replaceState', 'popstate', 'hashchange', 'viewchange']),
  }),
  click: z.object({
    tagName: z.string(),
    text: z.string().max(100).optional(),
    id: z.string().optional(),
    className: z.string().optional(),
    href: z.string().optional(),
    dataTrack: z.string().optional(),
  }),
  impression: z.object({
    tagName: z.string(),
    text: z.string().max(100).optional(),
    id: z.string().optional(),
    className: z.string().optional(),
    dataTrack: z.string().optional(),
    visibleRatio: z.number().min(0).max(1),
    visibleTime: z.number().nonnegative(),
  }),
  form_interaction: z.object({
    action: z.enum(['focus', 'change', 'submit']),
    formId: z.string().optional(),
    formAction: z.string().optional(),
    fieldName: z.string().optional(),
    fieldType: z.string().optional(),
    fieldId: z.string().optional(),
  }),
  dwell: z.object({
    level: z.enum(['page', 'element']),
    path: z.string(),
    dataTrack: z.string().optional(),
    duration: z.number().nonnegative(),
    heartbeat: z.boolean().optional(),
  }),
  custom: z.record(z.unknown()),
} as const;

// ===== derived types — zero duplication =====
export type EventType = keyof typeof schemas;
export type PayloadOf<T extends EventType> = z.infer<typeof schemas[T]>;

// ===== context schemas =====
export const TrackEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  schemaVersion: z.number(),
  timestamp: z.number(),
  sessionId: z.string(),
  appId: z.string(),
  userId: z.string().optional(),
  visitorId: z.string().optional(),
  isNewVisitor: z.boolean().optional(),
  device: z.object({
    userAgent: z.string(),
    screen: z.string(),
    language: z.string(),
  }),
  page: z.object({
    path: z.string(),
    search: z.string(),
    hash: z.string(),
    title: z.string(),
  }),
  source: z.object({
    type: z.enum(['internal', 'external', 'direct']),
    path: z.string().optional(),
    search: z.string().optional(),
    title: z.string().optional(),
    referrerUrl: z.string().optional(),
    chainIndex: z.number().optional(),
  }),
  payload: z.record(z.unknown()).optional(),
});

export const TrackBatchSchema = z.object({
  appId: z.string(),
  sessionId: z.string(),
  userId: z.string().optional(),
  events: z.array(TrackEventSchema),
  chain: z.object({
    sessionId: z.string(),
    entries: z.array(z.object({
      path: z.string(),
      search: z.string(),
      hash: z.string(),
      title: z.string(),
      enteredAt: z.number(),
    })),
  }),
});

// ===== derived TS types =====
export type TrackEvent = z.infer<typeof TrackEventSchema>;
export type TrackBatch = z.infer<typeof TrackBatchSchema>;
export type TrackerConfig = {
  endpoint: string;
  appId: string;
  userId?: string | (() => string);
  batchInterval?: number;
  batchSize?: number;
  maxQueueSize?: number;
  maxRetries?: number;
  validate?: boolean;
  debug?: boolean;
  impressionThreshold?: number;
  impressionDebounce?: number;
  dwellInterval?: number;
  crossDomainToken?: string;
  trackableSelector?: string;
};

// ===== collector interface =====
export const MAX_CHAIN_LENGTH = 50;

export type CollectorInit = (tracker: TrackerCore) => (() => void) | void;

export interface TrackerCore {
  config: TrackerConfig;
  emit<T extends EventType>(type: T, payload: PayloadOf<T>): void;
  getSource(): TrackEvent['source'];
  getChain(): TrackBatch['chain'];
  getPageInfo(): { path: string; search: string; hash: string; title: string };
  getDeviceInfo(): { userAgent: string; screen: string; language: string };
  setUserId(userId: string): void;
  setView(label: string | null): void;
  inferView(): void;
  handleRouteChange(trigger: string): void;
}

// ===== type aliases for backward compat =====
export type SourceInfo = TrackEvent['source'];
export type DeviceInfo = TrackEvent['device'];
export type PageInfo = TrackEvent['page'];
export type ChainEntry = TrackBatch['chain']['entries'][number];
export type NavigationChain = TrackBatch['chain'];

// runtime lookup — validate payload in emit()
export function getSchema(type: string) {
  return schemas[type as EventType];
}
