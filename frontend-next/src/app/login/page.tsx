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

// Up to this many branches are shown as tabs; more than that falls back to a dropdown.
const MAX_TABS = 4;

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
  const [branchError, setBranchError] = useState('');
  const [branchSettings, setBranchSettings] = useState<Record<string, BranchSettings>>({});

  function loadBranches() {
    const s = loadBranchSettings();
    setBranchSettings(s);
    setBranchError('');
    api.get('/branches/list.php').then((r) => {
      setBranches(r.branches);
      if (r.branches.length > 0) {
        const first = r.branches[0];
        setBranch(first);
        setImgSrc(getBranchImage(first, s));
        setBranchColor(getBranchColor(first, s));
      }
    }).catch((e) => {
      setBranchError(e instanceof ApiError ? e.message : 'Could not reach the server.');
    });
  }

  useEffect(() => { loadBranches(); }, []);

  function chooseBranch(selected: string) {
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
    <div className="lg" style={{ ['--bc' as any]: branchColor }}>

      {/* Photo of the branch */}
      <div className="lg-photo">
        {imgSrc && (
          <img key={imgSrc} src={imgSrc} alt="" className="lg-img" onError={() => setImgSrc('')} />
        )}
        <div className="lg-caption">
          <h2>{branch || 'MEDREP'}</h2>
          <p>Transaction ledger</p>
        </div>
      </div>

      {/* Sign-in form */}
      <main className="lg-panel">
        <form className="lg-form" onSubmit={handleSubmit}>
          <div className="lg-brand">MEDREP{branch && <> <span>/</span> <b>{branch}</b></>}</div>

          <h1>Sign in</h1>
          <p className="lg-sub">Use the account your admin gave you.</p>

          {error && <div className="lg-error" role="alert">{error}</div>}

          <div className="lg-field">
            <span className="lg-label" id="lg-branch-label">Branch</span>
            {branches.length === 0 && (
              <div className="lg-muted">
                {branchError ? (
                  <>
                    {branchError}{' '}
                    <button type="button" className="lg-linkbtn" onClick={loadBranches}>Try again</button>
                  </>
                ) : 'Loading branches…'}
              </div>
            )}
            {branches.length > 0 && branches.length <= MAX_TABS && (
              <div className="lg-tabs" role="tablist" aria-labelledby="lg-branch-label">
                {branches.map((b) => (
                  <button key={b} type="button" role="tab" aria-selected={b === branch}
                    className={'lg-tab' + (b === branch ? ' on' : '')} onClick={() => chooseBranch(b)}>
                    {b}
                  </button>
                ))}
              </div>
            )}
            {branches.length > MAX_TABS && (
              <select className="lg-input lg-select" value={branch} onChange={(e) => chooseBranch(e.target.value)}
                aria-labelledby="lg-branch-label" required>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
          </div>

          <div className="lg-field">
            <label className="lg-label" htmlFor="lg-user">Username</label>
            <input id="lg-user" name="username" className="lg-input" value={username}
              onChange={(e) => setUsername(e.target.value)} autoComplete="username"
              autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus required />
          </div>

          <div className="lg-field">
            <label className="lg-label" htmlFor="lg-pass">Password</label>
            <div className="lg-pw">
              <input id="lg-pass" name="password" className="lg-input" type={showPassword ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="button" className="lg-show" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3l18 18" /><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.2 3.9" />
                    <path d="M6.6 7.6A16 16 0 0 0 2.5 12S6 18 12 18c1.5 0 2.8-.4 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button className="lg-submit" type="submit" disabled={busy || !branch}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="lg-foot">Forgot your password? Ask your branch admin to reset it.</p>
        </form>
      </main>
    </div>
  );
}
