import { useMemo } from 'react';
import type { EventDTO } from '../api/types';
import GradientBorderCard from './GradientBorderCard';

interface FunnelStep {
  page: string;
  count: number;
  dropoff: number;
}

export default function DropoffFunnel({ events }: { events: EventDTO[] }) {
  const steps = useMemo((): FunnelStep[] => {
    const pageviews = events.filter(e => e.type === 'pageview');
    if (pageviews.length === 0) return [];

    const bySession = new Map<string, EventDTO[]>();
    for (const e of pageviews) {
      const list = bySession.get(e.sessionId) ?? [];
      list.push(e);
      bySession.set(e.sessionId, list);
    }

    // Find entry pages (first pageview in session with external/direct source)
    const entryCounts = new Map<string, number>();
    for (const [, evts] of bySession) {
      const first = [...evts].sort((a, b) => a.timestamp - b.timestamp)[0];
      if (first && (first.sourceType === 'external' || first.sourceType === 'direct' || !first.sourceType)) {
        entryCounts.set(first.pagePath, (entryCounts.get(first.pagePath) ?? 0) + 1);
      }
    }

    // Build top entry paths
    const topEntries = Array.from(entryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([page]) => page);

    if (topEntries.length === 0) {
      // Fallback: use all page paths
      const allPaths = new Map<string, number>();
      for (const e of pageviews) {
        allPaths.set(e.pagePath, (allPaths.get(e.pagePath) ?? 0) + 1);
      }
      return Array.from(allPaths.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([page, count], i, arr) => ({
          page,
          count,
          dropoff: i > 0 ? 1 - count / arr[0][1] : 0,
        }));
    }

    // Track flow from top entry pages
    const stepCounts = new Map<string, number>();
    for (const entryPage of topEntries) {
      const pageEvents = pageviews.filter(e => e.pagePath === entryPage);
      stepCounts.set(entryPage, pageEvents.length);
    }

    // Next step: find common next pages
    const nextMap = new Map<string, number>();
    for (const [, evts] of bySession) {
      const sorted = [...evts].sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (topEntries.includes(sorted[i].pagePath) && sorted[i + 1].pagePath !== sorted[i].pagePath) {
          nextMap.set(sorted[i + 1].pagePath, (nextMap.get(sorted[i + 1].pagePath) ?? 0) + 1);
        }
      }
    }

    const nextSteps = Array.from(nextMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [page, count] of nextSteps) {
      stepCounts.set(page, count);
    }

    const result = Array.from(stepCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    return result.map(([page, count], i) => ({
      page,
      count,
      dropoff: i > 0 ? 1 - count / result[0][1] : 0,
    }));
  }, [events]);

  if (steps.length === 0) return null;

  const maxCount = Math.max(...steps.map(s => s.count), 1);

  return (
    <GradientBorderCard title="流失漏斗" subtitle="从入口到深层页面的用户流失">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', padding: '8px 0' }}>
        {steps.map((step, i) => {
          const widthPct = 40 + (step.count / maxCount) * 60;
          return (
            <div key={step.page} style={{ width: '100%', textAlign: 'center' }}>
              <div
                style={{
                  width: `${widthPct}%`,
                  margin: '0 auto',
                  padding: '10px 16px',
                  background: `linear-gradient(90deg, rgba(0, 240, 255, ${0.08 + (step.count / maxCount) * 0.15}), rgba(123, 47, 255, ${0.05 + (step.count / maxCount) * 0.1}))`,
                  border: '1px solid rgba(0, 240, 255, 0.2)',
                  borderRadius: 6,
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {step.page}
                </div>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>
                  {step.count} 次会话
                </div>
              </div>
              {i < steps.length - 1 && steps[i + 1].dropoff > 0 && (
                <div style={{ fontSize: 11, color: 'var(--danger)', padding: '4px 0' }}>
                  ↓ 流失 {((steps[i + 1].dropoff) * 100).toFixed(0)}%
                </div>
              )}
              {i < steps.length - 1 && steps[i + 1].dropoff <= 0 && (
                <div style={{ fontSize: 11, color: 'var(--success)', padding: '4px 0' }}>
                  ↓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GradientBorderCard>
  );
}
