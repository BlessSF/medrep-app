'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { IconUser, IconLogout } from './icons';

// Each branch gets a full sidebar theme (background + accent color for the
// active nav link / badge), so branches are visually distinct at a glance.
// Add more branches here as needed — unlisted ones fall back to the
// original dark-green theme.
const BRANCH_THEMES: Record<string, { bg: string; bgDark: string; accent: string; badgeText: string; brand: string }> = {
  HERO: { bg: '#3a1310', bgDark: '#2a0d0b', accent: '#c0392b', badgeText: '#ffffff', brand: '#c0392b' },
  STELLA: { bg: '#0f2a1f', bgDark: '#0f2a1f', accent: '#3a7350', badgeText: '#1b4332', brand: '#1b4332' },
};
const DEFAULT_THEME = { bg: '#0f2a1f', bgDark: '#0f2a1f', accent: '#3a7350', badgeText: '#ffffff', brand: '#1b4332' };

function branchTheme(branch: string | null) {
  if (!branch) return DEFAULT_THEME;
  return BRANCH_THEMES[branch.toUpperCase()] ?? DEFAULT_THEME;
}

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: '◧' },
  { to: '/admin/customers', label: 'Customers', icon: '☰' },
  { to: '/admin/block', label: 'Block Medrep', icon: '⊘' },
  { to: '/admin/companies', label: 'Companies', icon: '▤' },
  { to: '/admin/daily', label: 'Daily Sales', icon: '▦' },
  { to: '/admin/monthly', label: 'Sales Reports', icon: '▲' },
  { to: '/admin/receivables', label: 'Receivables', icon: '◆' },
  { to: '/admin/cashout', label: 'Cashout Report', icon: '¥' },
  { to: '/admin/users', label: 'Users', icon: <IconUser /> },
  { to: '/admin/tracking', label: 'Tracking', icon: '◎' },
  { to: '/admin/branches', label: 'Branches', icon: '⌂' },
];

const CASHIER_LINKS = [{ to: '/staff', label: 'Daily Transaction', icon: '◧' }];

export default function Layout({ children, sidebarStatus }: { children: ReactNode; sidebarStatus?: ReactNode }) {
  const { username, role, branch, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const links = role === 'admin' ? ADMIN_LINKS : CASHIER_LINKS;
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = branchTheme(branch);

  // Close the mobile menu automatically whenever the route changes.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div
      className="app-shell"
      style={{
        ['--sidebar-bg' as any]: theme.bg,
        ['--sidebar-bg-dark' as any]: theme.bgDark,
        ['--sidebar-accent' as any]: theme.accent,
        ['--brand-primary' as any]: theme.brand,
      }}
    >
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        <div className="mobile-brand">
          <span className="brand-badge small" style={{ background: theme.accent, color: theme.badgeText }}>
            {(branch || 'M').charAt(0)}
          </span>
          <strong>MEDREP</strong> {branch || '—'}
        </div>
      </div>

      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <nav className={'sidebar' + (mobileOpen ? ' open' : '')}>
        <div className="sidebar-brand">
          <span className="brand-badge" style={{ background: theme.accent, color: theme.badgeText }}>
            {(branch || 'M').charAt(0)}
          </span>
          <span className="brand-text">
            <strong>MEDREP</strong>
            {branch || '—'}
          </span>
        </div>

        {links.map((l) => {
          const isActive = l.to === '/admin' ? pathname === '/admin' : pathname.startsWith(l.to);
          return (
            <Link key={l.to} href={l.to} className={'nav-link' + (isActive ? ' active' : '')}>
              <span className="nav-icon">{l.icon}</span> {l.label}
            </Link>
          );
        })}

        <div className="sidebar-user bottom">
          <span className="user-avatar" style={{ background: theme.accent }}>{(username || '?').charAt(0).toUpperCase()}</span>
          <span className="user-text">
            <strong>{username}{sidebarStatus}</strong>
            <span className="user-role-badge">{role}</span>
          </span>
          <button className="logout-icon-btn" onClick={handleLogout} title="Log out">
            <IconLogout />
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}