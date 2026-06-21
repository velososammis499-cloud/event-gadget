import { useQuery } from '@tanstack/react-query';
import {
  pagesQueryOptions, eventsQueryOptions, journeysQueryOptions, chainsQueryOptions, overviewQueryOptions,
  funnelsListQueryOptions, funnelsOptionsQueryOptions, funnelsSuggestedQueryOptions,
  rankingsQueryOptions, labelsQueryOptions, diagnosticsQueryOptions,
  unidentifiedViewsQueryOptions, appsQueryOptions, visitorStatsQueryOptions,
} from './query-options';
import type { PagesRequest, EventsRequest, JourneysRequest, ChainsRequest, OverviewRequest, RankingsRequest, UnidentifiedViewsRequest, VisitorStatsRequest } from './types';

export function usePages(params: PagesRequest) {
  return useQuery(pagesQueryOptions(params));
}

export function useEvents(params: EventsRequest) {
  return useQuery(eventsQueryOptions(params));
}

export function useJourneys(params: JourneysRequest) {
  return useQuery(journeysQueryOptions(params));
}

export function useChains(params: ChainsRequest) {
  return useQuery(chainsQueryOptions(params));
}

export function useOverview(params: OverviewRequest) {
  return useQuery(overviewQueryOptions(params));
}

export function useFunnels(appId: string | undefined, from?: number, to?: number) {
  return useQuery(funnelsListQueryOptions(appId, from, to));
}

export function useFunnelOptions(appId: string | undefined) {
  return useQuery(funnelsOptionsQueryOptions(appId));
}

export function useSuggestedFunnels(appId: string | undefined, from?: number, to?: number) {
  return useQuery(funnelsSuggestedQueryOptions(appId, from, to));
}

export function useRankings(params: RankingsRequest) {
  return useQuery(rankingsQueryOptions(params));
}

export function useLabels(appId: string | undefined) {
  return useQuery(labelsQueryOptions(appId));
}

export function useDiagnostics(appId: string | undefined, from?: number, to?: number) {
  return useQuery(diagnosticsQueryOptions(appId, from, to));
}

export function useUnidentifiedViews(params: UnidentifiedViewsRequest) {
  return useQuery(unidentifiedViewsQueryOptions(params));
}

export function useApps() {
  return useQuery(appsQueryOptions());
}

export function useVisitorStats(params: VisitorStatsRequest) {
  return useQuery(visitorStatsQueryOptions(params));
}
