import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint {
  time: string;
  views: number;
}

export default function PageViewsChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) return null;

  return (
    <>
      <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>页面浏览趋势</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="viewGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fill: '#4a5068', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#4a5068', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{
              background: '#111827',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              borderRadius: 6,
              fontSize: 12,
              color: '#e0e0e0',
            }}
          />
          <Area type="monotone" dataKey="views" stroke="#00f0ff" fill="url(#viewGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </>
  );
}
