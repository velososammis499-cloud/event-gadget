import AnimatedNumber from './AnimatedNumber';
import { formatCompactNumber } from '../shared/formatters/primitives/number';

interface KpiCardProps {
  label: string;
  value: number;
  animated?: boolean;
  /** Optional formatter for the headline value. Default: AnimatedNumber or compactNumber. */
  formatValue?: (v: number) => string;
  /** Prior-period value. If provided, the card renders a trend row. */
  previousValue?: number | null;
  /** Sub-label under the trend, e.g. "vs 上7天". */
  compareLabel?: string;
  /** Optional clarifier shown directly under the label in muted grey.
   *  Use to disambiguate ambiguous metric names (e.g. "同浏览器=1人,隐身模式会重复计"). */
  hint?: string;
}

export default function KpiCard({
  label,
  value,
  animated,
  formatValue,
  previousValue,
  compareLabel,
  hint,
}: KpiCardProps) {
  const renderValue = () => {
    if (formatValue) return formatValue(value);
    if (animated) return null; // AnimatedNumber rendered below
    return formatCompactNumber(value);
  };

  const trend = computeTrend(value, previousValue);

  return (
    <div className="glow-card" style={styles.card}>
      <div style={styles.value}>
        {animated && !formatValue ? <AnimatedNumber value={value} /> : renderValue()}
      </div>
      <div style={styles.label}>{label}</div>
      {hint && <div style={styles.hint}>{hint}</div>}
      {trend && (
        <div style={{ ...styles.trend, color: trend.color, fontWeight: trend.bold ? 600 : 500 }}>
          {trend.arrow} {trend.text}
          {compareLabel && <span style={styles.compareLabel}> {compareLabel}</span>}
        </div>
      )}
    </div>
  );
}

function computeTrend(
  current: number,
  previous: number | null | undefined,
): { arrow: string; text: string; color: string; bold: boolean } | null {
  if (previous === undefined || previous === null) return null;
  if (previous === 0 && current === 0) {
    return { arrow: '—', text: '无变化', color: 'var(--text-muted)', bold: false };
  }
  if (previous === 0) {
    return { arrow: '↑', text: '新增', color: 'var(--accent-green, #4ade80)', bold: true };
  }
  const pct = ((current - previous) / previous) * 100;
  const arrow = pct >= 0 ? '↑' : '↓';
  const absPct = Math.abs(pct);
  const text = absPct < 1 ? '<1%' : `${absPct.toFixed(1)}%`;
  const color = pct >= 0 ? 'var(--accent-green, #4ade80)' : 'var(--accent-red, #f87171)';
  const bold = absPct >= 30;
  return { arrow, text, color, bold };
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: '20px 24px',
  },
  value: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--accent)',
    lineHeight: 1.2,
  },
  label: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginTop: 4,
  },
  hint: {
    fontSize: 10,
    color: 'var(--text-muted)',
    marginTop: 2,
    lineHeight: 1.4,
  },
  trend: {
    fontSize: 12,
    marginTop: 8,
  },
  compareLabel: {
    color: 'var(--text-muted)',
    fontWeight: 400,
    marginLeft: 4,
  },
};
