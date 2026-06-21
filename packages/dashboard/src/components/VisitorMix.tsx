import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import GlowCard from './GlowCard';

interface VisitorMixProps {
  newVisitors: number;
  returningVisitors: number;
  unknownVisitors?: number;
}

export default function VisitorMix({ newVisitors, returningVisitors, unknownVisitors = 0 }: VisitorMixProps) {
  const total = newVisitors + returningVisitors + unknownVisitors;
  if (total === 0) return null;

  const data = [
    { name: '新访客', value: newVisitors, color: 'var(--accent)' },
    { name: '老访客', value: returningVisitors, color: 'var(--purple, #a78bfa)' },
    ...(unknownVisitors > 0 ? [{ name: '来源未知', value: unknownVisitors, color: 'var(--text-muted, #4a5068)' }] : []),
  ];

  const newPct = ((newVisitors / total) * 100).toFixed(1);

  return (
    <GlowCard>
      <h3 style={styles.title}>新老访客分布</h3>
      <div style={styles.hint}>同浏览器 = 1 个访客;清 cookie / 隐身 / 自动化脚本会被计为不同访客</div>
      <div style={styles.body}>
        <ResponsiveContainer width="50%" height={180}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color as string} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div style={styles.summary}>
          <div style={styles.summaryRow}>
            <span style={{ ...styles.dot, background: 'var(--accent)' }} />
            <span style={styles.summaryLabel}>新访客</span>
            <span style={styles.summaryValue}>{newVisitors.toLocaleString()}</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={{ ...styles.dot, background: 'var(--purple, #a78bfa)' }} />
            <span style={styles.summaryLabel}>老访客</span>
            <span style={styles.summaryValue}>{returningVisitors.toLocaleString()}</span>
          </div>
          {unknownVisitors > 0 && (
            <div style={styles.summaryRow}>
              <span style={{ ...styles.dot, background: 'var(--text-muted, #4a5068)' }} />
              <span style={styles.summaryLabel}>来源未知</span>
              <span style={styles.summaryValue}>{unknownVisitors.toLocaleString()}</span>
            </div>
          )}
          <div style={styles.highlight}>
            新访客占比 <strong>{newPct}%</strong>
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 },
  hint: { fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 },
  body: { display: 'flex', alignItems: 'center', gap: 16 },
  summary: { flex: 1, display: 'flex', flexDirection: 'column', gap: 10 },
  summaryRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
  summaryLabel: { color: 'var(--text-secondary)', flex: 1 },
  summaryValue: { color: 'var(--text-primary)', fontWeight: 600 },
  dot: { width: 8, height: 8, borderRadius: '50%' },
  highlight: { marginTop: 8, fontSize: 12, color: 'var(--text-muted)' },
};
