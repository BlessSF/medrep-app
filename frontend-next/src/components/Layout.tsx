'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { IconUser, IconLogout } from './icons';

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
];

const CASHIER_LINKS = [{ to: '/staff', label: 'Daily Transaction', icon: '◧' }];

export default function Layout({ children }: { children: ReactNode }) {
  const { username, role, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const links = role === 'admin' ? ADMIN_LINKS : CASHIER_LINKS;

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <strong>MEDREP</strong>
          STELLA
        </div>
        <div className="sidebar-user">
          Hello,
          <strong>{username}</strong>
        </div>
        {links.map((l) => {
          const isActive = l.to === '/admin' ? pathname === '/admin' : pathname.startsWith(l.to);
          return (
            <Link key={l.to} href={l.to} className={'nav-link' + (isActive ? ' active' : '')}>
              <span className="nav-icon">{l.icon}</span> {l.label}
            </Link>
          );
        })}
        <button className="nav-link logout" onClick={handleLogout}>
          <span className="nav-icon"><IconLogout /></span> Logout
        </button>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}