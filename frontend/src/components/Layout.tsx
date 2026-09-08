import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: '◧' },
  { to: '/admin/customers', label: 'Customers', icon: '☰' },
  { to: '/admin/companies', label: 'Companies', icon: '▤' },
  { to: '/admin/daily', label: 'Daily Sales', icon: '▦' },
  { to: '/admin/monthly', label: 'Sales Reports', icon: '▲' },
  { to: '/admin/receivables', label: 'Receivables', icon: '◆' },
  { to: '/admin/cashout', label: 'Cashout Report', icon: '¥' },
  { to: '/admin/users', label: 'Users', icon: '☺' },
  { to: '/admin/tracking', label: 'Tracking', icon: '◎' },
];

const CASHIER_LINKS = [{ to: '/staff', label: 'Daily Transaction', icon: '◧' }];

export default function Layout({ children }: { children: ReactNode }) {
  const { username, role, logout } = useAuth();
  const navigate = useNavigate();
  const links = role === 'admin' ? ADMIN_LINKS : CASHIER_LINKS;

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <strong>MEDREP</strong>
          transaction ledger
        </div>
        <div className="sidebar-user">
          Hello,
          <strong>{username}</strong>
        </div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/admin'} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <span>{l.icon}</span> {l.label}
          </NavLink>
        ))}
        <button className="nav-link logout" onClick={handleLogout}>
          <span>⏻</span> Logout
        </button>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
