import { useMemo } from 'react';
import type { EventDTO } from '../api/types';
import GradientBorderCard from './GradientBorderCard';

interface Cell {
  page: string;
  label: string;
  count: number;
}

export default function ClickHeatMap({ events }: { events: EventDTO[] }) {
  const { cells, pages, labels } = useMemo(() => {
    const clickEvents = events.filter(e => e.type === 'click');
    const cellMap = new Map<string, number>();

    for (const e of clickEvents) {
      const key = `${e.pagePath}||${e.label || e.pagePath}`;
      cellMap.set(key, (cellMap.get(key) ?? 0) + 1);
    }

    const pageSet = new Set<string>();
    const labelSet = new Set<string>();
    const cells: Cell[] = [];

    for (const [key, count] of cellMap) {
      const [page, label] = key.split('||');
      cells.push({ page, label, count });
      pageSet.add(page);
      labelSet.add(label);
    }

    const pages = Array.from(pageSet).sort();
    const labels = Array.from(labelSet).sort((a, b) => {
      const ca = cells.filter(c => c.label === a).reduce((s, c) => s + c.count, 0);
      const cb = cells.filter(c => c.label === b).reduce((s, c) => s + c.count, 0);
      return cb - ca;
    }).slice(0, 15);

    return { cells, pages: pages.slice(0, 10), labels };
  }, [events]);

  if (cells.length === 0 || pages.length === 0) return null;

  const maxCount = Math.max(...cells.map(c => c.count), 1);
  const cellW = 44;
  const cellH = 26;
  const labelW = 100;
  const headerH = 50;
  const svgW = labelW + labels.length * cellW;
  const svgH = headerH + pages.length * cellH;

  const getCell = (page: string, label: string) => cells.find(c => c.page === page && c.label === label);

  return (
    <GradientBorderCard title="点击热力图" subtitle="页面×元素点击密度" accent="var(--success)">
      <div style={{ overflowX: 'auto' }}>
        <svg width={svgW} height={svgH} style={{ minWidth: svgW }}>
          {/* Column headers */}
          {labels.map((label, ci) => (
            <text
              key={label}
              x={labelW + ci * cellW + cellW / 2}
              y={headerH - 8}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize={9}
              transform={`rotate(-35, ${labelW + ci * cellW + cellW / 2}, ${headerH - 8})`}
            >
              {label.length > 8 ? label.slice(0, 7) + '…' : label}
            </text>
          ))}

          {/* Row labels + cells */}
          {pages.map((page, ri) => (
            <g key={page}>
              <text
                x={labelW - 6}
                y={headerH + ri * cellH + cellH / 2 + 3}
                textAnchor="end"
                fill="var(--text-secondary)"
                fontSize={10}
              >
                {page.length > 12 ? '…' + page.slice(-10) : page}
              </text>
              {labels.map((label, ci) => {
                const cell = getCell(page, label);
                const ratio = cell ? cell.count / maxCount : 0;
                return (
                  <g key={`${page}-${label}`}>
                    <rect
                      x={labelW + ci * cellW + 1}
                      y={headerH + ri * cellH + 1}
                      width={cellW - 2}
                      height={cellH - 2}
                      rx={2}
                      fill={ratio > 0 ? `rgba(0, 240, 255, ${0.05 + ratio * 0.85})` : 'rgba(255,255,255,0.02)'}
                      stroke="rgba(0, 240, 255, 0.08)"
                      strokeWidth={0.5}
                    />
                    {cell && ratio > 0.2 && (
                      <text
                        x={labelW + ci * cellW + cellW / 2}
                        y={headerH + ri * cellH + cellH / 2 + 3}
                        textAnchor="middle"
                        fill={ratio > 0.6 ? '#fff' : 'var(--text-secondary)'}
                        fontSize={9}
                      >
                        {cell.count}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </GradientBorderCard>
  );
}
