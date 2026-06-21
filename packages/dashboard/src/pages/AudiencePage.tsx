import { useState } from 'react';
import KpiCard from '../components/KpiCard';
import GlowCard from '../components/GlowCard';
import VisitorMix from '../components/VisitorMix';
import SessionDrawer from '../components/SessionDrawer';
import { LoadingState, EmptyState } from '../components/StatePrimitives';
import { useFilters } from '../hooks/useFilters';
import { useOverview, useVisitorStats } from '../api/queries';

export default function AudiencePage() {
  const { filters } = useFilters();
  const overview = useOverview({ appId: filters.appId, from: filters.startTime, to: filters.endTime });
  const stats = useVisitorStats({ appId: filters.appId, from: filters.startTime, to: filters.endTime });

  const [drawerVid, setDrawerVid] = useState<string | null>(null);

  if (!filters.appId) return <EmptyState message="请在顶部填入 App ID" />;
  if (overview.isLoading || stats.isLoading) return <LoadingState />;

  const cur = overview.data?.current;
  const prev = overview.data?.previous;

  const total = cur?.uniqueVisitors ?? 0;
  const newPct = total > 0 ? Math.round(((cur?.newVisitors ?? 0) / total) * 100) : 0;
  const prevNewPct = prev && prev.uniqueVisitors > 0
    ? Math.round((prev.newVisitors / prev.uniqueVisitors) * 100)
    : null;

  // Visitor session distribution — fully aggregated in DB, no client-side sampling.
  const vs = stats.data;
  const repeatVisitors = vs?.returning ?? 0;
  const heavyVisitors = vs?.heavy ?? 0;
  const repeatPct = vs && vs.total > 0 ? Math.round((vs.returning / vs.total) * 100) : 0;
  const heavyList = vs?.top ?? [];

  const trendStr = prevNewPct !== null
    ? newPct > prevNewPct ? `(↑ ${newPct - prevNewPct}pp)` : newPct < prevNewPct ? `(↓ ${prevNewPct - newPct}pp)` : '(持平)'
    : '';
  const conclusion = total > 0
    ? `本周期 ${total.toLocaleString()} 个浏览器会话访客(同一浏览器算 1 个,隐身模式或不同设备会重复计),新人占 ${newPct}%${trendStr}。回头率 ${repeatPct}%,高频访客(≥5 个会话)${heavyVisitors} 人。`
    : '本周期暂无访客数据。';

  return (
    <div className="animated-in">
      <h1 style={styles.h1}>谁在用</h1>

      <div style={styles.kpis}>
        <KpiCard label="独立访客" value={total} previousValue={prev?.uniqueVisitors} animated
          hint="同浏览器=1人;清 cookie / 隐身模式 / 自动化脚本会被计为不同访客" />
        <KpiCard label="新人占比" value={newPct} formatValue={v => `${v}%`}
          hint="cookie 在本周期首次出现的访客" />
        <KpiCard label="回头率" value={repeatPct} formatValue={v => `${v}%`}
          hint="同一访客在本周期出现 ≥ 2 个会话的比例(全量聚合)" />
        <KpiCard label="高频访客(≥5)" value={heavyVisitors} animated
          hint="同一访客累计 ≥ 5 个会话(全量聚合)" />
      </div>

      <GlowCard>
        <div style={styles.conclusion}>{conclusion}</div>
      </GlowCard>

      {cur && (cur.newVisitors + cur.returningVisitors + cur.unknownVisitors > 0) && (
        <div style={{ marginTop: 16 }}>
          <VisitorMix
            newVisitors={cur.newVisitors}
            returningVisitors={cur.returningVisitors}
            unknownVisitors={cur.unknownVisitors}
          />
        </div>
      )}

      {heavyList.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <GlowCard>
            <div style={styles.sectionTitle}>高频访客 Top 10</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>访客 ID</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>会话数</th>
                </tr>
              </thead>
              <tbody>
                {heavyList.map(({ visitorId, sessionCount }) => (
                  <tr key={visitorId} style={styles.row} onClick={() => setDrawerVid(visitorId)}>
                    <td style={styles.td}><code style={styles.code}>{visitorId.slice(0, 16)}…</code></td>
                    <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-primary)' }}>{sessionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlowCard>
        </div>
      )}

      <SessionDrawer
        open={!!drawerVid}
        onClose={() => setDrawerVid(null)}
        appId={filters.appId}
        title={drawerVid ? `用户 ${drawerVid.slice(0, 12)}…` : ''}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 24 },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 },
  conclusion: { fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6 },
  sectionTitle: { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, fontWeight: 600 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left' as const, padding: '8px 12px', fontSize: 11,
    color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 500,
  },
  td: { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid rgba(0,240,255,0.06)' },
  row: { cursor: 'pointer' },
  code: {
    background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 3,
    fontSize: 12, color: 'var(--accent)',
  },
};
