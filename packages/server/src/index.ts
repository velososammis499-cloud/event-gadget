import express from 'express';
import cors from 'cors';
import path from 'path';
import { closeDb } from './db/db';
import collectRouter from './routes/collect';
import analyticsRouter from './routes/analytics';
import funnelsRouter from './routes/funnels';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// JSON parse error guard: a malformed POST /collect body would otherwise
// reach Express's default HTML error page (stack trace exposed to clients).
// Convert it into our standard error envelope and a 400.
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction): void => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ ok: false, code: 'INVALID_JSON', message: 'Request body is not valid JSON' });
    return;
  }
  next(err);
});

app.use('/collect', collectRouter);
app.use('/api', analyticsRouter);
app.use('/api/funnels', funnelsRouter);

// Serve tracker UMD — users add <script src="http://host:3001/tracker.js">
app.get('/tracker.js', (_req, res) => {
  const trackerPath = path.resolve(__dirname, '../../tracker/dist/tracker.umd.js');
  res.sendFile(trackerPath, (err) => {
    if (err) {
      res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Tracker not built. Run npm run build:tracker first.' });
    }
  });
});

// Serve tracker auto-init loader
app.get('/sg.js', (_req, res) => {
  const loaderPath = path.resolve(__dirname, '../public/sg.js');
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(loaderPath, (err) => {
    if (err) {
      res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Loader script not found.' });
    }
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, data: { status: 'ok', uptime: process.uptime() } });
});

// Demo pages — same-origin so /sg.js and /collect inside the page work without
// any URL configuration. Visitors hit /demo/ or /demo/supply-chain.html directly.
app.use('/demo', express.static(path.resolve(__dirname, '../../../example'), {
  index: ['supply-chain.html', 'index.html'],
  extensions: ['html'],
}));

// Dashboard production build — served at the root so the deployed URL gives
// users the dashboard immediately. Set DASHBOARD_DIST to override the path
// (default points at the workspace sibling).
const DASHBOARD_DIST = process.env.DASHBOARD_DIST
  || path.resolve(__dirname, '../../dashboard/dist');
app.use(express.static(DASHBOARD_DIST, { index: false }));

// SPA fallback — any non-API, non-asset GET returns index.html so React
// Router can handle deep links like /blocked or /paths on cold load.
// The negative lookahead matches each reserved prefix exactly (followed by
// either end-of-path, '/', or '?') so SPA routes like /apit or /demoboard
// still fall through to the dashboard — only /api/*, /api, /demo/*, etc are
// excluded.
app.get(/^(?!\/(?:api|collect|sg\.js|tracker\.js|health|demo)(?:[/?]|$)).*/, (_req, res) => {
  res.sendFile(path.join(DASHBOARD_DIST, 'index.html'), (err) => {
    if (err) res.status(404).send('Dashboard not built. Run `npm run build:dashboard`.');
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Event Gadget] running on http://0.0.0.0:${PORT}`);
});

function gracefulShutdown(): void {
  console.log('[Event Gadget] shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
