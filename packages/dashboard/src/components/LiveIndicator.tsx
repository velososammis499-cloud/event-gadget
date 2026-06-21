import { useEffect, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';

/**
 * Tiny live-pulse indicator: small dot + "刚刚更新 / N 秒前更新".
 * Updates a local clock every second so the relative time stays fresh
 * even when no fetches happen.
 */
export default function LiveIndicator() {
  const isFetching = useIsFetching();
  const [lastFetchAt, setLastFetchAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // When a fetch starts, remember the time it began so we can show "刚刚更新" once it lands.
  useEffect(() => {
    if (isFetching > 0) {
      setLastFetchAt(Date.now());
    }
  }, [isFetching]);

  const seconds = lastFetchAt ? Math.max(0, Math.floor((now - lastFetchAt) / 1000)) : null;
  const label = isFetching > 0
    ? '更新中…'
    : seconds === null
      ? '等待数据'
      : seconds < 2
        ? '刚刚更新'
        : `${seconds} 秒前更新`;

  return (
    <span style={styles.wrap} title="看板每 10 秒自动刷新">
      <span style={{ ...styles.dot, ...(isFetching > 0 ? styles.dotActive : {}) }} />
      <span style={styles.text}>{label}</span>
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: 'var(--text-muted)',
    marginLeft: 'auto',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--accent, #4ade80)',
    boxShadow: '0 0 6px rgba(74, 222, 128, 0.6)',
    transition: 'transform 0.2s',
  },
  dotActive: {
    transform: 'scale(1.3)',
    background: '#fbbf24',
    boxShadow: '0 0 8px rgba(251, 191, 36, 0.8)',
  },
  text: {
    fontVariantNumeric: 'tabular-nums',
  },
};
