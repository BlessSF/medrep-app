'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import api, { ApiError } from '../../api/client';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/branches/list.php').then((r) => {
      setBranches(r.branches);
      if (r.branches.length > 0) setBranch(r.branches[0]);
    }).catch(() => {
      // Branch list is a nice-to-have; if it fails to load, the person can
      // still try logging in once branches load on a retry/refresh.
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(branch, username, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>MEDREP</h1>
        <p className="sub">Sign in to the transaction ledger</p>
        {error && <div className="banner error">{error}</div>}
        <div className="field">
          <label>Branch</label>
          <select value={branch} onChange={(e) => setBranch(e.target.value)} required>
            {branches.length === 0 && <option value="">Loading branches…</option>}
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn" type="submit" disabled={busy || !branch} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}