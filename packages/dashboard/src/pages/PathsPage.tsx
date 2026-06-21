import { useState } from 'react';
import KpiCard from '../components/KpiCard';
import GlowCard from '../components/GlowCard';
import SankeyFlowDiagram from '../components/SankeyFlowDiagram';
import SessionTimeline from '../components/SessionTimeline';
import SessionDrawer from '../components/SessionDrawer';
import { LoadingState, EmptyState } from '../components/StatePrimitives';
import { useFilters } from '../hooks/useFilters';
import { useOverview, useJourneys, useChains } from '../api/queries';
import { displayPath, formatDurationMs } from '../shared/formatters';

export default function PathsPage() {
  const { filters } = useFilters();
  const overview = useOverview({ appId: filters.appId, from: filters.startTime, to: filters.endTime });
  const journeys = useJourneys({ appId: filters.appId, startTime: filters.startTime, endTime: filters.endTime, limit: 100 });
  const chains = useChains({ appId: filters.appId, limit: 50 });

  const [drawerPath, setDrawerPath] = useState<string | null>(null);

  if (!filters.appId) return <EmptyState message="请在顶部填入 App ID" />;
  if (journeys.isLoading) return <LoadingState />;

  const j = journeys.data ?? [];
  const c = chains.data ?? [];

  // KPI
  const sessionCount = overview.data?.current.uniqueSessions ?? 0;
  const avgSessionMs = overview.data?.current.avgSessionMs ?? 0;
  // 入口:source_path 出现频率最高的(j 已是 internal 跳转,这里用 chain 第一个 entry)
  const entryCount = new Map<string, number>();
  const exitCount = new Map<string, number>();
  for (const ch of c) {
    if (ch.entries.length === 0) continue;
    const first = ch.entries[0].path;
    const last = ch.entries[ch.entries.length - 1].path;
    entryCount.set(first, (entryCount.get(first) ?? 0) + 1);
    exitCount.set(last, (exitCount.get(last) ?? 0) + 1);
  }
  const topEntry = [...entryCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const topExit = [...exitCount.entries()].sort((a, b) => b[1] - a[1])[0];

  // 一句话结论
  const top = j[0];
  const exitShare = topExit && c.length > 0 ? Math.round((topExit[1] / c.length) * 100) : 0;
  const conclusion = top
    ? `最频繁的跳转是 「${displayPath(top.sourcePath)}」 → 「${displayPath(top.targetPath)}」(${top.count.toLocaleString()} 次)。${topExit ? ` ${exitShare}% 的会话最终停在「${displayPath(topExit[0])}」。` : ''}`
    : '本周期暂无跳转数据。';

  return (
    <div className="animated-in">
      <h1 style={styles.h1}>怎么走的</h1>

      <div style={styles.kpis}>
        <KpiCard label="会话数" value={sessionCount} animated
          hint="一次会话 ≈ 一次连续浏览;关 tab 或闲置后重开算新会话" />
        <KpiCard label="平均会话时长" value={avgSessionMs} formatValue={v => formatDurationMs(v)} />
        <KpiCard label="最常见入口"
          value={topEntry?.[1] ?? 0}
          formatValue={() => topEntry ? displayPath(topEntry[0]) : '—'} />
        <KpiCard label="最常见出口"
          value={topExit?.[1] ?? 0}
          formatValue={() => topExit ? displayPath(topExit[0]) : '—'} />
      </div>

      <GlowCard>
        <div style={styles.conclusion}>{conclusion}</div>
      </GlowCard>

      {j.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <GlowCard>
            <div style={styles.sectionTitle}>主要跳转路径</div>
            <SankeyFlowDiagram journeys={j} />
          </GlowCard>
        </div>
      )}

      {c.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <GlowCard>
            <div style={styles.sectionTitle}>典型会话(共 {c.length} 条)</div>
            <SessionTimeline chains={c.slice(0, 20)} />
          </GlowCard>
        </div>
      )}

      <SessionDrawer
        open={!!drawerPath}
        onClose={() => setDrawerPath(null)}
        appId={filters.appId}
        pagePathContains={drawerPath ?? undefined}
        title={drawerPath ? `经过「${displayPath(drawerPath)}」的会话` : ''}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 24 },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 },
  conclusion: { fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6 },
  sectionTitle: { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, fontWeight: 600 },
};
