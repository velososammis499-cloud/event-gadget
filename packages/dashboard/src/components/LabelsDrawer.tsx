import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Drawer from './Drawer';
import { useRankings, useLabels } from '../api/queries';
import { queryKeys } from '../api/query-keys';
import { apiPut } from '../api/client';
import { LoadingState } from './StatePrimitives';

interface Props {
  open: boolean;
  onClose: () => void;
  appId: string | undefined;
  filters: { startTime?: number; endTime?: number };
}

/** Inline alias editor for `data-track` keys. Per row: input → blur/Enter saves,
 *  Esc cancels. Invalidates rankings + labels caches on save so the parent
 *  UsagePage immediately reflects the new alias. */
export default function LabelsDrawer({ open, onClose, appId, filters }: Props) {
  const rankings = useRankings({ appId, ...filters });
  const labels = useLabels(appId);
  const qc = useQueryClient();

  if (!open) return null;

  const aliasMap = new Map((labels.data ?? []).map(l => [l.rawKey, l.alias]));

  return (
    <Drawer open={open} onClose={onClose} title="标签管理" width={520}>
      <p style={styles.hint}>
        给 <code style={styles.code}>data-track</code> 设个中文别名,看板上所有数据立刻按这个名字显示。留空则恢复原始 key。
      </p>
      {rankings.isLoading && <LoadingState />}
      {rankings.data && rankings.data.length === 0 && <div style={styles.empty}>暂无可命名的元素</div>}
      {rankings.data && rankings.data.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>原始 key</th>
              <th style={styles.th}>中文别名</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>点击数</th>
            </tr>
          </thead>
          <tbody>
            {rankings.data.map(item => (
              <LabelRow
                key={item.key}
                rawKey={item.key}
                appId={appId!}
                initial={aliasMap.get(item.key) ?? ''}
                clicks={item.clicks}
                onSaved={() => {
                  qc.invalidateQueries({ queryKey: queryKeys.labels.all });
                  qc.invalidateQueries({ queryKey: queryKeys.rankings.all });
                  qc.invalidateQueries({ queryKey: queryKeys.events.all });
                }}
              />
            ))}
          </tbody>
        </table>
      )}
    </Drawer>
  );
}

function LabelRow({ rawKey, appId, initial, clicks, onSaved }: {
  rawKey: string; appId: string; initial: string; clicks: number; onSaved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (value === initial) return;
    setSaving(true); setError(null);
    try {
      await apiPut(`/labels/${encodeURIComponent(rawKey)}`, { appId, alias: value });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td style={styles.td}><code style={styles.code}>{rawKey}</code></td>
      <td style={styles.td}>
        <input
          style={styles.input}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            else if (e.key === 'Escape') { setValue(initial); (e.target as HTMLInputElement).blur(); }
          }}
          placeholder="(未设)"
          disabled={saving}
        />
        {error && <div style={styles.error}>{error}</div>}
      </td>
      <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-muted)' }}>{clicks.toLocaleString()}</td>
    </tr>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 },
  code: {
    background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 3,
    fontSize: 12, color: 'var(--accent)',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left' as const, padding: '8px 12px', fontSize: 11,
    color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 500,
  },
  td: { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid rgba(0,240,255,0.06)' },
  input: {
    width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '6px 8px', color: 'var(--text-primary)', fontSize: 13,
  },
  error: { fontSize: 11, color: 'var(--accent-red, #f87171)', marginTop: 2 },
  empty: { fontSize: 13, color: 'var(--text-muted)', padding: 24, textAlign: 'center' as const },
};
