import { useState } from 'react';
import type { ChainDTO, ChainEntryDTO } from '../api/types';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function EntryNode({ entry, isFirst, isLast }: { entry: ChainEntryDTO; isFirst: boolean; isLast: boolean }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div style={styles.entryWrap}>
      {!isFirst && <div style={styles.connector}>→</div>}
      <div
        style={styles.node}
        onMouseEnter={() => setShowDetail(true)}
        onMouseLeave={() => setShowDetail(false)}
      >
        <div style={styles.nodeTitle}>{entry.title || entry.path}</div>
        <div style={styles.nodeTime}>{formatTime(entry.enteredAt)}</div>
        {showDetail && (
          <div style={styles.tooltip}>
            <div>路径: {entry.path}</div>
            {entry.search && <div>参数: {entry.search}</div>}
            <div>时间: {new Date(entry.enteredAt).toLocaleString('zh-CN')}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChainRow({ chain }: { chain: ChainDTO }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div style={styles.chainHeader} onClick={() => setExpanded(!expanded)}>
        <span style={{ color: 'var(--accent)', fontSize: 13, cursor: 'pointer' }}>
          {expanded ? '▾' : '▸'} {chain.sessionId.slice(0, 8)}…
        </span>
        <span style={styles.chainMeta}>
          {chain.entries.length} 步 · {chain.userId || '匿名'}
        </span>
        <span style={{ ...styles.chainMeta, fontSize: 11 }}>
          {new Date(chain.updatedAt).toLocaleString('zh-CN')}
        </span>
      </div>
      {expanded && (
        <div style={styles.timeline}>
          {chain.entries.map((entry, i) => (
            <EntryNode
              key={`${entry.path}-${entry.enteredAt}`}
              entry={entry}
              isFirst={i === 0}
              isLast={i === chain.entries.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SessionTimeline({ chains }: { chains: ChainDTO[] }) {
  return (
    <div>
      {chains.map(chain => (
        <ChainRow key={chain.sessionId} chain={chain} />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  chainHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderBottom: '1px solid rgba(0, 240, 255, 0.06)',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  chainMeta: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  timeline: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 0,
    padding: '16px 12px',
    overflowX: 'auto',
  },
  entryWrap: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  connector: {
    color: 'var(--accent)',
    fontSize: 16,
    margin: '0 6px',
    opacity: 0.6,
  },
  node: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '8px 12px',
    position: 'relative' as const,
    minWidth: 80,
    maxWidth: 160,
    cursor: 'default',
    transition: 'border-color 0.15s',
  },
  nodeTitle: {
    fontSize: 12,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nodeTime: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  tooltip: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 11,
    color: 'var(--text-secondary)',
    zIndex: 10,
    whiteSpace: 'nowrap' as const,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    marginTop: 4,
  },
};
