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
      <style>{CSS}</style>

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

const CSS = `
.lg { --ink:#1d1a16; --mute:#7d7266; --rule:#d3cabc; min-height:100vh; min-height:100dvh; display:grid;
  grid-template-columns:minmax(0,1.25fr) minmax(400px,.75fr); background:#faf8f4; color:var(--ink); }
.lg *, .lg *::before, .lg *::after { box-sizing:border-box; }
:where(.lg h1, .lg h2, .lg p) { margin:0; }

/* photo */
.lg-photo { position:relative; overflow:hidden; background:#1d1a16; min-height:100%; }
.lg-photo::after { content:''; position:absolute; inset:0; background:linear-gradient(to top, rgba(10,8,6,.78) 0%, rgba(10,8,6,0) 48%); }
.lg-photo::before { content:''; position:absolute; top:0; right:0; bottom:0; width:5px; background:var(--bc); z-index:2; transition:background .3s; }
.lg-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; animation:lgfade .5s ease; }
@keyframes lgfade { from { opacity:0; } to { opacity:1; } }
.lg-caption { position:absolute; z-index:1; left:clamp(24px,4vw,56px); bottom:clamp(24px,4vw,48px); right:24px; color:#fff; }
.lg-caption h2 { font-size:clamp(32px,4.2vw,56px); font-weight:800; letter-spacing:-.03em; line-height:1; text-transform:uppercase; }
.lg-caption p { margin-top:8px; font-size:14px; letter-spacing:.04em; opacity:.85; }

/* panel */
.lg-panel { display:flex; align-items:center; padding:48px clamp(24px,5vw,72px); }
.lg-form { width:100%; max-width:360px; }
.lg-brand { font-size:12px; font-weight:700; letter-spacing:.2em; color:var(--mute); margin-bottom:44px; }
.lg-brand span { margin:0 4px; opacity:.5; }
.lg-brand b { color:var(--bc); font-weight:800; }
.lg h1 { font-size:32px; font-weight:780; letter-spacing:-.025em; line-height:1.1; }
.lg-sub { margin:8px 0 30px; font-size:14.5px; color:var(--mute); }

.lg-field { margin-bottom:24px; }
.lg-label { display:block; margin-bottom:4px; font-size:11.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:#6f655a; }
.lg-muted { font-size:14px; color:var(--mute); padding:8px 0; }
.lg-linkbtn { border:0; background:none; padding:0; font:inherit; color:var(--bc); font-weight:650; text-decoration:underline; cursor:pointer; }

/* branch tabs */
.lg-tabs { display:flex; flex-wrap:wrap; gap:0 22px; border-bottom:1.5px solid var(--rule); }
.lg-tab { cursor:pointer; padding:8px 0 10px; margin-bottom:-1.5px; border:0; border-bottom:3px solid transparent; background:none; font:inherit; font-size:15px;
  font-weight:700; letter-spacing:.05em; color:#9a8f82; transition:color .15s, border-color .15s; }
.lg-tab:hover { color:var(--ink); }
.lg-tab.on { color:var(--ink); border-bottom-color:var(--bc); }
.lg-tab:focus-visible { outline:2px solid var(--bc); outline-offset:2px; }

/* inputs: underline only */
.lg-input { display:block; width:100%; padding:8px 0 10px; border:0; border-bottom:1.5px solid var(--rule); border-radius:0; background:transparent;
  font:inherit; font-size:16px; color:var(--ink); transition:border-color .15s, box-shadow .15s; -webkit-appearance:none; appearance:none; }
.lg-input:focus { outline:none; border-bottom-color:var(--bc); box-shadow:0 1.5px 0 var(--bc); }
.lg-select { cursor:pointer; }
.lg-pw { position:relative; }
.lg-pw .lg-input { padding-right:40px; }
.lg-show { position:absolute; right:-6px; bottom:3px; width:36px; height:36px; display:grid; place-items:center; border:0; border-radius:8px; background:none; padding:0; color:#8b8073; cursor:pointer; transition:color .15s, background .15s; }
.lg-show:hover { color:var(--bc); background:rgba(0,0,0,.05); }
.lg-show:focus-visible { outline:2px solid var(--bc); outline-offset:0; }
/* keep the browser's autofill from painting the fields blue */
.lg-input:-webkit-autofill, .lg-input:-webkit-autofill:focus { -webkit-box-shadow:0 0 0 100px #faf8f4 inset; -webkit-text-fill-color:var(--ink); caret-color:var(--ink); transition:background-color 9999s; }

.lg-submit { display:block; width:100%; margin-top:8px; padding:14px 18px; border:0; border-radius:4px; background:var(--bc); color:#fff; font:inherit;
  font-size:15px; font-weight:700; letter-spacing:.03em; cursor:pointer; transition:filter .15s, transform .05s; }
.lg-submit:hover:not(:disabled) { filter:brightness(.92); }
.lg-submit:active:not(:disabled) { transform:translateY(1px); }
.lg-submit:disabled { opacity:.5; cursor:default; }
.lg-submit:focus-visible { outline:2px solid var(--ink); outline-offset:3px; }

.lg-error { margin-bottom:22px; padding:10px 12px; border-left:3px solid #b42318; background:#fbefed; color:#8a1c12; font-size:13.5px; line-height:1.45; }
.lg-foot { margin-top:26px; font-size:12.5px; line-height:1.5; color:#9a8f82; }

/* phones and small tablets: photo becomes a banner on top */
@media (max-width:860px) {
  .lg { grid-template-columns:1fr; grid-template-rows:auto 1fr; }
  .lg-photo { min-height:0; height:clamp(140px,26vh,200px); }
  .lg-photo::before { top:auto; left:0; width:auto; height:4px; }
  .lg-caption { left:24px; bottom:18px; }
  .lg-caption h2 { font-size:28px; }
  .lg-caption p { margin-top:4px; font-size:12.5px; }
  .lg-panel { align-items:flex-start; padding:28px 24px 40px; }
  .lg-form { max-width:440px; margin:0 auto; }
  .lg-brand { margin-bottom:26px; }
}
@media (prefers-reduced-motion:reduce) { .lg-img { animation:none; } }
`;