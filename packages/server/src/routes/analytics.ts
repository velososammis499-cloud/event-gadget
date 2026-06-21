import { Router, type Request, type Response } from 'express';
import {
  getEvents, getEventsCount, getPageStats, getJourneys, getChains,
  getOverviewTotals, getHourlyTrend, getAliasMap, getRankings,
  listLabels, upsertLabel, deleteLabel,
  getDiagnostics, previewSegment,
  getUnidentifiedViews,
  getApps,
  getVisitorStats,
  type SegmentCondition,
} from '../db/queries';
import { toEventDTO, toPageStatsDTO, toJourneyDTO, toChainDTO, ok, err } from '../db/dto';

const MAX_EVENTS_LIMIT = 500;
const DEFAULT_EVENTS_LIMIT = 100;

function safeInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

const router = Router();

router.get('/events', (req: Request, res: Response): void => {
  const limit = Math.min(
    safeInt(req.query.limit as string, DEFAULT_EVENTS_LIMIT),
    MAX_EVENTS_LIMIT,
  );
  const offset = safeInt(req.query.offset as string, 0);

  const filterOpts = {
    appId: req.query.appId as string | undefined,
    pagePath: req.query.pagePath as string | undefined,
    pathMatch: req.query.pathMatch as 'contains' | 'prefix' | 'exact' | undefined,
    sessionId: req.query.sessionId as string | undefined,
    userId: req.query.userId as string | undefined,
    type: req.query.type as string | undefined,
    startTime: safeInt(req.query.startTime as string, 0) || undefined,
    endTime: safeInt(req.query.endTime as string, 0) || undefined,
  };

  const total = getEventsCount(filterOpts);
  const rows = getEvents({ ...filterOpts, limit, offset });
  const aliasMap = filterOpts.appId ? getAliasMap(filterOpts.appId) : undefined;
  const items = rows.map(r => toEventDTO(r, aliasMap));

  res.json(ok({
    items,
    total,
    limit,
    offset,
  }));
});

router.get('/pages', (req: Request, res: Response): void => {
  const rows = getPageStats({
    appId: req.query.appId as string | undefined,
    startTime: safeInt(req.query.startTime as string, 0) || undefined,
    endTime: safeInt(req.query.endTime as string, 0) || undefined,
  });

  res.json(ok(rows.map(toPageStatsDTO)));
});

router.get('/journeys', (req: Request, res: Response): void => {
  const rows = getJourneys({
    appId: req.query.appId as string | undefined,
    startTime: safeInt(req.query.startTime as string, 0) || undefined,
    endTime: safeInt(req.query.endTime as string, 0) || undefined,
    limit: safeInt(req.query.limit as string, 50),
  });

  res.json(ok(rows.map(toJourneyDTO)));
});

router.get('/chains', (req: Request, res: Response): void => {
  const rows = getChains({
    appId: req.query.appId as string | undefined,
    userId: req.query.userId as string | undefined,
    limit: safeInt(req.query.limit as string, 20),
  });

  res.json(ok(rows.map(toChainDTO)));
});

router.get('/overview', (req: Request, res: Response): void => {
  const appId = req.query.appId as string | undefined;
  const from = safeInt(req.query.from as string, 0) || undefined;
  const to = safeInt(req.query.to as string, 0) || undefined;

  // Compute prior period of equal length, ending right before `from`.
  // If from/to not provided, prior is omitted (caller gets nulls).
  let prevFrom: number | undefined;
  let prevTo: number | undefined;
  if (from && to && to > from) {
    const span = to - from;
    prevTo = from - 1;
    prevFrom = prevTo - span + 1;
  }

  const current = getOverviewTotals({ appId, startTime: from, endTime: to });
  const previous = prevFrom && prevTo
    ? getOverviewTotals({ appId, startTime: prevFrom, endTime: prevTo })
    : null;
  const trend = getHourlyTrend({ appId, startTime: from, endTime: to });

  res.json(ok({
    current,
    previous,
    compareRange: prevFrom && prevTo ? { from: prevFrom, to: prevTo } : null,
    trend,
  }));
});

