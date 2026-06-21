import { useState } from 'react';
import KpiCard from '../components/KpiCard';
import GlowCard from '../components/GlowCard';
import FunnelChart from '../components/FunnelChart';
import SessionDrawer from '../components/SessionDrawer';
import { LoadingState, EmptyState } from '../components/StatePrimitives';
import { useFilters } from '../hooks/useFilters';
import { useDiagnostics, useSuggestedFunnels } from '../api/queries';
import { displayPath } from '../shared/formatters';

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 24 },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 },
  conclusion: { fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6 },
  threeCol: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 },
  sectionTitle: { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, fontWeight: 600 },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid rgba(0,240,255,0.06)',
    cursor: 'pointer', fontSize: 13,
  },
  rowLabel: { color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginRight: 8 },
  rowMeta: { color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 },
  empty: { fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' as const, padding: 24 },
};

export default function BlockedPage() {
  const { filters } = useFilters();
  const diag = useDiagnostics(filters.appId, filters.startTime, filters.endTime);
  const suggested = useSuggestedFunnels(filters.appId, filters.startTime, filters.endTime);

  const [drawerPath, setDrawerPath] = useState<{ path: string; title: string } | null>(null);

  if (!filters.appId) return <EmptyState message="请在顶部填入 App ID" />;
  if (diag.isLoading) return <LoadingState />;

  const d = diag.data;
  const top = suggested.data?.[0];

  // KPI
  // Weighted bounce rate: sum(bounces)/sum(visits) across the top-bounce pages.
  // Arithmetic mean of per-page ratios biases towards low-traffic pages
  // (one 100% bounce on a 3-visit page would weigh the same as 30% on a 500-visit page).
  const totalBounces = d ? d.highBouncePages.reduce((s, p) => s + p.bounces, 0) : 0;
  const totalBounceVisits = d ? d.highBouncePages.reduce((s, p) => s + p.visits, 0) : 0;
  const avgBounce = totalBounceVisits > 0 ? totalBounces / totalBounceVisits : 0;
  const deadCount = d?.deadButtons.length ?? 0;
  const formFailCount = d?.formFailures.reduce((s, f) => s + f.failures, 0) ?? 0;
  const funnelDrop = top ? (top.counts[0] ?? 0) - (top.counts[top.counts.length - 1] ?? 0) : 0;

  // 一句话结论:把三种卡点 normalize 成"影响量" = ratio × volume,
  // 取影响最大的那个写出来。这样 "5 次点击 80% deadRatio" 不会盖过
  // "1000 次提交 30% 失败" — 后者影响的人数远多于前者。
  type Candidate =
    | { kind: 'dead'; impact: number; ratio: number; text: string }
    | { kind: 'form'; impact: number; ratio: number; text: string }
    | { kind: 'bounce'; impact: number; ratio: number; text: string }
    | { kind: 'funnel'; impact: number; ratio: number; text: string };

  const candidates: Candidate[] = [];
  if (d) {
    for (const b of d.deadButtons.slice(0, 5)) {
      const impact = Math.round(b.deadRatio * b.clicks);
      candidates.push({
        kind: 'dead', impact, ratio: b.deadRatio,
        text: `最严重卡点是「${b.label}」 — ${b.clicks.toLocaleString()} 次点击中 ${Math.round(b.deadRatio * 100)}%(约 ${impact.toLocaleString()} 次)点完没有任何后续动作,可能这个按钮没接事件或界面没响应。`,
      });
    }
    for (const f of d.formFailures.slice(0, 5)) {
      const ratio = f.submits > 0 ? f.failures / f.submits : 0;
      candidates.push({
        kind: 'form', impact: f.failures, ratio,
        text: `表单「${f.formId || f.fieldHint || '未命名'}」提交失败率 ${Math.round(ratio * 100)}%(${f.failures.toLocaleString()}/${f.submits.toLocaleString()})— 可能字段校验过严或后端报错。`,
      });
    }
    for (const p of d.highBouncePages.slice(0, 5)) {
      candidates.push({
        kind: 'bounce', impact: p.bounces, ratio: p.bounceRatio,
        text: `「${displayPath(p.path)}」${p.visits.toLocaleString()} 次访问中 ${Math.round(p.bounceRatio * 100)}% 进来就走(约 ${p.bounces.toLocaleString()} 人),首屏可能没说明白这页能做什么。`,
      });
    }
  }
  if (top && top.steps.length > 1) {
    const dropUsers = (top.counts[0] ?? 0) - (top.counts[top.counts.length - 1] ?? 0);
    const dropRatio = top.counts[0] ? dropUsers / top.counts[0] : 0;
    candidates.push({
      kind: 'funnel', impact: dropUsers, ratio: dropRatio,
      text: `推荐漏斗「${top.name}」从第一步到最后流失了 ${dropUsers.toLocaleString()} 个用户(占进入第一步的 ${Math.round(dropRatio * 100)}%)。`,
    });
  }
  candidates.sort((a, b) => b.impact - a.impact);
  const conclusion = candidates[0]?.text ?? '本周期暂无明显卡点。';

  return (
    <div className="animated-in">
      <h1 style={styles.h1}>卡在哪了</h1>

      <div style={styles.kpis}>
        <KpiCard label="平均跳出率" value={Math.round(avgBounce * 100)} formatValue={v => `${v}%`} />
        <KpiCard label="死按钮个数" value={deadCount} animated />
        <KpiCard label="表单失败次数" value={formFailCount} animated />
        <KpiCard label="漏斗流失用户" value={funnelDrop} animated />
      </div>

      <GlowCard>
        <div style={styles.conclusion}>{conclusion}</div>
      </GlowCard>

      {top && top.steps.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <GlowCard>
            <div style={styles.sectionTitle}>系统推荐漏斗:{top.name}</div>
            <FunnelChart steps={top.steps} counts={top.counts} />
          </GlowCard>
        </div>
      )}

      {/* 三块卡片统一展示口径:「严重度% · 影响 N 人/次」并按"影响量×严重度"排序,
          这样三个不同来源的卡点能直接比较优先级。 */}
      <div style={styles.threeCol}>
        <GlowCard>
          <div style={styles.sectionTitle}>死按钮(点了无后续动作)</div>
          {d && d.deadButtons.length > 0 ? (
            [...d.deadButtons]
              .sort((a, b) => b.deadRatio * b.clicks - a.deadRatio * a.clicks)
              .slice(0, 6)
              .map(b => (
                <div key={b.key} style={styles.row} onClick={() => setDrawerPath({ path: b.key, title: `死按钮:${b.label}` })}>
                  <span style={styles.rowLabel}>{b.label}</span>
                  <span style={styles.rowMeta}>{Math.round(b.deadRatio * 100)}% · 影响 {Math.round(b.deadRatio * b.clicks).toLocaleString()} 次点击</span>
                </div>
              ))
          ) : <div style={styles.empty}>未发现死按钮 ✓</div>}
        </GlowCard>

        <GlowCard>
          <div style={styles.sectionTitle}>高跳出页(进了就走)</div>
          {d && d.highBouncePages.length > 0 ? (
            [...d.highBouncePages]
              .sort((a, b) => b.bounceRatio * b.visits - a.bounceRatio * a.visits)
              .slice(0, 6)
              .map(p => (
                <div key={p.path} style={styles.row} onClick={() => setDrawerPath({ path: p.path, title: `高跳出:${displayPath(p.path)}` })}>
                  <span style={styles.rowLabel}>{displayPath(p.path)}</span>
                  <span style={styles.rowMeta}>{Math.round(p.bounceRatio * 100)}% · 影响 {p.bounces.toLocaleString()} 人</span>
                </div>
              ))
          ) : <div style={styles.empty}>无高跳出页 ✓</div>}
        </GlowCard>

        <GlowCard>
          <div style={styles.sectionTitle}>表单失败(提交了没下文)</div>
          {d && d.formFailures.length > 0 ? (
            [...d.formFailures]
              .sort((a, b) => b.failures - a.failures)
              .slice(0, 6)
              .map((f, i) => {
                const failRate = f.submits > 0 ? Math.round((f.failures / f.submits) * 100) : 0;
                return (
                  <div key={`${f.formId}-${i}`} style={{ ...styles.row, cursor: 'default' }}>
                    <span style={styles.rowLabel}>{f.formId || f.fieldHint || '(未命名表单)'}</span>
                    <span style={styles.rowMeta}>{failRate}% · 影响 {f.failures.toLocaleString()} 次提交</span>
                  </div>
                );
              })
          ) : <div style={styles.empty}>无表单失败 ✓</div>}
        </GlowCard>
      </div>

      <SessionDrawer
        open={!!drawerPath}
        onClose={() => setDrawerPath(null)}
        appId={filters.appId}
        pagePathContains={drawerPath?.path}
        title={drawerPath?.title}
      />
    </div>
  );
}
