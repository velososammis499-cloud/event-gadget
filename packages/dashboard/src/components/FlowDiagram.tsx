import { useState, useMemo } from 'react';
import type { JourneyDTO } from '../api/types';

interface Node {
  path: string;
  x: number;
  y: number;
}

interface Edge {
  source: string;
  target: string;
  count: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function buildGraph(journeys: JourneyDTO[], width: number, height: number): { nodes: Node[]; edges: Edge[]; maxCount: number } {
  const pathSet = new Set<string>();
  for (const j of journeys) {
    pathSet.add(j.sourcePath);
    pathSet.add(j.targetPath);
  }
  const paths = Array.from(pathSet);
  const cols = Math.ceil(Math.sqrt(paths.length));
  const rows = Math.ceil(paths.length / cols);
  const cellW = width / (cols + 1);
  const cellH = height / (rows + 1);

  const nodes: Node[] = paths.map((p, i) => ({
    path: p,
    x: (i % cols + 1) * cellW,
    y: (Math.floor(i / cols) + 1) * cellH,
  }));

  const nodeMap = new Map(nodes.map(n => [n.path, n]));
  const maxCount = Math.max(...journeys.map(j => j.count), 1);

  const edges: Edge[] = journeys.map(j => {
    const s = nodeMap.get(j.sourcePath)!;
    const t = nodeMap.get(j.targetPath)!;
    return { source: j.sourcePath, target: j.targetPath, count: j.count, x1: s.x, y1: s.y, x2: t.x, y2: t.y };
  });

  return { nodes, edges, maxCount };
}

export default function FlowDiagram({ journeys }: { journeys: JourneyDTO[] }) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { nodes, edges, maxCount } = useMemo(
    () => buildGraph(journeys, 800, 400),
    [journeys],
  );

  const relevantEdges = hoveredNode
    ? edges.filter(e => e.source === hoveredNode || e.target === hoveredNode)
    : edges;

  return (
    <svg viewBox="0 0 800 400" style={{ width: '100%', height: 'auto' }}>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="rgba(0, 240, 255, 0.6)" />
        </marker>
      </defs>

      {relevantEdges.map((e, i) => {
        const ratio = e.count / maxCount;
        const strokeWidth = 1 + ratio * 4;
        return (
          <line
            key={`${e.source}-${e.target}-${i}`}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="var(--accent)"
            strokeOpacity={hoveredNode ? 0.8 : 0.3 + ratio * 0.5}
            strokeWidth={strokeWidth}
            strokeDasharray="6 4"
            markerEnd="url(#arrowhead)"
            style={{ animation: 'dash-flow 1s linear infinite' }}
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
            <circle
              cx={n.x} cy={n.y} r={isHovered ? 12 : 8}
              fill={isHovered ? 'var(--accent)' : 'var(--bg-card)'}
              stroke="var(--accent)"
              strokeWidth={isHovered ? 2 : 1}
              opacity={dimmed ? 0.3 : 1}
              style={{ transition: 'r 0.15s, fill 0.15s, opacity 0.15s' }}
            />
            <text
              x={n.x} y={n.y + 20}
              textAnchor="middle"
              fill="var(--text-secondary)"
              fontSize={10}
              opacity={dimmed ? 0.3 : 1}
            >
              {n.path.length > 20 ? '…' + n.path.slice(-18) : n.path}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
