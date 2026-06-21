import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { EventDTO } from '../api/types';
import { chartColors } from '../theme/cyberpunk';
import GradientBorderCard from './GradientBorderCard';

const TYPES: (keyof typeof chartColors)[] = ['pageview', 'click', 'impression', 'form_interaction', 'dwell'];

export default function FeatureUsageTimeline({ events }: { events: EventDTO[] }) {
  const data = useMemo(() => {
    const byDay = new Map<string, Record<string, number>>();
    for (const e of events) {
      const d = new Date(e.timestamp);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      const row = byDay.get(key) ?? {};
      row[e.type] = (row[e.type] || 0) + 1;
      byDay.set(key, row);
    }
    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, counts]) => ({ name: day, ...counts }));
  }, [events]);

  if (data.length === 0) return null;

  return (
    <GradientBorderCard title="功能使用趋势" subtitle="按事件类型分布" accent="var(--accent)">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            {TYPES.map(t => (
              <linearGradient key={t} id={`grad-${t}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors[t]} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chartColors[t]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="name" tick={{ fill: '#4a5068', fontSize: 11 }} axisLine={false} tickLine={false} />
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
          {TYPES.map(t => (
            <Area
              key={t}
              type="monotone"
              dataKey={t}
              stackId="1"
              stroke={chartColors[t]}
              fill={`url(#grad-${t})`}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </GradientBorderCard>
  );
}
