import { useState, useMemo } from 'react';
import type { JourneyDTO } from '../api/types';

interface SankeyNode {
  path: string;
  depth: number;
  x: number;
  y: number;
  value: number;
}

interface SankeyEdge {
  source: string;
  target: string;
  count: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sourceY: number;
  targetY: number;
}

const WIDTH = 900;
const HEIGHT = 450;
const NODE_W = 140;
const NODE_H = 28;
const COL_GAP = 160;
const LEFT_PAD = 20;

function layoutSankey(journeys: JourneyDTO[]): { nodes: SankeyNode[]; edges: SankeyEdge[]; maxCount: number } {
  const pathSet = new Set<string>();
  for (const j of journeys) {
    pathSet.add(j.sourcePath);
    pathSet.add(j.targetPath);
  }

  // Compute depth via BFS from entry nodes
  const incoming = new Map<string, number>();
  for (const j of journeys) {
    incoming.set(j.targetPath, (incoming.get(j.targetPath) ?? 0) + 1);
  }
  const depths = new Map<string, number>();
  const queue: string[] = [];
  for (const p of pathSet) {
    if ((incoming.get(p) ?? 0) === 0) {
      depths.set(p, 0);
      queue.push(p);
    }
  }
  if (queue.length === 0 && pathSet.size > 0) {
    const first = pathSet.values().next().value!;
    depths.set(first, 0);
    queue.push(first);
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curDepth = depths.get(cur) ?? 0;
    for (const j of journeys) {
      if (j.sourcePath === cur) {
        const newDepth = curDepth + 1;
        if ((depths.get(j.targetPath) ?? Infinity) > newDepth) {
          depths.set(j.targetPath, newDepth);
          queue.push(j.targetPath);
        }
      }
    }
  }
  for (const p of pathSet) {
    if (!depths.has(p)) depths.set(p, 999);
  }

  const byDepth = new Map<number, string[]>();
  for (const [p, d] of depths) {
    const list = byDepth.get(d) ?? [];
    list.push(p);
    byDepth.set(d, list);
  }

  const maxDepth = Math.max(...Array.from(byDepth.keys()));
  const maxCount = Math.max(...journeys.map(j => j.count), 1);

  // Compute node values
  const nodeValues = new Map<string, number>();
  for (const j of journeys) {
    nodeValues.set(j.sourcePath, (nodeValues.get(j.sourcePath) ?? 0) + j.count);
    nodeValues.set(j.targetPath, (nodeValues.get(j.targetPath) ?? 0) + j.count);
  }

  const nodes: SankeyNode[] = [];
  const nodeMap = new Map<string, SankeyNode>();
  for (let d = 0; d <= maxDepth; d++) {
    const paths = (byDepth.get(d) ?? []).sort((a, b) => (nodeValues.get(b) ?? 0) - (nodeValues.get(a) ?? 0)).slice(0, 8);
    const colH = paths.length * (NODE_H + 12);
    const startY = (HEIGHT - colH) / 2;
    paths.forEach((p, i) => {
      const node: SankeyNode = {
        path: p,
        depth: d,
        x: LEFT_PAD + d * (NODE_W + COL_GAP),
        y: startY + i * (NODE_H + 12),
        value: nodeValues.get(p) ?? 0,
      };
      nodes.push(node);
      nodeMap.set(p, node);
    });
  }

  // Compute edge positions with offset stacking
  const sourceOffsets = new Map<string, number>();
  const targetOffsets = new Map<string, number>();

  const edges: SankeyEdge[] = journeys
    .filter(j => nodeMap.has(j.sourcePath) && nodeMap.has(j.targetPath))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(j => {
      const s = nodeMap.get(j.sourcePath)!;
      const t = nodeMap.get(j.targetPath)!;
      const sOff = sourceOffsets.get(j.sourcePath) ?? 0;
      const tOff = targetOffsets.get(j.targetPath) ?? 0;
      sourceOffsets.set(j.sourcePath, sOff + NODE_H * (j.count / maxCount));
      targetOffsets.set(j.targetPath, tOff + NODE_H * (j.count / maxCount));
      return {
        source: j.sourcePath,
        target: j.targetPath,
        count: j.count,
        x1: s.x + NODE_W,
        y1: s.y + sOff,
        x2: t.x,
        y2: t.y + tOff,
        sourceY: s.y,
        targetY: t.y,
      };
    });

  return { nodes, edges, maxCount };
}

function truncatePath(p: string): string {
  return p.length > 18 ? '…' + p.slice(-16) : p;
}

export default function SankeyFlowDiagram({ journeys }: { journeys: JourneyDTO[] }) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { nodes, edges, maxCount } = useMemo(
    () => layoutSankey(journeys),
    [journeys],
  );

  const relevantEdges = hoveredNode
    ? edges.filter(e => e.source === hoveredNode || e.target === hoveredNode)
    : edges;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="sankeyGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#7b2fff" stopOpacity={0.6} />
          </linearGradient>
        </defs>

        {relevantEdges.map((e, i) => {
          const ratio = e.count / maxCount;
          const thickness = 2 + ratio * 14;
          const midX = (e.x1 + e.x2) / 2;
          const path = `M${e.x1},${e.y1 + thickness / 2} C${midX},${e.y1 + thickness / 2} ${midX},${e.y2 + thickness / 2} ${e.x2},${e.y2 + thickness / 2}`;
          return (
            <path
              key={`e-${i}`}
              d={path}
              fill="none"
              stroke="url(#sankeyGrad)"
              strokeWidth={thickness}
              strokeOpacity={hoveredNode ? 0.9 : 0.3 + ratio * 0.4}
              style={{ transition: 'stroke-opacity 0.2s' }}
            />
          );
        })}

        {nodes.map(n => {
          const isHovered = hoveredNode === n.path;
          const isConnected = relevantEdges.some(e => e.source === n.path || e.target === n.path);
          const dimmed = hoveredNode && !isHovered && !isConnected;
          return (
            <g
              key={n.path}
              onMouseEnter={() => setHoveredNode(n.path)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                rx={4}
                fill={isHovered ? 'rgba(0, 240, 255, 0.15)' : 'var(--bg-secondary)'}
                stroke={isHovered ? 'var(--accent)' : 'rgba(0, 240, 255, 0.3)'}
                strokeWidth={isHovered ? 2 : 1}
                opacity={dimmed ? 0.3 : 1}
                style={{ transition: 'fill 0.15s, stroke 0.15s, opacity 0.15s' }}
              />
              <text
                x={n.x + NODE_W / 2}
                y={n.y + NODE_H / 2 + 4}
                textAnchor="middle"
                fill={isHovered ? 'var(--accent)' : 'var(--text-secondary)'}
                fontSize={10}
                opacity={dimmed ? 0.3 : 1}
              >
                {truncatePath(n.path)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="scan-line-overlay" style={{ borderRadius: 8 }} />
    </div>
  );
}
