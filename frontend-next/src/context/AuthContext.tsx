'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import api, { ApiError } from '../api/client';

type Role = 'admin' | 'cashier' | '';

interface AuthState {
  username: string | null;
  role: Role;
  branch: string | null;
  loading: boolean;
  serverError: string;
  retry: () => void;
  login: (branch: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('');
  const [branch, setBranch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState('');

  const check = useCallback(() => {
    setLoading(true);
    setServerError('');
    api
      .get('/auth/me.php')
      .then((r) => {
        setUsername(r.username);
        setRole(r.role);
        setBranch(r.branch || null);
      })
      .catch((e) => {
        // Only a 401 means "not logged in". Anything else (429, server down,
        // no network) says nothing about the session, so don't log the person
        // out: show a retry message instead of bouncing them to the login page.
        if (e instanceof ApiError && e.status === 401) {
          api.clearToken();
          setUsername(null);
        } else {
          setServerError(e instanceof ApiError ? e.message : 'Could not reach the server.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { check(); }, [check]);

  const login = useCallback(async (branchName: string, u: string, p: string) => {
    const r = await api.post('/auth/login.php', { branch: branchName, username: u, password: p });
    if (r.token) api.setToken(r.token);
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
    api.clearToken();
    setUsername(null);
    setRole('');
    setBranch(null);
  }, []);

  return (
    <AuthContext.Provider value={{ username, role, branch, loading, serverError, retry: check, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}