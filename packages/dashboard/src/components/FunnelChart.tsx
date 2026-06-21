import { displayPath } from '../shared/formatters';
import type { FunnelStep } from '../api/types';

interface FunnelChartProps {
  steps: FunnelStep[];
  counts: number[];
}

export default function FunnelChart({ steps, counts }: FunnelChartProps) {
  if (steps.length === 0) return null;
  const first = counts[0] ?? 0;
  if (first === 0) {
    return (
      <div style={styles.empty}>
        漏斗第一步暂无用户经过
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {steps.map((step, i) => {
        const count = counts[i] ?? 0;
        const totalPct = (count / first) * 100;
        const stepPct = i === 0 ? 100 : (count / Math.max(1, counts[i - 1])) * 100;
        return (
          <div key={i} style={styles.row}>
            <div style={styles.stepLabel}>
              <span style={styles.stepNum}>{i + 1}</span>
              <span style={styles.stepName}>{labelFor(step)}</span>
            </div>
            <div style={styles.barWrap}>
              <div
                style={{
                  ...styles.bar,
                  width: `${totalPct}%`,
                  background: i === 0 ? 'var(--accent)' : barColor(stepPct),
                }}
              />
              <div style={styles.barText}>
                <strong>{count.toLocaleString()}</strong>
                <span style={styles.subtle}> 用户</span>
                <span style={styles.pct}>{totalPct.toFixed(1)}%</span>
                {i > 0 && <span style={styles.dropFromPrev}> · 上一步留存 {stepPct.toFixed(1)}%</span>}
              </div>
            </div>
          </div>
        );
      })}
      {steps.length > 1 && (
        <div style={styles.summary}>
          总体转化率 <strong>{((counts[counts.length - 1] / first) * 100).toFixed(1)}%</strong>
          {' · '}
          流失 <strong>{(first - counts[counts.length - 1]).toLocaleString()}</strong> 用户
        </div>
      )}
    </div>
  );
}

function labelFor(step: FunnelStep): string {
  if (step.kind === 'page') return `访问 ${displayPath(step.path)}`;
  return `点击 ${step.dataTrack}`;
}

function barColor(stepPct: number): string {
  if (stepPct >= 70) return 'var(--accent-green, #4ade80)';
  if (stepPct >= 30) return '#fbbf24';
  return 'var(--accent-red, #f87171)';
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'flex', flexDirection: 'column', gap: 6 },
  stepLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' },
  stepNum: {
    display: 'inline-flex',
    width: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '50%',
    fontSize: 11,
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  stepName: { color: 'var(--text-primary)' },
  barWrap: { position: 'relative', height: 32, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4, transition: 'width 0.3s' },
  barText: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    fontSize: 12,
    color: 'var(--text-primary)',
    gap: 4,
    textShadow: '0 0 4px rgba(0,0,0,0.5)',
  },
  subtle: { color: 'var(--text-secondary)' },
  pct: { marginLeft: 8, color: 'var(--text-primary)', fontWeight: 600 },
  dropFromPrev: { color: 'var(--text-muted)', marginLeft: 'auto' },
  summary: {
    marginTop: 8,
    padding: '8px 12px',
    background: 'var(--bg-card)',
    borderRadius: 4,
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  empty: { padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 },
};
