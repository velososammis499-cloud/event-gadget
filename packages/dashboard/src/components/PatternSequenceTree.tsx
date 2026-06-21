import { useMemo } from 'react';
import type { EventDTO } from '../api/types';
import GradientBorderCard from './GradientBorderCard';
import { chartColors } from '../theme/cyberpunk';

export default function PatternSequenceTree({ events }: { events: EventDTO[] }) {
  const patterns = useMemo(() => {
    const bySession = new Map<string, EventDTO[]>();
    for (const e of events) {
      const list = bySession.get(e.sessionId) ?? [];
      list.push(e);
      bySession.set(e.sessionId, list);
    }

    const seqMap = new Map<string, number>();
    for (const [, evts] of bySession) {
      const sorted = [...evts].sort((a, b) => a.timestamp - b.timestamp);
      for (let len = 2; len <= 4; len++) {
        for (let i = 0; i <= sorted.length - len; i++) {
          const seq = sorted.slice(i, i + len);
          const key = seq.map(e => `${e.type}→${e.label || e.pagePath}`).join(' | ');
          seqMap.set(key, (seqMap.get(key) ?? 0) + 1);
        }
      }
    }

    return Array.from(seqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([seq, count]) => ({ seq, count }));
  }, [events]);

  if (patterns.length === 0) return null;

  const maxCount = Math.max(...patterns.map(p => p.count), 1);

  return (
    <GradientBorderCard title="常见操作模式" subtitle="跨会话高频操作序列" accent="var(--warning)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {patterns.map((p, i) => {
          const steps = p.seq.split(' | ');
          const barWidth = 20 + (p.count / maxCount) * 80;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                #{i + 1}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, overflow: 'hidden' }}>
                {steps.map((step, si) => {
                  const [type, label] = step.split('→');
                  const color = chartColors[type as keyof typeof chartColors] || '#8a8fa8';
                  return (
                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      {si > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>→</span>}
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 3,
                          fontSize: 10,
                          color,
                          background: `${color}15`,
                          border: `1px solid ${color}30`,
                          whiteSpace: 'nowrap',
                          maxWidth: 120,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ flexShrink: 0, width: barWidth, height: 14, borderRadius: 3, background: `linear-gradient(90deg, rgba(0, 240, 255, 0.3), rgba(123, 47, 255, 0.2))` }} />
              <span style={{ fontSize: 11, color: 'var(--accent)', width: 32, textAlign: 'right', flexShrink: 0 }}>{p.count}次</span>
            </div>
          );
        })}
      </div>
    </GradientBorderCard>
  );
}
