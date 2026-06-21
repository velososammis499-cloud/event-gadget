import { useEffect } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: React.ReactNode;
}

/** Right-side slide-in drawer. Used by Labels management and SessionDrawer.
 *  Closes on Escape or on clicking the dimmed overlay. */
export default function Drawer({ open, onClose, title, width = 480, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div style={styles.overlay} onClick={onClose} />
      <aside style={{ ...styles.drawer, width }}>
        <header style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          <button style={styles.close} onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div style={styles.body}>{children}</div>
      </aside>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
  },
  drawer: {
    position: 'fixed', top: 0, right: 0, height: '100vh',
    background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)',
    zIndex: 101, display: 'flex', flexDirection: 'column' as const,
    boxShadow: '-8px 0 24px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
  },
  title: { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 },
  close: {
    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
    fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: 0, width: 28, height: 28,
  },
  body: { flex: 1, overflow: 'auto', padding: 20 },
};
