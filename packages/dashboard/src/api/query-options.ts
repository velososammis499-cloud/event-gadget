import type { UseQueryOptions } from '@tanstack/react-query';
import { apiGet, ApiError } from './client';
import { normalizeQueryParams } from './normalize-params';
import { queryKeys } from './query-keys';
import type { PagesRequest, PageStatsDTO, EventsRequest, EventDTO, PaginatedResponse, JourneysRequest, JourneyDTO, ChainsRequest, ChainDTO, OverviewRequest, OverviewDTO, FunnelDTO, FunnelOptionsDTO, SuggestedFunnelDTO, RankingsRequest, RankingItemDTO, LabelDTO, DiagnosticsDTO, UnidentifiedViewsRequest, UnidentifiedViewItemDTO, AppItemDTO, VisitorStatsRequest, VisitorStatsDTO } from './types';

export const dashboardQueryDefaults = {
  retry: (failureCount: number, error: unknown): boolean => {
    if (error instanceof ApiError && error.code !== 'NETWORK_ERROR') {
      return false;
    }
    return failureCount < 2;
  },
  refetchOnWindowFocus: false,
  staleTime: 5_000,
  /** Poll every 10s while the tab is foreground. React Query's default
   *  refetchIntervalInBackground=false suspends polling when the user
   *  switches tabs/minimizes, so we don't burn the server while no one
   *  is looking. */
  refetchInterval: 10_000,
} as const;

export function pagesQueryOptions(
  params: PagesRequest,
): UseQueryOptions<PageStatsDTO[], ApiError> {
  const normalized = normalizeQueryParams(params);

  return {
    queryKey: queryKeys.pages.list(params),
    queryFn: ({ signal }) =>
      apiGet<PageStatsDTO[]>('/pages', normalized, signal),
    ...dashboardQueryDefaults,
  };
}

export function eventsQueryOptions(
  params: EventsRequest,
): UseQueryOptions<PaginatedResponse<EventDTO>, ApiError> {
  const normalized = normalizeQueryParams(params);

  return {
    queryKey: queryKeys.events.list(params),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<EventDTO>>('/events', normalized, signal),
    placeholderData: (prev) => prev,
    ...dashboardQueryDefaults,
  };
}

export function journeysQueryOptions(
  params: JourneysRequest,
): UseQueryOptions<JourneyDTO[], ApiError> {
  const normalized = normalizeQueryParams(params);

  return {
    queryKey: queryKeys.journeys.list(params),
    queryFn: ({ signal }) =>
      apiGet<JourneyDTO[]>('/journeys', normalized, signal),
    ...dashboardQueryDefaults,
  };
}

export function chainsQueryOptions(
  params: ChainsRequest,
): UseQueryOptions<ChainDTO[], ApiError> {
  const normalized = normalizeQueryParams(params);

  return {
    queryKey: queryKeys.chains.list(params),
    queryFn: ({ signal }) =>
      apiGet<ChainDTO[]>('/chains', normalized, signal),
    ...dashboardQueryDefaults,
  };
}

export function overviewQueryOptions(
  params: OverviewRequest,
): UseQueryOptions<OverviewDTO, ApiError> {
  const normalized = normalizeQueryParams(params);

  return {
    queryKey: queryKeys.overview.one(params),
    queryFn: ({ signal }) =>
      apiGet<OverviewDTO>('/overview', normalized, signal),
    ...dashboardQueryDefaults,
  };
}

export function funnelsListQueryOptions(
  appId: string | undefined,
  from?: number,
  to?: number,
): UseQueryOptions<FunnelDTO[], ApiError> {
  return {
    queryKey: queryKeys.funnels.list(appId ?? '', from, to),
    queryFn: ({ signal }) =>
      apiGet<FunnelDTO[]>('/funnels', { appId, from, to }, signal),
    enabled: Boolean(appId),
    ...dashboardQueryDefaults,
  };
}

export function funnelsOptionsQueryOptions(
  appId: string | undefined,
): UseQueryOptions<FunnelOptionsDTO, ApiError> {
  return {
    queryKey: queryKeys.funnels.options(appId ?? ''),
    queryFn: ({ signal }) =>
      apiGet<FunnelOptionsDTO>('/funnels/options', { appId }, signal),
    enabled: Boolean(appId),
    ...dashboardQueryDefaults,
    refetchInterval: undefined, // options change rarely; no need to poll
  };
}

export function funnelsSuggestedQueryOptions(
  appId: string | undefined,
  from?: number,
  to?: number,
): UseQueryOptions<SuggestedFunnelDTO[], ApiError> {
  return {
    queryKey: queryKeys.funnels.suggested(appId ?? '', from, to),
    queryFn: ({ signal }) =>
      apiGet<SuggestedFunnelDTO[]>('/funnels/suggested', { appId, from, to }, signal),
    enabled: Boolean(appId),
    ...dashboardQueryDefaults,
  };
}

export function rankingsQueryOptions(
  params: RankingsRequest,
): UseQueryOptions<RankingItemDTO[], ApiError> {
  const normalized = normalizeQueryParams(params);
  return {
    queryKey: queryKeys.rankings.list(params),
    queryFn: ({ signal }) => apiGet<RankingItemDTO[]>('/rankings', normalized, signal),
    enabled: Boolean(params.appId),
    ...dashboardQueryDefaults,
  };
}

export function labelsQueryOptions(
  appId: string | undefined,
): UseQueryOptions<LabelDTO[], ApiError> {
  return {
    queryKey: queryKeys.labels.list(appId ?? ''),
    queryFn: ({ signal }) => apiGet<LabelDTO[]>('/labels', { appId }, signal),
    enabled: Boolean(appId),
    ...dashboardQueryDefaults,
    refetchInterval: undefined, // labels change manually, no need to poll
  };
}

export function diagnosticsQueryOptions(
  appId: string | undefined,
  from?: number,
  to?: number,
): UseQueryOptions<DiagnosticsDTO, ApiError> {
  return {
    queryKey: queryKeys.diagnostics.one(appId ?? '', from, to),
    queryFn: ({ signal }) => apiGet<DiagnosticsDTO>('/diagnostics', { appId, startTime: from, endTime: to }, signal),
    enabled: Boolean(appId),
    ...dashboardQueryDefaults,
  };
}

export function unidentifiedViewsQueryOptions(
  params: UnidentifiedViewsRequest,
): UseQueryOptions<UnidentifiedViewItemDTO[], ApiError> {
  const normalized = normalizeQueryParams(params);
  return {
    queryKey: queryKeys.unidentifiedViews.list(params),
    queryFn: ({ signal }) => apiGet<UnidentifiedViewItemDTO[]>('/unidentified-views', normalized, signal),
    enabled: Boolean(params.appId),
    ...dashboardQueryDefaults,
  };
}

export function appsQueryOptions(): UseQueryOptions<AppItemDTO[], ApiError> {
  return {
    queryKey: queryKeys.apps.all,
    queryFn: ({ signal }) => apiGet<AppItemDTO[]>('/apps', undefined, signal),
    ...dashboardQueryDefaults,
    refetchInterval: 30_000,
  };
}

export function visitorStatsQueryOptions(
  params: VisitorStatsRequest,
): UseQueryOptions<VisitorStatsDTO, ApiError> {
  const normalized = normalizeQueryParams(params);
  return {
    queryKey: queryKeys.visitorStats.list(params),
    queryFn: ({ signal }) => apiGet<VisitorStatsDTO>('/visitor-stats', normalized, signal),
    enabled: Boolean(params.appId),
    ...dashboardQueryDefaults,
  };
}
