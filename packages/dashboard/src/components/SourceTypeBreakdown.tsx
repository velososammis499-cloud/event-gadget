import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { EventDTO } from '../api/types';
import { sourceColors } from '../theme/cyberpunk';
import GradientBorderCard from './GradientBorderCard';

export default function SourceTypeBreakdown({ events }: { events: EventDTO[] }) {
  const data = useMemo(() => {
    const map = new Map<string, { count: number; sessions: Set<string> }>();
    for (const e of events) {
      const t = e.sourceType || 'unknown';
      const entry = map.get(t) ?? { count: 0, sessions: new Set<string>() };
      entry.count++;
      entry.sessions.add(e.sessionId);
      map.set(t, entry);
    }
    return Array.from(map.entries()).map(([type, { count, sessions }]) => ({
      name: type,
      value: count,
      sessions: sessions.size,
    }));
  }, [events]);

  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);
  const labels: Record<string, string> = { internal: '内部跳转', external: '外部来源', direct: '直接访问', unknown: '未知' };

  return (
    <GradientBorderCard title="来源分析" accent="var(--purple)">
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ width: 160, height: 160, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={3}
                strokeWidth={0}
              >
                {data.map(d => (
                  <Cell
                    key={d.name}
                    fill={sourceColors[d.name as keyof typeof sourceColors] || '#8a8fa8'}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#111827',
                  border: '1px solid rgba(0, 240, 255, 0.2)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#e0e0e0',
                }}
                formatter={(value: number, name: string) => [`${value} 次`, labels[name] || name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1 }}>
          {data.map(d => (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0, 240, 255, 0.06)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: sourceColors[d.name as keyof typeof sourceColors] || '#8a8fa8',
                  display: 'inline-block',
                }} />
                {labels[d.name] || d.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {d.value.toLocaleString()} 次 · {d.sessions} 会话 · {((d.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </GradientBorderCard>
  );
}
