import { useState, useRef, useEffect } from 'react';
import { useFilters } from '../hooks/useFilters';
import { useApps } from '../api/queries';
import { formatRelativeTime } from '../shared/formatters';
import LiveIndicator from './LiveIndicator';

export default function FilterBar() {
  const { filters, setFilters, setPreset } = useFilters();
  const { data: apps } = useApps();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters.appId ?? '');
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep draft in sync when filters.appId changes from elsewhere (URL navigation, etc.)
  useEffect(() => { setDraft(filters.appId ?? ''); }, [filters.appId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function pick(appId: string) {
    setDraft(appId);
    setFilters({ appId });
    setOpen(false);
  }

  function commitDraft() {
    setFilters({ appId: draft || undefined });
  }

  function handleClear() {
    setDraft('');
    setFilters({ startTime: undefined, endTime: undefined, appId: undefined, preset: undefined });
  }

  const hasFilter = filters.startTime || filters.endTime || filters.appId || filters.preset;

  // Filter dropdown options by current draft
  const draftLower = draft.toLowerCase();
  const filteredApps = (apps ?? []).filter(a => !draft || a.appId.toLowerCase().includes(draftLower));

  return (
    <div style={styles.bar}>
      <div style={styles.presets}>
        <button
          style={{ ...styles.btn, ...(filters.preset === 'today' ? styles.btnActive : {}) }}
          onClick={() => setPreset('today')}
        >今日</button>
        <button
          style={{ ...styles.btn, ...(filters.preset === '7d' ? styles.btnActive : {}) }}
          onClick={() => setPreset('7d')}
        >7天</button>
        <button
          style={{ ...styles.btn, ...(filters.preset === '30d' ? styles.btnActive : {}) }}
          onClick={() => setPreset('30d')}
        >30天</button>
      </div>

      <div style={styles.appPickerWrap} ref={wrapRef}>
        <input
          style={styles.input}
          placeholder="选择或输入 App ID"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={commitDraft}
          onKeyDown={e => {
            if (e.key === 'Enter') { commitDraft(); setOpen(false); (e.target as HTMLInputElement).blur(); }
            else if (e.key === 'Escape') { setDraft(filters.appId ?? ''); setOpen(false); (e.target as HTMLInputElement).blur(); }
          }}
        />
        <span style={styles.chev}>▾</span>
        {open && apps && apps.length > 0 && (
          <div style={styles.dropdown}>
            {filteredApps.length === 0 && (
              <div style={styles.empty}>无匹配项,按回车使用「{draft}」</div>
            )}
            {filteredApps.map(a => (
              <button
                key={a.appId}
                type="button"
                style={{ ...styles.option, ...(a.appId === filters.appId ? styles.optionActive : {}) }}
                onMouseDown={e => { e.preventDefault(); pick(a.appId); }}
              >
                <span style={styles.optAppId}>{a.appId}</span>
                <span style={styles.optMeta}>
                  {a.eventCount.toLocaleString()} 条 · 最近 {formatRelativeTime(a.lastEventAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {hasFilter && (
        <button style={styles.clearBtn} onClick={handleClear}>清除筛选</button>
      )}
      {filters.startTime && filters.endTime && (
        <span style={styles.rangeLabel}>
          {new Date(filters.startTime).toLocaleDateString('zh-CN')} — {new Date(filters.endTime).toLocaleDateString('zh-CN')}
        </span>
      )}
      <LiveIndicator />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    marginBottom: 16,
    borderBottom: '1px solid var(--border)',
  },
  presets: { display: 'flex', gap: 6 },
  btn: {
    background: 'rgba(0, 240, 255, 0.06)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '4px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    transition: 'border-color 0.15s, color 0.15s',
  },
  btnActive: {
    background: 'rgba(0, 240, 255, 0.18)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  appPickerWrap: { position: 'relative' as const, width: 200 },
  input: {
    width: '100%',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    padding: '4px 22px 4px 10px',
    borderRadius: 4,
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  chev: {
    position: 'absolute' as const,
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    fontSize: 12,
    pointerEvents: 'none' as const,
  },
  dropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    zIndex: 50,
    maxHeight: 280,
    overflowY: 'auto' as const,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  option: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: 2,
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(0,240,255,0.06)',
    padding: '8px 12px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left' as const,
  },
  optionActive: {
    background: 'rgba(0,240,255,0.08)',
    color: 'var(--accent)',
  },
  optAppId: { fontSize: 13, fontWeight: 500 },
  optMeta: { fontSize: 11, color: 'var(--text-muted)' },
  empty: { padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' },
  clearBtn: {
    background: 'transparent',
    border: '1px solid var(--danger)',
    color: 'var(--danger)',
    padding: '4px 10px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  },
  rangeLabel: { fontSize: 12, color: 'var(--text-muted)' },
};
