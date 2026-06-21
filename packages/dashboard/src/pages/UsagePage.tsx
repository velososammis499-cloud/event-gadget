import { useState } from 'react';
import KpiCard from '../components/KpiCard';
import GlowCard from '../components/GlowCard';
import TopPagesTable from '../components/TopPagesTable';
import RankingBar from '../components/RankingBar';
import LabelsDrawer from '../components/LabelsDrawer';
import { LoadingState, EmptyState } from '../components/StatePrimitives';
import { useFilters } from '../hooks/useFilters';
import { useOverview, usePages, useRankings, useUnidentifiedViews } from '../api/queries';
import { displayPath } from '../shared/formatters';

const DEAD_CTR = 0.05;
const HIGH_CTR = 0.5;
const LONG_TAIL_VIEWS = 5;

function compareLabel(filters: { startTime?: number; endTime?: number }): string {
  if (!filters.startTime || !filters.endTime) return 'vs 上一周期';
  const days = Math.round((filters.endTime - filters.startTime) / 86_400_000);
  return `vs 上 ${Math.max(1, days)} 天`;
}

export default function UsagePage() {
  const { filters } = useFilters();
  const overview = useOverview({ appId: filters.appId, from: filters.startTime, to: filters.endTime });
  const pages = usePages({ appId: filters.appId, startTime: filters.startTime, endTime: filters.endTime });
  const rankings = useRankings({ appId: filters.appId, startTime: filters.startTime, endTime: filters.endTime });
  const unidentified = useUnidentifiedViews({
    appId: filters.appId, from: filters.startTime, to: filters.endTime, minClicks: 5, limit: 10,
  });

  const [labelsOpen, setLabelsOpen] = useState(false);

  if (!filters.appId) {
    return <EmptyState message="请在顶部填入 App ID(对应 SDK 接入时的 data-app-id)" />;
  }

  const pageData = pages.data ?? [];
  const rankData = rankings.data ?? [];
  const current = overview.data?.current;
  const previous = overview.data?.previous;

  // KPI 计算
  const totalViews = current?.pageViews ?? 0;
  const activeFeatures = pageData.length;
  const topFeature = pageData[0];
  const longTail = pageData.filter(p => p.views < LONG_TAIL_VIEWS).length;

  // 一句话结论 — 区分"低使用" vs "完全没出现"
  // 注意:pageData 只包含至少被访问过 1 次的页面,SDK 没采到的功能根本不在里面;
  // 想看"功能 X 有没有人用",仍需业务方提供功能清单做对照,这里只能给"已被采到但很少用的"。
  const totalClicks = pageData.reduce((s, p) => s + p.views, 0) || 1;
  const topShare = topFeature ? Math.round((topFeature.views / totalClicks) * 100) : 0;
  const conclusion = topFeature
    ? `用户最常去 「${displayPath(topFeature.pagePath)}」(${topFeature.views.toLocaleString()} 次,占 ${topShare}%);${longTail > 0 ? `有 ${longTail} 个功能本周期使用次数 < ${LONG_TAIL_VIEWS} 次,属于低使用功能。` : '所有已采到的功能都有一定使用。'}`
    : '本周期暂无页面浏览数据。';

  // CTR Top 5 + 低点击率元素 Top 5
  // 命名提醒:这里"低点击率"是「曝光多但被点的少」(impression-based)。
  // BlockedPage 上的"死按钮"是「点了之后没有任何后续动作」(post-click silence),
  // 两者数据来源、含义不同 — 不要混用名字。
  const ctrSorted = rankData.filter(r => r.impressions >= 5 && r.ctr !== null);
  const topCtr = [...ctrSorted].sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0)).slice(0, 5);
  const lowCtrElements = [...ctrSorted].filter(r => (r.ctr ?? 1) < DEAD_CTR).slice(0, 5);

  // 上周期对比 map(从 previous 拉取需要单独的请求,这里用 overview previous 的 pageViews 不可达页级,
  // 简化做法:不传 previousViews,等后续真有"上周期 pages 接口"再补)

  return (
    <div className="animated-in">
      <header style={styles.header}>
        <div>
          <h1 style={styles.h1}>用了什么</h1>
          <p style={styles.subhead}>{compareLabel(filters)}</p>
        </div>
        <button style={styles.labelBtn} onClick={() => setLabelsOpen(true)}>⚙ 标签管理</button>
      </header>

      {/* KPI */}
      <div style={styles.kpis}>
        <KpiCard label="总浏览量" value={totalViews} previousValue={previous?.pageViews} compareLabel={compareLabel(filters)} animated
          hint="所有页面浏览事件的总次数(PV)" />
        <KpiCard label="活跃功能数" value={activeFeatures} animated
          hint="本周期至少被访问 1 次的页面/视图数" />
        <KpiCard label="最常用功能"
          value={topFeature?.views ?? 0}
          formatValue={() => topFeature ? displayPath(topFeature.pagePath) : '—'} />
        <KpiCard label="低使用功能" value={longTail} animated
          hint={`本周期使用 < ${LONG_TAIL_VIEWS} 次的功能;"完全没人用"需另行维护功能清单对照`} />
      </div>

      {/* 一句话结论 */}
      <GlowCard>
        <div style={styles.conclusion}>{conclusion}</div>
      </GlowCard>

      {/* 主表 + CTR 榜 */}
      {pages.isLoading ? <LoadingState /> : pageData.length === 0 ? (
        <EmptyState message="本周期暂无页面浏览,先在目标网页接入 sg.js 并产生一些访问。" />
      ) : (
        <div style={{ marginTop: 16 }}>
          <TopPagesTable data={pageData} />
        </div>
      )}

      {ctrSorted.length > 0 && (
        <div style={styles.twoCol}>
          {topCtr.length > 0 && (
            <GlowCard>
              <RankingBar
                title={`高 CTR 元素(Top ${topCtr.length})`}
                data={topCtr.map(r => ({ label: r.label, count: Math.round((r.ctr ?? 0) * 100) }))}
              />
            </GlowCard>
          )}
          {lowCtrElements.length > 0 && (
            <GlowCard>
              <RankingBar
                title={`低点击率元素(被看到但很少被点,CTR < ${DEAD_CTR * 100}%)`}
                data={lowCtrElements.map(r => ({ label: r.label, count: r.impressions }))}
              />
            </GlowCard>
          )}
        </div>
      )}

      {/* 未识别视图提示 */}
      {unidentified.data && unidentified.data.length > 0 && (
        <GlowCard>
          <div style={styles.warnTitle}>⚠ 可能漏采的视图</div>
          <div style={styles.warnHint}>
            以下页面用户点击量很高,但视图名识别不到 — 业务方可在这些页面调用
            <code style={styles.code}>window.eventGadget.setView('视图名')</code> 手动标记。
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>页面路径</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>点击数</th>
              </tr>
            </thead>
            <tbody>
              {unidentified.data.map(row => (
                <tr key={row.pagePath}>
                  <td style={styles.td}>
                    <code style={styles.code}>{row.pagePath}</code>
                    {row.pageTitle && <span style={styles.title}>{row.pageTitle}</span>}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-secondary)' }}>{row.clicks.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlowCard>
      )}

      <LabelsDrawer open={labelsOpen} onClose={() => setLabelsOpen(false)} appId={filters.appId} filters={{ startTime: filters.startTime, endTime: filters.endTime }} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  h1: { fontSize: 20, fontWeight: 600, margin: 0 },
  subhead: { fontSize: 12, color: 'var(--text-muted)', marginTop: 4 },
  labelBtn: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
    padding: '8px 14px', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
  },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 },
  conclusion: { fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 },
  warnTitle: { fontSize: 14, color: 'var(--warning, #ffb800)', marginBottom: 6, fontWeight: 600 },
  warnHint: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left' as const, padding: '8px 12px', fontSize: 11,
    color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 500,
  },
  td: { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid rgba(0,240,255,0.06)' },
  code: {
    background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 3,
    fontSize: 12, color: 'var(--accent)', marginRight: 8,
  },
  title: { fontSize: 11, color: 'var(--text-muted)' },
};
