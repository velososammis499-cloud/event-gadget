import { Router, type Request, type Response } from 'express';
import { v4 as uuid } from 'uuid';
import {
  insertFunnel, updateFunnel, deleteFunnel, listFunnels, getFunnel,
  getFunnelOptions, analyzeFunnel, getSuggestedFunnels,
  type FunnelStep,
} from '../db/queries';
import { ok, err } from '../db/dto';

const router = Router();

function safeInt(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

function validateSteps(raw: unknown): FunnelStep[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length < 2 || raw.length > 8) return null;
  const out: FunnelStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') return null;
    const obj = s as Record<string, unknown>;
    if (obj.kind === 'page' && typeof obj.path === 'string' && obj.path) {
      out.push({ kind: 'page', path: obj.path });
    } else if (obj.kind === 'click' && typeof obj.dataTrack === 'string' && obj.dataTrack) {
      out.push({ kind: 'click', dataTrack: obj.dataTrack });
    } else {
      return null;
    }
  }
  return out;
}

// === Options for step picker ===
router.get('/options', (req: Request, res: Response): void => {
  const appId = req.query.appId as string | undefined;
  if (!appId) {
    res.status(400).json(err('MISSING_APP_ID', 'appId is required'));
    return;
  }
  res.json(ok(getFunnelOptions(appId)));
});

// === Suggested funnels ===
router.get('/suggested', (req: Request, res: Response): void => {
  const appId = req.query.appId as string | undefined;
  if (!appId) {
    res.status(400).json(err('MISSING_APP_ID', 'appId is required'));
    return;
  }
  const suggestions = getSuggestedFunnels({
    appId,
    startTime: safeInt(req.query.from as string),
    endTime: safeInt(req.query.to as string),
  });
  res.json(ok(suggestions));
});

// === Ad-hoc analyze (no save) ===
router.post('/analyze', (req: Request, res: Response): void => {
  const body = req.body ?? {};
  const appId = body.appId as string | undefined;
  if (!appId) {
    res.status(400).json(err('MISSING_APP_ID', 'appId is required'));
    return;
  }
  const steps = validateSteps(body.steps);
  if (!steps) {
    res.status(400).json(err('INVALID_STEPS', 'steps must be 2-8 page/click descriptors'));
    return;
  }
  const result = analyzeFunnel({
    appId,
    steps,
    startTime: typeof body.from === 'number' ? body.from : undefined,
    endTime: typeof body.to === 'number' ? body.to : undefined,
  });
  res.json(ok(result));
});

// === List saved funnels (with analysis) ===
router.get('/', (req: Request, res: Response): void => {
  const appId = req.query.appId as string | undefined;
  if (!appId) {
    res.status(400).json(err('MISSING_APP_ID', 'appId is required'));
    return;
  }
  const from = safeInt(req.query.from as string);
  const to = safeInt(req.query.to as string);
  const rows = listFunnels(appId);
  const enriched = rows.map((r) => {
    let steps: FunnelStep[] = [];
    try { steps = JSON.parse(r.steps) as FunnelStep[]; } catch { /* ignore */ }
    const analysis = analyzeFunnel({ appId, steps, startTime: from, endTime: to });
    return {
      id: r.id,
      name: r.name,
      steps,
      counts: analysis.counts,
      createdAt: r.created_at * 1000,
      updatedAt: r.updated_at * 1000,
    };
  });
  res.json(ok(enriched));
});

// === Create ===
router.post('/', (req: Request, res: Response): void => {
  const body = req.body ?? {};
  const appId = body.appId as string | undefined;
  const name = body.name as string | undefined;
  if (!appId || !name) {
    res.status(400).json(err('MISSING_FIELDS', 'appId and name are required'));
    return;
  }
  const steps = validateSteps(body.steps);
  if (!steps) {
    res.status(400).json(err('INVALID_STEPS', 'steps must be 2-8 page/click descriptors'));
    return;
  }
  const id = uuid();
  insertFunnel({ id, app_id: appId, name: name.slice(0, 100), steps: JSON.stringify(steps) });
  res.json(ok({ id }));
});

// === Update ===
router.put('/:id', (req: Request, res: Response): void => {
  const id = req.params.id;
  const existing = getFunnel(id);
  if (!existing) {
    res.status(404).json(err('NOT_FOUND', 'Funnel not found'));
    return;
  }
  const body = req.body ?? {};
  const patch: { name?: string; steps?: string } = {};
  if (typeof body.name === 'string' && body.name) patch.name = body.name.slice(0, 100);
  if (body.steps !== undefined) {
    const steps = validateSteps(body.steps);
    if (!steps) {
      res.status(400).json(err('INVALID_STEPS', 'steps must be 2-8 page/click descriptors'));
      return;
    }
    patch.steps = JSON.stringify(steps);
  }
  updateFunnel(id, patch);
  res.json(ok({ id }));
});

// === Delete ===
router.delete('/:id', (req: Request, res: Response): void => {
  const id = req.params.id;
  const existing = getFunnel(id);
  if (!existing) {
    res.status(404).json(err('NOT_FOUND', 'Funnel not found'));
    return;
  }
  deleteFunnel(id);
  res.json(ok({ id }));
});

export default router;
