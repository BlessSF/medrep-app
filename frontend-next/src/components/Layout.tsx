'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { IconUser, IconLogout } from './icons';
import type { BranchSettings } from '../app/admin/branches/page';

function loadBranchSettings(): Record<string, BranchSettings> {
  try { return JSON.parse(localStorage.getItem('branch_settings') || '{}'); } catch { return {}; }
}

// Fallback hardcoded themes for branches that haven't been customized yet
const FALLBACK_THEMES: Record<string, string> = {
  HERO:   '#c0392b',
  STELLA: '#1b4332',
  DOIS:   '#b8540a',
};
const DEFAULT_COLOR = '#1b4332';

function getThemeColor(branch: string | null, settings: Record<string, BranchSettings>): string {
  if (!branch) return DEFAULT_COLOR;
  const key = branch.toUpperCase();
  return settings[key]?.color ?? FALLBACK_THEMES[key] ?? DEFAULT_COLOR;
}

function getThemeImage(branch: string | null, settings: Record<string, BranchSettings>): string {
  if (!branch) return '';
  return settings[branch.toUpperCase()]?.image ?? '';
}

const ADMIN_LINKS = [
  { to: '/admin',            label: 'Dashboard',     icon: '◧' },
  { to: '/admin/customers',  label: 'Customers',     icon: '☰' },
  { to: '/admin/block',      label: 'Block Medrep',  icon: '⊘' },
  { to: '/admin/companies',  label: 'Companies',     icon: '▤' },
  { to: '/admin/daily',      label: 'Daily Sales',   icon: '▦' },
  { to: '/admin/monthly',    label: 'Sales Reports', icon: '▲' },
  { to: '/admin/receivables',label: 'Receivables',   icon: '◆' },
  { to: '/admin/cashout',    label: 'Cashout Report',icon: '¥' },
  { to: '/admin/users',      label: 'Users',         icon: <IconUser /> },
  { to: '/admin/tracking',   label: 'Tracking',      icon: '◎' },
  { to: '/admin/branches',   label: 'Branches',      icon: '⌂' },
];

const CASHIER_LINKS = [{ to: '/staff', label: 'Daily Transaction', icon: '◧' }];

export default function Layout({ children, sidebarStatus }: { children: ReactNode; sidebarStatus?: ReactNode }) {
  const { username, role, branch, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const links = role === 'admin' ? ADMIN_LINKS : CASHIER_LINKS;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [branchSettings, setBranchSettings] = useState<Record<string, BranchSettings>>({});

  // Load settings and re-apply whenever they change (e.g. after saving from branches page)
  useEffect(() => {
    setBranchSettings(loadBranchSettings());
    const handler = () => setBranchSettings(loadBranchSettings());
    window.addEventListener('branch_settings_changed', handler);
    return () => window.removeEventListener('branch_settings_changed', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const color = getThemeColor(branch, branchSettings);
  const image = getThemeImage(branch, branchSettings);

  // Darken color slightly for hover/dark areas
  const colorDark = color + 'cc';

  return (
    <div
      className="app-shell"
      style={{
        ['--sidebar-bg' as any]: color + '22',        // very light tint for bg
        ['--sidebar-bg-dark' as any]: color,
        ['--sidebar-accent' as any]: color,
        ['--brand-primary' as any]: color,
      }}
    >
      {/* Override sidebar background to use solid branch color */}
      <style>{`
        .sidebar { background: ${color}ee !important; }
        .sidebar .nav-link.active { background: rgba(255,255,255,0.15) !important; border-left-color: rgba(255,255,255,0.7) !important; }
        .sidebar .nav-link:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      <div className="mobile-topbar" style={{ background: color }}>
        <button className="hamburger-btn" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        <div className="mobile-brand">
          <div style={{
            width: 26, height: 26, borderRadius: 7, overflow: 'hidden',
            background: 'rgba(255,255,255,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {image
              ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>{(branch || 'M').charAt(0)}</span>
            }
          </div>
          <strong>MEDREP</strong> {branch || '—'}
        </div>
      </div>

      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <nav className={'sidebar' + (mobileOpen ? ' open' : '')}>
        <div className="sidebar-brand">
          <div style={{
            width: 38, height: 38, borderRadius: 10, overflow: 'hidden',
            background: 'rgba(255,255,255,0.15)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}>
            {image
              ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{(branch || 'M').charAt(0)}</span>
            }
          </div>
          <span className="brand-text">
            <strong>MEDREP</strong>
            <span>{branch || '—'}</span>
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
          <span className="user-avatar" style={{ background: 'rgba(255,255,255,0.2)' }}>
            {(username || '?').charAt(0).toUpperCase()}
          </span>
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