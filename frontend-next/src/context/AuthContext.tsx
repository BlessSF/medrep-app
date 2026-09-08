'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import api, { ApiError } from '../api/client';

type Role = 'admin' | 'cashier' | '';

interface AuthState {
  username: string | null;
  role: Role;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me.php')
      .then((r) => {
        setUsername(r.username);
        setRole(r.role);
      })
      .catch(() => {
        setUsername(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (u: string, p: string) => {
    const r = await api.post('/auth/login.php', { username: u, password: p });
    setUsername(r.username);
    setRole(r.role);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout.php');
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
    setUsername(null);
    setRole('');
  }, []);

  return (
    <AuthContext.Provider value={{ username, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
