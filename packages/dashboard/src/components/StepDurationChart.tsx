import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { EventDTO } from '../api/types';
import GradientBorderCard from './GradientBorderCard';

export default function StepDurationChart({ events }: { events: EventDTO[] }) {
  const data = useMemo(() => {
    const dwellByPage = new Map<string, { total: number; count: number }>();
    for (const e of events) {
      if (e.type === 'dwell') {
        const dur = Number(e.label) || 0;
        const entry = dwellByPage.get(e.pagePath) ?? { total: 0, count: 0 };
        entry.total += dur;
        entry.count += 1;
        dwellByPage.set(e.pagePath, entry);
      }
    }
    return Array.from(dwellByPage.entries())
      .map(([page, { total, count }]) => ({ page, avg: Math.round(total / count) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);
  }, [events]);

  if (data.length === 0) return null;

  return (
    <GradientBorderCard title="页面停留时长" subtitle="平均停留时间(ms)" accent="var(--accent)">
      <ResponsiveContainer width="100%" height={Math.max(150, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 120, right: 20 }}>
          <XAxis type="number" tick={{ fill: '#4a5068', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="page" tick={{ fill: '#8a8fa8', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
          <Tooltip
            contentStyle={{
              background: '#111827',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              borderRadius: 6,
              fontSize: 12,
              color: '#e0e0e0',
            }}
            formatter={(v: number) => [`${v}ms`, '平均停留']}
          />
          <Bar dataKey="avg" fill="#00f0ff" fillOpacity={0.6} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </GradientBorderCard>
  );
}
