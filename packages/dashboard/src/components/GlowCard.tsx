import type { ReactNode } from 'react';

export default function GlowCard({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="glow-card" style={{ padding: 20, ...style }}>
      {children}
    </div>
  );
}
