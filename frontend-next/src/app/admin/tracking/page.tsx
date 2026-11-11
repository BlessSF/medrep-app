'use client';

import { useEffect, useMemo, useState } from 'react';
import Layout from '../../../components/Layout';
import RequireAuth from '../../../components/RequireAuth';
import api, { ApiError } from '../../../api/client';
import { MONTH_NAMES } from '../../../lib/format';

type Log = { id: number; timestamp: string; username: string; action: string; details: string };
type Kind = 'add' | 'edit' | 'delete' | 'auth' | 'warn';
type Chip = 'all' | 'add' | 'edit' | 'delete' | 'voucher' | 'auth';

const PAGE_SIZE = 50;

// Work out what sort of event a log line is from its action text, so the page
// can colour it and let admins filter by it.
function kindOf(action: string): Kind {
  const a = action.toLowerCase();
  if (/failed/.test(a)) return 'warn';
  if (/log(ged)?[ _]?(in|out)/.test(a)) return 'auth';
  if (/delet|remov|clear|^blocked|blocked medrep/.test(a) && !/unblock/.test(a)) return 'delete';
  if (/add|creat|regist/.test(a)) return 'add';
  return 'edit';
}
const isVoucher = (action: string) => action.toLowerCase().startsWith('voucher');

function prettyAction(action: string) {
  const t = action.replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function parseDate(v: string) {
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}
const dayLabel = (d: Date) => d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const timeLabel = (d: Date) => d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

function TrackingPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [user, setUser] = useState('');
  const [chip, setChip] = useState<Chip>('all');
  const [q, setQ] = useState('');
  const [qLive, setQLive] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([now.getFullYear()]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounce the search box so we don't call the server on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(qLive), 300);
    return () => clearTimeout(t);
  }, [qLive]);

  function load() {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    if (user) params.set('user', user);
    if (q) params.set('q', q);
    api.get(`/logs/list.php?${params}`)
      .then((r) => {
        setLogs(r.logs);
        setUsers(r.users || []);
        setYears(r.years.length ? r.years : [now.getFullYear()]);
        setPage(0);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the audit log.'))
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [month, year, user, q]);

  const counts = useMemo(() => {
    const c = { all: logs.length, add: 0, edit: 0, delete: 0, voucher: 0, auth: 0 };
    for (const l of logs) {
      const k = kindOf(l.action);
      if (k === 'add') c.add++;
      else if (k === 'edit') c.edit++;
      else if (k === 'delete') c.delete++;
      else c.auth++;
      if (isVoucher(l.action)) c.voucher++;
    }
    return c;
  }, [logs]);

  const shown = useMemo(() => logs.filter((l) => {
    if (chip === 'all') return true;
    if (chip === 'voucher') return isVoucher(l.action);
    if (chip === 'auth') return ['auth', 'warn'].includes(kindOf(l.action));
    return kindOf(l.action) === chip;
  }), [logs, chip]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = shown.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Group the visible rows by calendar day.
  const groups = useMemo(() => {
    const out: { label: string; rows: Log[] }[] = [];
    for (const l of visible) {
      const d = parseDate(l.timestamp);
      const label = d ? dayLabel(d) : 'Unknown date';
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(l);
      else out.push({ label, rows: [l] });
    }
    return out;
  }, [visible]);

  function exportCsv() {
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['When', 'User', 'Action', 'Details'].map(esc).join(',')];
    for (const l of shown) lines.push([l.timestamp, l.username, prettyAction(l.action), l.details].map(esc).join(','));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit_log_${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const CHIPS: { id: Chip; label: string }[] = [
    { id: 'all', label: 'Everything' },
    { id: 'add', label: 'Added' },
    { id: 'edit', label: 'Edited' },
    { id: 'delete', label: 'Deleted' },
    { id: 'voucher', label: 'Vouchers' },
    { id: 'auth', label: 'Sign-ins' },
  ];

  return (
    <Layout>
      <style>{CSS}</style>
      <div className="al">
        <header className="al-head">
          <div>
            <h1>Audit Log</h1>
            <p>Every add, edit and delete in this branch, and who did it. Only admins can see this page.</p>
          </div>
          <button className="al-btn" onClick={exportCsv} disabled={shown.length === 0}>Export CSV</button>
        </header>

        <div className="al-bar">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Month">
            {MONTH_NAMES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={user} onChange={(e) => setUser(e.target.value)} aria-label="User">
            <option value="">All users</option>
            {users.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <div className="al-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input placeholder="Search the details" value={qLive} onChange={(e) => setQLive(e.target.value)} />
          </div>
        </div>

        <div className="al-chips" role="group" aria-label="Filter by type">
          {CHIPS.map((c) => (
            <button key={c.id} className={'al-chip' + (chip === c.id ? ' on' : '')} onClick={() => { setChip(c.id); setPage(0); }}>
              {c.label}<em>{counts[c.id]}</em>
            </button>
          ))}
        </div>

        {error && (
          <div className="al-card al-state err">
            <p>{error}</p>
            <button className="al-btn solid" onClick={load}>Try again</button>
          </div>
        )}
        {!error && loading && <div className="al-card al-state">Loading activity…</div>}
        {!error && !loading && shown.length === 0 && (
          <div className="al-card al-state">No activity found for these filters.</div>
        )}

        {!error && !loading && groups.map((g) => (
          <section className="al-card al-day" key={g.label}>
            <h2>{g.label}</h2>
            <ul>
              {g.rows.map((l) => {
                const d = parseDate(l.timestamp);
                const k = kindOf(l.action);
                return (
                  <li key={l.id}>
                    <span className="al-time">{d ? timeLabel(d) : ''}</span>
                    <span className="al-user">{l.username || '—'}</span>
                    <span className={'al-pill ' + k}>{prettyAction(l.action)}</span>
                    <span className="al-details">{l.details}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {!error && !loading && shown.length > PAGE_SIZE && (
          <div className="al-pager">
            <button className="al-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>← Newer</button>
            <span>Page {safePage + 1} of {pages} · {shown.length.toLocaleString()} entries</span>
            <button className="al-btn" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>Older →</button>
          </div>
        )}
      </div>
    </Layout>
  );
}

const CSS = `
.al { --a:var(--brand-primary,#b52e1f); --ink:#231d17; --mute:#7a7065; --line:#e6dfd4;
  --green:#2b7a4b; --green-soft:#e6f3ec; --amber:#a76a0a; --amber-soft:#fcf1d9; --red:#b42318; --red-soft:#fdecea;
  color:var(--ink); max-width:1200px; }
.al *, .al *::before, .al *::after { box-sizing:border-box; }
.al h1, .al h2 { margin:0; }

.al-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
.al-head h1 { font-size:24px; font-weight:750; letter-spacing:-.02em; }
.al-head p { margin:4px 0 0; font-size:13.5px; color:var(--mute); max-width:560px; }

.al-btn { cursor:pointer; padding:8px 14px; border-radius:9px; border:1px solid var(--line); background:#fff; font:inherit; font-size:13px; font-weight:600; color:var(--ink); }
.al-btn:hover:not(:disabled) { border-color:var(--a); color:var(--a); }
.al-btn:disabled { opacity:.4; cursor:default; }
.al-btn.solid { background:var(--a); border-color:var(--a); color:#fff; }

.al-bar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
.al-bar select, .al-search input { padding:9px 12px; border:1px solid var(--line); border-radius:9px; background:#fff; font:inherit; font-size:13.5px; color:var(--ink); }
.al-bar select { cursor:pointer; }
.al-bar select:focus, .al-search input:focus { outline:2px solid var(--a); outline-offset:-1px; border-color:var(--a); }
.al-search { position:relative; flex:1 1 220px; max-width:340px; }
.al-search svg { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--mute); pointer-events:none; }
.al-search input { width:100%; padding-left:33px; }

.al-chips { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; }
.al-chip { cursor:pointer; padding:6px 12px; border-radius:99px; border:1px solid var(--line); background:#fff; font:inherit; font-size:13px; font-weight:600; color:#5b5249; }
.al-chip em { font-style:normal; font-weight:500; font-size:11.5px; margin-left:6px; color:var(--mute); font-variant-numeric:tabular-nums; }
.al-chip:hover { border-color:#cfc5b7; }
.al-chip.on { background:var(--ink); border-color:var(--ink); color:#fff; }
.al-chip.on em { color:rgba(255,255,255,.7); }

.al-card { background:#fff; border:1px solid var(--line); border-radius:14px; margin-bottom:12px; }
.al-state { padding:36px 20px; text-align:center; color:var(--mute); }
.al-state.err { color:var(--red); }
.al-state p { margin:0 0 12px; }

.al-day { padding:6px 0; overflow:hidden; }
.al-day h2 { font-size:12px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--mute); padding:12px 18px 8px; }
.al-day ul { list-style:none; margin:0; padding:0; }
.al-day li { display:grid; grid-template-columns:78px 120px 190px minmax(0,1fr); gap:12px; align-items:start; padding:10px 18px; border-top:1px solid #f3ede4; font-size:13px; }
.al-time { color:var(--mute); font-variant-numeric:tabular-nums; white-space:nowrap; padding-top:2px; }
.al-user { font-weight:650; text-transform:capitalize; overflow:hidden; text-overflow:ellipsis; padding-top:2px; }
.al-details { color:#4d443b; line-height:1.5; overflow-wrap:anywhere; padding-top:1px; }
.al-pill { justify-self:start; padding:2px 10px; border-radius:99px; font-size:11.5px; font-weight:650; white-space:nowrap; background:#f1ebe2; color:#5b5249; }
.al-pill.add { background:var(--green-soft); color:var(--green); }
.al-pill.edit { background:var(--amber-soft); color:var(--amber); }
.al-pill.delete, .al-pill.warn { background:var(--red-soft); color:var(--red); }

.al-pager { display:flex; justify-content:center; align-items:center; gap:14px; margin:16px 0; font-size:13px; color:var(--mute); }

@media (max-width:760px) {
  .al-day li { grid-template-columns:1fr; gap:4px; }
  .al-time { order:3; }
  .al-search { max-width:none; }
}
`;

export default function Page() {
  return (
    <RequireAuth role="admin">
      <TrackingPage />
    </RequireAuth>
  );
}