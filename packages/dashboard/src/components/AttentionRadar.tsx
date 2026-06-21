import { useMemo } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import type { EventDTO } from '../api/types';
import GradientBorderCard from './GradientBorderCard';

export default function AttentionRadar({ events }: { events: EventDTO[] }) {
  const data = useMemo(() => {
    const sessions = new Map<string, EventDTO[]>();
    for (const e of events) {
      const list = sessions.get(e.sessionId) ?? [];
      list.push(e);
      sessions.set(e.sessionId, list);
    }

    const n = sessions.size || 1;
    let totalClicks = 0, totalDwell = 0, totalPages = 0, totalTypes = 0, totalForms = 0;
    const sessionPages = new Map<string, Set<string>>();
    const sessionTypes = new Map<string, Set<string>>();

    for (const [sid, evts] of sessions) {
      const clicks = evts.filter(e => e.type === 'click').length;
      const dwells = evts.filter(e => e.type === 'dwell');
      const forms = evts.filter(e => e.type === 'form_interaction').length;
      const pages = new Set(evts.filter(e => e.type === 'pageview').map(e => e.pagePath));
      const types = new Set(evts.map(e => e.type));

      totalClicks += clicks;
      totalDwell += dwells.length;
      totalForms += forms;
      sessionPages.set(sid, pages);
      sessionTypes.set(sid, types);
    }

    for (const p of sessionPages.values()) totalPages += p.size;
    for (const t of sessionTypes.values()) totalTypes += t.size;

    const avgClicks = totalClicks / n;
    const avgDwell = totalDwell / n;
    const avgPages = totalPages / n;
    const avgTypes = totalTypes / n;
    const avgForms = totalForms / n;

    const maxVal = Math.max(avgClicks, avgDwell, avgPages, avgTypes, avgForms, 1);
    const norm = (v: number) => Math.round((v / maxVal) * 100);

    return [
      { dimension: '点击密度', value: norm(avgClicks), raw: avgClicks.toFixed(1) },
      { dimension: '停留深度', value: norm(avgDwell), raw: avgDwell.toFixed(1) },
      { dimension: '页面广度', value: norm(avgPages), raw: avgPages.toFixed(1) },
      { dimension: '互动多样性', value: norm(avgTypes), raw: avgTypes.toFixed(1) },
      { dimension: '表单参与', value: norm(avgForms), raw: avgForms.toFixed(1) },
    ];
  }, [events]);

  if (data.every(d => d.value === 0)) return null;

  return (
    <GradientBorderCard title="用户关注维度" subtitle="多维度雷达分析" accent="var(--purple)">
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="rgba(0, 240, 255, 0.1)" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#8a8fa8', fontSize: 11 }}
          />
          <Radar
            dataKey="value"
            stroke="#00f0ff"
            fill="#00f0ff"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              background: '#111827',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              borderRadius: 6,
              fontSize: 12,
              color: '#e0e0e0',
            }}
            formatter={(value: number) => [`${value}分`, '']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </GradientBorderCard>
  );
}
