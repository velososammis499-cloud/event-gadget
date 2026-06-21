import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DataItem {
  label: string;
  count: number;
}

function heatColor(ratio: number): string {
  const r = Math.round(0 + 123 * ratio);
  const g = Math.round(240 - 193 * ratio);
  const b = Math.round(255 - 0 * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function RankingBar({ data, title }: { data: DataItem[]; title: string }) {
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const chartData = data.map(d => ({ ...d, ratio: d.count / maxCount }));

  return (
    <>
      <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>{title}</h3>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 120, right: 20 }}>
          <XAxis type="number" tick={{ fill: '#4a5068', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fill: '#8a8fa8', fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
          <Tooltip
            contentStyle={{
              background: '#111827',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              borderRadius: 6,
              fontSize: 12,
              color: '#e0e0e0',
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={heatColor(entry.ratio)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
