import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '../api/client';
import { useFunnelOptions } from '../api/queries';
import { queryKeys } from '../api/query-keys';
import { displayPath } from '../shared/formatters';
import type { FunnelStep } from '../api/types';

interface FunnelEditorProps {
  appId: string;
  onClose: () => void;
  onSaved: () => void;
}

interface StepDraft {
  kind: 'page' | 'click';
  value: string;
}

export default function FunnelEditor({ appId, onClose, onSaved }: FunnelEditorProps) {
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([
    { kind: 'page', value: '' },
    { kind: 'page', value: '' },
  ]);

  const options = useFunnelOptions(appId);
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleanSteps: FunnelStep[] = steps
        .filter(s => s.value)
        .map(s => s.kind === 'page' ? { kind: 'page' as const, path: s.value } : { kind: 'click' as const, dataTrack: s.value });
      return apiPost('/funnels', { appId, name: name.trim() || '未命名漏斗', steps: cleanSteps });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.funnels.all });
      onSaved();
    },
  });

  function updateStep(i: number, patch: Partial<StepDraft>) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function addStep() {
    if (steps.length >= 8) return;
    setSteps(prev => [...prev, { kind: 'page', value: '' }]);
  }
  function removeStep(i: number) {
    if (steps.length <= 2) return;
    setSteps(prev => prev.filter((_, idx) => idx !== i));
  }

  const validCount = steps.filter(s => s.value).length;
  const canSave = validCount >= 2 && !saveMutation.isPending;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>新建漏斗</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={styles.body}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>漏斗名称</span>
            <input
              style={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如:注册转化"
              maxLength={100}
            />
          </label>

          <div style={styles.stepsHeader}>步骤(2-8 步)</div>
          {steps.map((s, i) => (
            <div key={i} style={styles.stepRow}>
              <span style={styles.stepIdx}>{i + 1}</span>
              <select
                style={styles.kindSelect}
                value={s.kind}
                onChange={e => updateStep(i, { kind: e.target.value as 'page' | 'click', value: '' })}
              >
                <option value="page">访问页面</option>
                <option value="click">点击元素</option>
              </select>
              <select
                style={styles.valueSelect}
                value={s.value}
                onChange={e => updateStep(i, { value: e.target.value })}
              >
                <option value="">— 选择 —</option>
                {s.kind === 'page' && options.data?.pages.map(p => (
                  <option key={p.value} value={p.value}>
                    {displayPath(p.value)} ({p.count})
                  </option>
                ))}
                {s.kind === 'click' && options.data?.clicks.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.sampleText ? `${c.sampleText} (${c.value})` : c.value} · {c.count}
                  </option>
                ))}
              </select>
              <button
                style={{ ...styles.removeBtn, ...(steps.length <= 2 ? styles.disabled : {}) }}
                onClick={() => removeStep(i)}
                disabled={steps.length <= 2}
                title="移除此步骤"
              >×</button>
            </div>
          ))}

          <button
            style={{ ...styles.addBtn, ...(steps.length >= 8 ? styles.disabled : {}) }}
            onClick={addStep}
            disabled={steps.length >= 8}
          >+ 添加一步</button>

          {options.isLoading && (
            <div style={styles.hint}>正在读取该应用的页面和按钮…</div>
          )}
          {!options.isLoading && options.data && options.data.pages.length === 0 && options.data.clicks.length === 0 && (
            <div style={styles.hint}>该应用还没有事件数据,先在你的页面上做一些操作再回来。</div>
          )}
          {saveMutation.error && (
            <div style={styles.error}>保存失败:{(saveMutation.error as Error).message}</div>
          )}
        </div>
        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>取消</button>
          <button
            style={{ ...styles.saveBtn, ...(!canSave ? styles.disabled : {}) }}
            disabled={!canSave}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? '保存中…' : '保存并查看'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    minWidth: 520,
    maxWidth: '90vw',
    maxHeight: '85vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex', alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', flex: 1 },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
    fontSize: 24, cursor: 'pointer', lineHeight: 1,
  },
  body: { padding: 20, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 12, color: 'var(--text-secondary)' },
  input: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 4,
    fontSize: 13, outline: 'none',
  },
  stepsHeader: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 },
  stepRow: { display: 'flex', alignItems: 'center', gap: 8 },
  stepIdx: {
    width: 22, height: 22,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: '50%', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600,
    flexShrink: 0,
  },
  kindSelect: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4,
    fontSize: 12, outline: 'none', flexShrink: 0,
  },
  valueSelect: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4,
    fontSize: 12, outline: 'none', flex: 1, minWidth: 0,
  },
  removeBtn: {
    width: 28, height: 28,
    background: 'transparent', border: '1px solid var(--border)',
    color: 'var(--text-muted)', borderRadius: 4,
    cursor: 'pointer', fontSize: 14,
    flexShrink: 0,
  },
  addBtn: {
    padding: '6px 12px',
    background: 'transparent', border: '1px dashed var(--border)',
    color: 'var(--text-secondary)', borderRadius: 4,
    cursor: 'pointer', fontSize: 12,
    alignSelf: 'flex-start',
  },
  disabled: { opacity: 0.4, cursor: 'not-allowed' },
  hint: { fontSize: 11, color: 'var(--text-muted)' },
  error: { fontSize: 12, color: 'var(--accent-red, #f87171)' },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
    padding: '12px 20px', borderTop: '1px solid var(--border)',
  },
  cancelBtn: {
    background: 'transparent', border: '1px solid var(--border)',
    color: 'var(--text-secondary)', padding: '6px 14px', borderRadius: 4,
    cursor: 'pointer', fontSize: 12,
  },
  saveBtn: {
    background: 'var(--accent)', border: '1px solid var(--accent)',
    color: '#0a0f1e', padding: '6px 14px', borderRadius: 4,
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
  },
};