router.get('/rankings', (req: Request, res: Response): void => {
  const appId = req.query.appId as string | undefined;
  if (!appId) {
    res.status(400).json(err('MISSING_APP_ID', 'appId is required'));
    return;
  }
  const rows = getRankings({
    appId,
    startTime: safeInt(req.query.startTime as string, 0) || undefined,
    endTime: safeInt(req.query.endTime as string, 0) || undefined,
  });
  res.json(ok(rows));
});

router.get('/labels', (req: Request, res: Response): void => {
  const appId = req.query.appId as string | undefined;
  if (!appId) {
    res.status(400).json(err('MISSING_APP_ID', 'appId is required'));
    return;
  }
  const rows = listLabels(appId);
  res.json(ok(rows.map(r => ({ rawKey: r.raw_key, alias: r.alias, updatedAt: r.updated_at * 1000 }))));
});

router.put('/labels/:rawKey', (req: Request, res: Response): void => {
  const body = req.body ?? {};
  const appId = body.appId as string | undefined;
  const alias = body.alias as string | undefined;
  if (!appId) { res.status(400).json(err('MISSING_APP_ID', 'appId is required')); return; }
  if (typeof alias !== 'string') { res.status(400).json(err('INVALID_ALIAS', 'alias must be a string')); return; }
  const rawKey = req.params.rawKey;
  if (!alias.trim()) {
    deleteLabel(appId, rawKey);
  } else {
    upsertLabel(appId, rawKey, alias.trim().slice(0, 100));
  }
  res.json(ok({ rawKey, alias }));
});

router.get('/diagnostics', (req: Request, res: Response): void => {
  const appId = req.query.appId as string | undefined;
  if (!appId) {
    res.status(400).json(err('MISSING_APP_ID', 'appId is required'));
    return;
  }
  const result = getDiagnostics({
    appId,
    startTime: safeInt(req.query.startTime as string, 0) || undefined,
    endTime: safeInt(req.query.endTime as string, 0) || undefined,
  });
  res.json(ok(result));
});

router.post('/segments/preview', (req: Request, res: Response): void => {
  const body = req.body ?? {};
  const appId = body.appId as string | undefined;
  if (!appId) {
    res.status(400).json(err('MISSING_APP_ID', 'appId is required'));
    return;
  }
  const rawConditions = Array.isArray(body.conditions) ? body.conditions : [];
  const conditions: SegmentCondition[] = [];
  for (const c of rawConditions) {
    if (!c || typeof c !== 'object') continue;
    const op = (c as Record<string, unknown>).op;
    const value = (c as Record<string, unknown>).value;
    if (
      (op === 'visited' || op === 'not_visited' || op === 'clicked' || op === 'not_clicked') &&
      typeof value === 'string'
    ) {
      conditions.push({ op, value });
    }
  }
  const result = previewSegment({
    appId,
    conditions,
    startTime: typeof body.startTime === 'number' ? body.startTime : undefined,
    endTime: typeof body.endTime === 'number' ? body.endTime : undefined,
  });
  res.json(ok(result));
});

router.get('/unidentified-views', (req: Request, res: Response): void => {
  const appId = req.query.appId as string | undefined;
  if (!appId) {
    res.status(400).json(err('MISSING_APP_ID', 'appId is required'));
    return;
  }
  const rows = getUnidentifiedViews({
    appId,
    startTime: safeInt(req.query.from as string, 0) || safeInt(req.query.startTime as string, 0) || undefined,
    endTime: safeInt(req.query.to as string, 0) || safeInt(req.query.endTime as string, 0) || undefined,
    minClicks: safeInt(req.query.minClicks as string, 0) || undefined,
    limit: safeInt(req.query.limit as string, 0) || undefined,
  });
  res.json(ok(rows));
});

router.get('/apps', (_req: Request, res: Response): void => {
  res.json(ok(getApps()));
});

router.get('/visitor-stats', (req: Request, res: Response): void => {
  const appId = req.query.appId as string | undefined;
  if (!appId) {
    res.status(400).json(err('MISSING_APP_ID', 'appId is required'));
    return;
  }
  const stats = getVisitorStats({
    appId,
    startTime: safeInt(req.query.from as string, 0) || safeInt(req.query.startTime as string, 0) || undefined,
    endTime: safeInt(req.query.to as string, 0) || safeInt(req.query.endTime as string, 0) || undefined,
  });
  res.json(ok(stats));
});

export default router;
