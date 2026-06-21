import type { PageStatsDTO } from '../api/types';
import { displayPath } from '../shared/formatters';

interface Props {
  data: PageStatsDTO[];
  /** Optional map of pagePath → previous-period view count, for "vs prior" delta column. */
  previousViews?: Map<string, number>;
}

function trendCell(curr: number, prev: number | undefined): { text: string; color: string } {
  if (prev === undefined) return { text: '—', color: 'var(--text-muted)' };
  if (prev === 0) return { text: curr > 0 ? '↑ 新出现' : '—', color: curr > 0 ? 'var(--accent-green, #4ade80)' : 'var(--text-muted)' };
  const diff = curr - prev;
  const pct = ((diff / prev) * 100).toFixed(0);
  if (diff > 0) return { text: `↑ ${pct}%`, color: 'var(--accent-green, #4ade80)' };
  if (diff < 0) return { text: `↓ ${Math.abs(Number(pct))}%`, color: 'var(--accent-red, #f87171)' };
  return { text: '持平', color: 'var(--text-muted)' };
}

export default function TopPagesTable({ data, previousViews }: Props) {
  if (data.length === 0) return null;
  const showTrend = !!previousViews;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
      <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>页面排行</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>路径</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>浏览量</th>
            {showTrend && <th style={{ ...styles.th, textAlign: 'right' }}>vs 上周期</th>}
            <th style={{ ...styles.th, textAlign: 'right' }}>会话数</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>用户数</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map(row => {
            const trend = showTrend ? trendCell(row.views, previousViews!.get(row.pagePath)) : null;
            return (
              <tr key={row.pagePath} style={styles.row}>
                <td style={styles.td}>
                  <span style={{ color: 'var(--accent)', fontSize: 13 }}>{displayPath(row.pagePath)}</span>
                  {row.pageTitle && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>{row.pageTitle}</span>
                  )}
                </td>
                <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-primary)' }}>{row.views.toLocaleString()}</td>
                {showTrend && (
                  <td style={{ ...styles.td, textAlign: 'right', color: trend!.color, fontSize: 12 }}>{trend!.text}</td>
                )}
                <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-secondary)' }}>{row.uniqueSessions.toLocaleString()}</td>
                <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-secondary)' }}>{row.uniqueUsers.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    fontSize: 11,
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    fontWeight: 500,
  },
  td: {
    padding: '10px 12px',
    fontSize: 13,
    borderBottom: '1px solid rgba(0, 240, 255, 0.06)',
  },
  row: {
    transition: 'background 0.1s',
  },
};
