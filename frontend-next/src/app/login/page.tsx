'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import api, { ApiError } from '../../api/client';
import type { BranchSettings } from '../admin/branches/page';

// Static fallback images in /public/ (used when no custom image is uploaded)
const STATIC_IMAGES: Record<string, string> = {
  HERO:   '/hero-hero.png',
  DOIS:   '/dois-hero.jpg',
  STELLA: '/stella-hero.png',
};
const DEFAULT_IMAGE = '/hero-hero.png';

function loadBranchSettings(): Record<string, BranchSettings> {
  try { return JSON.parse(localStorage.getItem('branch_settings') || '{}'); } catch { return {}; }
}

function getBranchImage(branch: string, settings: Record<string, BranchSettings>): string {
  const key = branch.toUpperCase();
  return settings[key]?.image || STATIC_IMAGES[key] || DEFAULT_IMAGE;
}

function getBranchColor(branch: string, settings: Record<string, BranchSettings>): string {
  const key = branch.toUpperCase();
  const FALLBACKS: Record<string, string> = { HERO: '#c0392b', STELLA: '#1b4332', DOIS: '#b8540a' };
  return settings[key]?.color ?? FALLBACKS[key] ?? '#1b4332';
}

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [imgSrc, setImgSrc] = useState(DEFAULT_IMAGE);
  const [branchColor, setBranchColor] = useState('#1b4332');
  const [branchSettings, setBranchSettings] = useState<Record<string, BranchSettings>>({});

  useEffect(() => {
    const s = loadBranchSettings();
    setBranchSettings(s);
    api.get('/branches/list.php').then((r) => {
      setBranches(r.branches);
      if (r.branches.length > 0) {
        const first = r.branches[0];
        setBranch(first);
        setImgSrc(getBranchImage(first, s));
        setBranchColor(getBranchColor(first, s));
      }
    }).catch(() => {});
  }, []);

  function handleBranchChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = e.target.value;
    setBranch(selected);
    setImgSrc(getBranchImage(selected, branchSettings));
    setBranchColor(getBranchColor(selected, branchSettings));
  }

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
    <div className="login-shell-v2">
      {/* Left panel — hero image */}
      <div className="login-hero-panel">
        <div className="login-hero-overlay" />
        {imgSrc && (
          <img
            key={imgSrc}
            src={imgSrc}
            alt={branch || 'Branch'}
            className="login-hero-img"
            onError={() => setImgSrc('')}
          />
        )}
        <div className="login-hero-badge">
          <span className="login-hero-badge-h" style={{ background: branchColor }}>
            {branch ? branch[0] : 'H'}
          </span>
          <div>
            <div className="login-hero-badge-title">{branch || 'H Breakfast to Bar'}</div>
            <div className="login-hero-badge-sub">Transaction Ledger System</div>
          </div>
        </div>
        {branch && <div className="login-hero-branch-tag">{branch}</div>}
      </div>

      {/* Right panel — form */}
      <div className="login-form-panel">
        <div className="login-form-inner">
          <div className="login-logo-row">
            <div className="login-logo-mark" style={{ background: branchColor }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <text x="11" y="16" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="sans-serif">
                  {branch ? branch[0] : 'H'}
                </text>
              </svg>
            </div>
            <span className="login-logo-text">MEDREP</span>
          </div>

          <h1 className="login-heading">Welcome back</h1>
          <p className="login-sub">Sign in to the transaction ledger</p>

          {error && (
            <div className="login-error-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="lfield">
              <label className="lfield-label">Branch</label>
              <div className="lfield-select-wrap">
                <select value={branch} onChange={handleBranchChange} required className="lfield-select"
                  style={{ '--focus-color': branchColor } as any}
                >
                  {branches.length === 0 && <option value="">Loading branches…</option>}
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <svg className="lfield-select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>

            <div className="lfield">
              <label className="lfield-label">Username</label>
              <div className="lfield-input-wrap">
                <svg className="lfield-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input className="lfield-input" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username" autoFocus required />
              </div>
            </div>

            <div className="lfield">
              <label className="lfield-label">Password</label>
              <div className="lfield-input-wrap">
                <svg className="lfield-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input className="lfield-input" type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password" required />
                <button type="button" className="lfield-eye" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            <button className="login-submit-btn" type="submit" disabled={busy || !branch}
              style={{ background: branchColor }}
            >
              {busy ? (<><span className="login-spinner" />Signing in…</>) : (<>Sign in <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>)}
            </button>
          </form>

          <p className="login-footer">MEDREP · Internal use only</p>
        </div>
      </div>
    </div>
  );
}