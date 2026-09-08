import type React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Staff from './pages/cashier/Staff';
import AdminDashboard from './pages/admin/Dashboard';
import Customers from './pages/admin/Customers';
import CustomerProfile from './pages/admin/CustomerProfile';
import Companies from './pages/admin/Companies';
import Users from './pages/admin/Users';
import Tracking from './pages/admin/Tracking';
import Daily from './pages/admin/Daily';
import Monthly from './pages/admin/Monthly';
import Receivables from './pages/admin/Receivables';
import Cashout from './pages/admin/Cashout';
import './styles.css';

function RequireAuth({ children, role }: { children: React.ReactElement; role?: 'admin' | 'cashier' }) {
  const { username, role: userRole, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!username) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role && userRole !== role) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { role, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  return <Navigate to={role === 'admin' ? '/admin' : '/staff'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/staff" element={<RequireAuth><Staff /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/customers" element={<RequireAuth role="admin"><Customers /></RequireAuth>} />
      <Route path="/admin/customers/:name" element={<RequireAuth role="admin"><CustomerProfile /></RequireAuth>} />
      <Route path="/admin/companies" element={<RequireAuth role="admin"><Companies /></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth role="admin"><Users /></RequireAuth>} />
      <Route path="/admin/tracking" element={<RequireAuth role="admin"><Tracking /></RequireAuth>} />
      <Route path="/admin/daily" element={<RequireAuth role="admin"><Daily /></RequireAuth>} />
      <Route path="/admin/monthly" element={<RequireAuth role="admin"><Monthly /></RequireAuth>} />
      <Route path="/admin/receivables" element={<RequireAuth role="admin"><Receivables /></RequireAuth>} />
      <Route path="/admin/cashout" element={<RequireAuth role="admin"><Cashout /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
