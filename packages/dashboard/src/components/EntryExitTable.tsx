import { useMemo } from 'react';
import type { EventDTO } from '../api/types';
import GradientBorderCard from './GradientBorderCard';

export default function EntryExitTable({ events }: { events: EventDTO[] }) {
  const { entries, exits } = useMemo(() => {
    const pageviews = events.filter(e => e.type === 'pageview');

    // Entry: sourceType is external or direct
    const entryMap = new Map<string, { count: number; users: Set<string> }>();
    for (const e of pageviews) {
      if (e.sourceType === 'external' || e.sourceType === 'direct') {
        const entry = entryMap.get(e.pagePath) ?? { count: 0, users: new Set<string>() };
        entry.count++;
        if (e.userId) entry.users.add(e.userId);
        entryMap.set(e.pagePath, entry);
      }
    }

    // Exit: last pageview in each session
    const bySession = new Map<string, EventDTO[]>();
    for (const e of pageviews) {
      const list = bySession.get(e.sessionId) ?? [];
      list.push(e);
      bySession.set(e.sessionId, list);
    }
    const exitMap = new Map<string, { count: number; users: Set<string> }>();
    for (const [, evts] of bySession) {
      const last = [...evts].sort((a, b) => a.timestamp - b.timestamp).pop();
      if (last) {
        const entry = exitMap.get(last.pagePath) ?? { count: 0, users: new Set<string>() };
        entry.count++;
        if (last.userId) entry.users.add(last.userId);
        exitMap.set(last.pagePath, entry);
      }
    }

    const toList = (map: Map<string, { count: number; users: Set<string> }>) =>
      Array.from(map.entries())
        .map(([page, { count, users }]) => ({ page, count, users: users.size }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

    return { entries: toList(entryMap), exits: toList(exitMap) };
  }, [events]);

  if (entries.length === 0 && exits.length === 0) return null;

  const colStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid rgba(0, 240, 255, 0.06)' };
  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 500 };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {entries.length > 0 && (
        <GradientBorderCard title="入口页面" subtitle="用户从哪里来" accent="var(--success)">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>页面</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>次数</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>用户</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(row => (
                <tr key={row.page}>
                  <td style={colStyle}><span style={{ color: 'var(--accent)', fontSize: 12 }}>{row.page}</span></td>
                  <td style={{ ...colStyle, textAlign: 'right', color: 'var(--success)' }}>{row.count}</td>
                  <td style={{ ...colStyle, textAlign: 'right', color: 'var(--text-muted)' }}>{row.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GradientBorderCard>
      )}
      {exits.length > 0 && (
        <GradientBorderCard title="出口页面" subtitle="用户从哪里离开" accent="var(--danger)">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>页面</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>次数</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>用户</th>
              </tr>
            </thead>
            <tbody>
              {exits.map(row => (
                <tr key={row.page}>
                  <td style={colStyle}><span style={{ color: 'var(--accent)', fontSize: 12 }}>{row.page}</span></td>
                  <td style={{ ...colStyle, textAlign: 'right', color: 'var(--danger)' }}>{row.count}</td>
                  <td style={{ ...colStyle, textAlign: 'right', color: 'var(--text-muted)' }}>{row.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GradientBorderCard>
      )}
    </div>
  );
}
