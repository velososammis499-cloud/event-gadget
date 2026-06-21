import { useMemo } from 'react';
import type { EventDTO } from '../api/types';
import GradientBorderCard from './GradientBorderCard';

interface Score {
  page: string;
  score: number;
  clicks: number;
  forms: number;
  dwell: number;
  impressions: number;
  views: number;
}

function GaugeArc({ score, size = 80 }: { score: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const startAngle = 135;
  const endAngle = 405;
  const scoreAngle = startAngle + (score / 100) * (endAngle - startAngle);

  const polarToCart = (angle: number) => ({
    x: cx + r * Math.cos((angle * Math.PI) / 180),
    y: cy + r * Math.sin((angle * Math.PI) / 180),
  });

  const bgStart = polarToCart(startAngle);
  const bgEnd = polarToCart(endAngle);
  const scoreEnd = polarToCart(scoreAngle);

  const bgPath = `M${bgStart.x},${bgStart.y} A${r},${r} 0 1,1 ${bgEnd.x},${bgEnd.y}`;
  const scorePath = score > 0 ? `M${bgStart.x},${bgStart.y} A${r},${r} 0 ${score > 50 ? 1 : 0},1 ${scoreEnd.x},${scoreEnd.y}` : '';

  const color = score > 70 ? '#00ff88' : score > 40 ? '#ffb800' : '#ff3366';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={bgPath} fill="none" stroke="rgba(0, 240, 255, 0.1)" strokeWidth={5} strokeLinecap="round" />
      {scorePath && (
        <path d={scorePath} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      )}
      <text x={cx} y={cy + 2} textAnchor="middle" fill={color} fontSize={16} fontWeight={700}>
        {score}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-muted)" fontSize={8}>
        分
      </text>
    </svg>
  );
}

export default function EngagementScoreCard({ events }: { events: EventDTO[] }) {
  const scores = useMemo((): Score[] => {
    const byPage = new Map<string, { clicks: number; forms: number; dwell: number; impressions: number; views: number }>();
    for (const e of events) {
      const entry = byPage.get(e.pagePath) ?? { clicks: 0, forms: 0, dwell: 0, impressions: 0, views: 0 };
      if (e.type === 'click') entry.clicks++;
      else if (e.type === 'form_interaction') entry.forms++;
      else if (e.type === 'dwell') entry.dwell += Number(e.label) || 0;
      else if (e.type === 'impression') entry.impressions++;
      else if (e.type === 'pageview') entry.views++;
      byPage.set(e.pagePath, entry);
    }

    return Array.from(byPage.entries())
      .map(([page, stats]) => {
        const raw = (stats.clicks * 3 + stats.forms * 5 + stats.dwell * 0.001 + stats.impressions) / Math.max(stats.views, 1);
        const score = Math.min(100, Math.round(raw * 10));
        return { page, score, ...stats };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [events]);

  if (scores.length === 0) return null;

  return (
    <GradientBorderCard title="互动评分" subtitle="综合互动深度评分" accent="var(--danger)">
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(scores.length, 3)}, 1fr)`, gap: 16 }}>
        {scores.map(s => (
          <div key={s.page} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <GaugeArc score={s.score} />
            <span style={{ fontSize: 11, color: 'var(--accent)', textAlign: 'center', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.page}
            </span>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              点击{s.clicks} · 表单{s.forms} · 曝光{s.impressions}
            </div>
          </div>
        ))}
      </div>
    </GradientBorderCard>
  );
}
