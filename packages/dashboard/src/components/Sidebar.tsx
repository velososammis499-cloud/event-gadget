import { NavLink, useLocation } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  hint: string;
}

const navItems: NavItem[] = [
  { to: '/',         label: '用了什么', icon: '◈', hint: '哪些功能被用,哪些没人用' },
  { to: '/blocked',  label: '卡在哪了', icon: '⚠', hint: '用户在哪一步流失' },
  { to: '/paths',    label: '怎么走的', icon: '⇄', hint: '典型使用路径' },
  { to: '/audience', label: '谁在用',   icon: '◐', hint: '新老 / 高频用户' },
];

export default function Sidebar() {
  // Carry the current search (App ID, time range, preset) across page changes
  // so the user doesn't have to re-enter filters every time they navigate.
  const { search } = useLocation();

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>Event Gadget</div>
      <nav style={styles.nav}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={{ pathname: item.to, search }}
            end={item.to === '/'}
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.linkActive : {}),
            })}
          >
            <span style={styles.icon}>{item.icon}</span>
            <div style={styles.linkBody}>
              <div style={styles.label}>{item.label}</div>
              <div style={styles.hint}>{item.hint}</div>
            </div>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    minHeight: '100vh',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
  },
  logo: {
    padding: '20px 16px',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: 1,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '0 8px',
    gap: 4,
  },
  link: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 6,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
  },
  linkActive: {
    background: 'rgba(0, 240, 255, 0.08)',
    color: 'var(--accent)',
    boxShadow: '0 0 12px rgba(0, 240, 255, 0.12)',
  },
  icon: {
    fontSize: 16,
    width: 20,
    textAlign: 'center' as const,
    flexShrink: 0,
    paddingTop: 1,
  },
  linkBody: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
  label: { fontSize: 14 },
  hint: { fontSize: 11, color: 'var(--text-muted)' },
};
