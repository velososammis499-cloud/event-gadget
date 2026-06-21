import type { PagesRequest, EventsRequest, JourneysRequest, ChainsRequest, OverviewRequest, RankingsRequest, UnidentifiedViewsRequest, VisitorStatsRequest } from './types';
import { normalizeQueryParams } from './normalize-params';

/**
 * Query key definitions.
 * .all → domain-scoped invalidation
 * .list → exact match with normalized params
 */
export const queryKeys = {
  pages: {
    all: ['pages'] as const,
    list: (params: PagesRequest) => ['pages', 'list', normalizeQueryParams(params)] as const,
  },
  events: {
    all: ['events'] as const,
    list: (params: EventsRequest) => ['events', 'list', normalizeQueryParams(params)] as const,
  },
  journeys: {
    all: ['journeys'] as const,
    list: (params: JourneysRequest) => ['journeys', 'list', normalizeQueryParams(params)] as const,
  },
  chains: {
    all: ['chains'] as const,
    list: (params: ChainsRequest) => ['chains', 'list', normalizeQueryParams(params)] as const,
  },
  overview: {
    all: ['overview'] as const,
    one: (params: OverviewRequest) => ['overview', 'one', normalizeQueryParams(params)] as const,
  },
  funnels: {
    all: ['funnels'] as const,
    list: (appId: string, from?: number, to?: number) => ['funnels', 'list', appId, from ?? null, to ?? null] as const,
    options: (appId: string) => ['funnels', 'options', appId] as const,
    suggested: (appId: string, from?: number, to?: number) => ['funnels', 'suggested', appId, from ?? null, to ?? null] as const,
  },
  rankings: {
    all: ['rankings'] as const,
    list: (params: RankingsRequest) => ['rankings', 'list', normalizeQueryParams(params)] as const,
  },
  labels: {
    all: ['labels'] as const,
    list: (appId: string) => ['labels', 'list', appId] as const,
  },
  diagnostics: {
    all: ['diagnostics'] as const,
    one: (appId: string, from?: number, to?: number) => ['diagnostics', 'one', appId, from ?? null, to ?? null] as const,
  },
  unidentifiedViews: {
    all: ['unidentified-views'] as const,
    list: (params: UnidentifiedViewsRequest) => ['unidentified-views', 'list', normalizeQueryParams(params)] as const,
  },
  apps: {
    all: ['apps'] as const,
  },
  visitorStats: {
    all: ['visitor-stats'] as const,
    list: (params: VisitorStatsRequest) => ['visitor-stats', 'list', normalizeQueryParams(params)] as const,
  },
} as const;
