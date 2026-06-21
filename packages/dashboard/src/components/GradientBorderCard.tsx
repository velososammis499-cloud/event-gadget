import type { ReactNode } from 'react';

interface Props {
  title?: string;
  subtitle?: string;
  accent?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}

export default function GradientBorderCard({ title, subtitle, accent, children, style }: Props) {
  return (
    <div className="gradient-border" style={{ padding: 0, ...style }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 7,
        padding: 20,
        position: 'relative',
      }}>
        {(title || subtitle) && (
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 16,
            paddingLeft: accent ? 10 : 0,
            borderLeft: accent ? `3px solid ${accent}` : 'none',
          }}>
            {title && <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{title}</h3>}
            {subtitle && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</span>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
