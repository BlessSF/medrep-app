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
  const { username, role: userRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!username) {
      router.replace('/login');
      return;
    }
    if (role && userRole !== role) {
      router.replace(userRole === 'admin' ? '/admin' : '/staff');
    }
  }, [loading, username, userRole, role, router]);

  if (loading || !username || (role && userRole !== role)) {
    return <div style={{ padding: 40 }}>Loading…</div>;
  }

  return <>{children}</>;
}
