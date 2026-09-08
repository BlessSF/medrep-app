'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { username, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!username) { router.replace('/login'); return; }
    router.replace(role === 'admin' ? '/admin' : '/staff');
  }, [loading, username, role, router]);

  return <div style={{ padding: 40 }}>Loading…</div>;
}
