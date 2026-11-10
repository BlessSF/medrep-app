'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: 'admin' | 'cashier';
}) {
  const { username, role: userRole, loading, serverError, retry } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!username && !serverError) {
      router.replace('/login');
      return;
    }
    if (role && userRole !== role) {
      router.replace(userRole === 'admin' ? '/admin' : '/staff');
    }
  }, [loading, username, userRole, role, router, serverError]);

  if (!loading && !username && serverError) {
    return (
      <div style={{ padding: 40, maxWidth: 440 }}>
        <h2 style={{ marginBottom: 8 }}>Can’t reach the server</h2>
        <p style={{ color: '#7a7065', margin: '0 0 16px' }}>{serverError}</p>
        <button className="btn" onClick={retry}>Try again</button>
      </div>
    );
  }

  if (loading || !username || (role && userRole !== role)) {
    return <div style={{ padding: 40 }}>Loading…</div>;
  }

  return <>{children}</>;
}