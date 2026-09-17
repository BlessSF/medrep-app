'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import api, { ApiError } from '../api/client';

type Role = 'admin' | 'cashier' | '';

interface AuthState {
  username: string | null;
  role: Role;
  branch: string | null;
  loading: boolean;
  login: (branch: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('');
  const [branch, setBranch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me.php')
      .then((r) => {
        setUsername(r.username);
        setRole(r.role);
        setBranch(r.branch || null);
      })
      .catch(() => {
        setUsername(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (branchName: string, u: string, p: string) => {
    const r = await api.post('/auth/login.php', { branch: branchName, username: u, password: p });
    setUsername(r.username);
    setRole(r.role);
    setBranch(r.branch || branchName);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout.php');
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
    setUsername(null);
    setRole('');
    setBranch(null);
  }, []);

  return (
    <AuthContext.Provider value={{ username, role, branch, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}