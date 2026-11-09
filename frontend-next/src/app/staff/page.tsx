'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Layout from '../../components/Layout';
import RequireAuth from '../../components/RequireAuth';
import { Banner } from '../../components/ui';
import api, { ApiError } from '../../api/client';
import { dateStr, money } from '../../lib/format';

interface Medrep { name: string; company: string; blocked: boolean }
type Row = Record<string, any>;

const TX_TYPES = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'dinein', label: 'Dine in' },
  { value: 'takeout', label: 'Takeout' },
  { value: 'giftcard', label: 'Buy gift card' },
  { value: 'cashout', label: 'Cash out' },
  { value: 'interest', label: 'Interest' },
  { value: 'transfer', label: 'Transfer' },
];

const PAYMENTS = [
  { value: 'na', label: 'N/A' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card / Swipe' },
  { value: 'paid', label: 'Paid' },
  { value: 'giftcard', label: 'Gift card' },
];

const BANKS = [
  { value: 'maya', label: 'Maya', card: 'Maya' },
  { value: 'metrobank', label: 'Metro Bank', card: 'Metro Bank' },
  { value: 'others', label: 'Other', card: '' },
] as const;

// A ledger row stores each kind of money in its own column, so work out
// which one this row is about to show a readable type + amount.
const COLUMNS: { key: string; label: string; tone: 'in' | 'use' | 'out' }[] = [
  { key: 'deposit', label: 'Deposit', tone: 'in' },
  { key: 'dinein', label: 'Dine in', tone: 'use' },
  { key: 'takeout', label: 'Takeout', tone: 'use' },
  { key: 'giftcard', label: 'Gift card', tone: 'use' },
  { key: 'cashout', label: 'Cash out', tone: 'out' },
  { key: 'interest', label: 'Interest', tone: 'out' },
];
function describe(r: Row): { label: string; amount: number; tone: string } {
  const n = (k: string) => Number(r[k] || 0);
  if (n('receiver_amount') > 0) return { label: 'Transfer in', amount: n('receiver_amount'), tone: 'in' };
  if (n('sender_amount') > 0) return { label: 'Transfer out', amount: n('sender_amount'), tone: 'out' };
  for (const c of COLUMNS) if (n(c.key) > 0) return { label: c.label, amount: n(c.key), tone: c.tone };
  return { label: '—', amount: 0, tone: '' };
}

const EMPTY_FORM = {
  name: '', company: '', amount: '', type: 'deposit',
  payment_method: 'na', card: '', remarks: '', transfer_name: '', transfer_company: '',
};

function StaffPage() {
  const [medreps, setMedreps] = useState<Medrep[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [filterQ, setFilterQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [bank, setBank] = useState<'maya' | 'metrobank' | 'others'>('maya');
  const firstRun = useRef(true);

  const today = useMemo(
    () => new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }),
    [],
  );

  async function loadMedreps() {
    try {
      const r = await api.get('/employees/medreps.php');
      setMedreps(r.medreps);
    } catch { /* the form still works without autocomplete */ }
  }

  async function loadFeed(p: number, q: string) {
    try {
      const r = await api.get(`/employees/list.php?page=${p}&per_page=25&f_q=${encodeURIComponent(q)}`);
      setRows(r.rows);
      setTotalPages(r.total_pages);
      setTotalRows(r.total_rows ?? r.rows.length);
      setPage(r.page);
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'Could not load transactions.', 'error');
    }
  }

  function flash(text: string, kind: 'success' | 'error') {
    setMsg({ text, kind });
    window.setTimeout(() => setMsg(null), 5000);
  }

  useEffect(() => { loadMedreps(); }, []);

  // Search as you type (debounced) instead of needing the Enter key.
  useEffect(() => {
    const t = window.setTimeout(() => loadFeed(1, filterQ), firstRun.current ? 0 : 300);
    firstRun.current = false;
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterQ]);

  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function onName(v: string) {
    const match = medreps.find((m) => m.name.toLowerCase() === v.toLowerCase());
    setForm((f) => ({ ...f, name: v, company: match ? match.company : f.company }));
  }

  function pickPayment(pm: string) {
    setForm((f) => ({
      ...f,
      payment_method: pm,
      card: pm === 'card' ? BANKS.find((b) => b.value === bank)!.card : '',
    }));
  }

  function pickBank(b: (typeof BANKS)[number]) {
    setBank(b.value);
    set('card', b.card);
  }

  const picked = medreps.find((m) => m.name.toLowerCase() === form.name.trim().toLowerCase());
  const isTransfer = form.type === 'transfer';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const r = await api.post('/employees/transaction/add.php', { ...form, amount: parseFloat(form.amount || '0') });
      flash(r.message || 'Transaction saved.', 'success');
      setForm((f) => ({ ...f, amount: '', remarks: '', transfer_name: '', transfer_company: '' }));
      loadFeed(1, filterQ);
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <style>{CSS}</style>
      <div className="dt">
        <header className="dt-head">
          <h1>Daily Transaction</h1>
          <span>{today}</span>
        </header>

        <div className="dt-grid">
          {/* ------------------------- New transaction ------------------------- */}
          <form className="dt-card dt-form" onSubmit={submit}>
            <h2>New transaction</h2>
            <Banner message={msg?.text || ''} kind={msg?.kind || 'success'} />

            <label className="dt-field">
              <span>Medrep name</span>
              <input list="medrep-names" value={form.name} onChange={(e) => onName(e.target.value)}
                placeholder="Start typing a name" autoComplete="off" required />
              <datalist id="medrep-names">
                {medreps.map((m) => <option key={m.name} value={m.name} />)}
              </datalist>
            </label>
            {picked?.blocked && <p className="dt-warn">This medrep is blocked. The transaction will probably be rejected.</p>}

            <label className="dt-field">
              <span>Company</span>
              <input value={form.company} onChange={(e) => set('company', e.target.value)} required />
            </label>

            <div className="dt-field">
              <span>Transaction type</span>
              <div className="dt-chips" role="radiogroup" aria-label="Transaction type">
                {TX_TYPES.map((t) => (
                  <button type="button" key={t.value} role="radio" aria-checked={form.type === t.value}
                    className={'dt-chip' + (form.type === t.value ? ' on' : '')} onClick={() => set('type', t.value)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="dt-field">
              <span>Amount</span>
              <div className="dt-amount">
                <b>₱</b>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={form.amount}
                  onChange={(e) => set('amount', e.target.value)} placeholder="0.00" required />
              </div>
            </label>

            {isTransfer ? (
              <div className="dt-two">
                <label className="dt-field">
                  <span>Transfer to</span>
                  <input list="medrep-names" value={form.transfer_name} onChange={(e) => set('transfer_name', e.target.value)} required />
                </label>
                <label className="dt-field">
                  <span>Their company</span>
                  <input value={form.transfer_company} onChange={(e) => set('transfer_company', e.target.value)} required />
                </label>
              </div>
            ) : (
              <>
                <div className="dt-field">
                  <span>Payment method</span>
                  <div className="dt-chips" role="radiogroup" aria-label="Payment method">
                    {PAYMENTS.map((p) => (
                      <button type="button" key={p.value} role="radio" aria-checked={form.payment_method === p.value}
                        className={'dt-chip' + (form.payment_method === p.value ? ' on' : '')} onClick={() => pickPayment(p.value)}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.payment_method === 'card' && (
                  <div className="dt-field">
                    <span>Bank</span>
                    <div className="dt-chips" role="radiogroup" aria-label="Bank">
                      {BANKS.map((b) => (
                        <button type="button" key={b.value} role="radio" aria-checked={bank === b.value}
                          className={'dt-chip' + (bank === b.value ? ' on' : '')} onClick={() => pickBank(b)}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                    {bank === 'others' && (
                      <input className="dt-gap" value={form.card} onChange={(e) => set('card', e.target.value)}
                        placeholder="Card or bank name" required />
                    )}
                  </div>
                )}
              </>
            )}

            <label className="dt-field">
              <span>Remarks <em>optional</em></span>
              <textarea rows={2} value={form.remarks} onChange={(e) => set('remarks', e.target.value)}
                placeholder="Items ordered, reference no., etc." />
            </label>

            <button className="dt-submit" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Submit transaction'}
            </button>
          </form>

          {/* ------------------------- Recent transactions ------------------------- */}
          <section className="dt-card dt-feed">
            <div className="dt-feed-head">
              <div>
                <h2>Recent transactions</h2>
                <small>{totalRows.toLocaleString()} {totalRows === 1 ? 'entry' : 'entries'}{filterQ ? ' matching your search' : ''}</small>
              </div>
              <div className="dt-search">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input placeholder="Search name or company" value={filterQ} onChange={(e) => setFilterQ(e.target.value)} />
              </div>
            </div>

            <div className="dt-table-wrap">
              <table className="dt-table">
                <thead>
                  <tr><th>Medrep</th><th>Type</th><th className="r">Amount</th><th>Remarks</th><th>Via</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="dt-none">{filterQ ? 'No transactions match that search.' : 'No transactions yet.'}</td></tr>
                  )}
                  {rows.map((r) => {
                    const d = describe(r);
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="dt-name">{r.name}</div>
                          <div className="dt-co">{r.company}</div>
                        </td>
                        <td><span className={'dt-pill ' + d.tone}>{d.label}</span></td>
                        <td className="r dt-money">{d.amount ? money(d.amount) : '—'}</td>
                        <td className="dt-remarks" title={r.remarks}>{r.remarks || <span className="dt-dash">—</span>}</td>
                        <td className="dt-via">{r.sender_name || '—'}</td>
                        <td className="dt-date">{dateStr(r.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="dt-pager">
              <button type="button" disabled={page <= 1} onClick={() => loadFeed(page - 1, filterQ)}>← Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => loadFeed(page + 1, filterQ)}>Next →</button>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}

const CSS = `
.dt { --a:var(--brand-primary,#b52e1f); --a-soft:color-mix(in srgb,var(--a) 9%,#fff); --ink:#231d17; --mute:#7a7065; --line:#e6dfd4;
  --green:#2b7a4b; --green-soft:#e6f3ec; --red:#b42318; --red-soft:#fdecea; --card:#fff; color:var(--ink); max-width:1500px; }
.dt *, .dt *::before, .dt *::after { box-sizing:border-box; }
.dt h1, .dt h2 { margin:0; }

.dt-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:18px; }
.dt-head h1 { font-size:24px; font-weight:750; letter-spacing:-.02em; }
.dt-head span { font-size:13.5px; color:var(--mute); }

.dt-grid { display:grid; grid-template-columns:minmax(340px,420px) minmax(0,1fr); gap:18px; align-items:start; }
.dt-card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px; }
.dt-card h2 { font-size:16px; font-weight:700; margin-bottom:14px; }

/* form */
.dt-form { position:sticky; top:16px; }
.dt-field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.dt-field > span { font-size:12.5px; font-weight:600; color:#5b5249; }
.dt-field > span em { font-style:normal; font-weight:400; color:var(--mute); margin-left:4px; }
.dt-field input, .dt-field textarea { width:100%; padding:10px 12px; border:1px solid var(--line); border-radius:9px; background:#fff; font:inherit; font-size:14px; color:var(--ink); }
.dt-field textarea { resize:vertical; min-height:60px; }
.dt-field input::placeholder, .dt-field textarea::placeholder { color:#b9ada0; }
.dt-field input:focus, .dt-field textarea:focus { outline:2px solid var(--a); outline-offset:-1px; border-color:var(--a); }
.dt-gap { margin-top:8px; }
.dt-two { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.dt-warn { margin:-8px 0 14px; padding:8px 10px; border-radius:8px; background:var(--red-soft); color:var(--red); font-size:12.5px; }

.dt-chips { display:flex; flex-wrap:wrap; gap:6px; }
.dt-chip { cursor:pointer; padding:7px 12px; border-radius:8px; border:1px solid var(--line); background:#fff; font:inherit; font-size:13px; font-weight:550; color:#4d443b; transition:border-color .12s, background .12s; }
.dt-chip:hover { border-color:#cfc5b7; background:#faf7f2; }
.dt-chip.on { background:var(--a); border-color:var(--a); color:#fff; }
.dt-chip:focus-visible { outline:2px solid var(--a); outline-offset:2px; }

.dt-amount { display:flex; align-items:center; border:1px solid var(--line); border-radius:9px; background:#fff; padding-left:12px; }
.dt-amount:focus-within { outline:2px solid var(--a); outline-offset:-1px; border-color:var(--a); }
.dt-amount b { font-size:18px; color:var(--mute); font-weight:600; }
.dt-amount input { border:0 !important; outline:0 !important; font-size:20px !important; font-weight:650; font-variant-numeric:tabular-nums; padding:9px 12px 9px 8px !important; background:transparent !important; }

.dt-submit { width:100%; margin-top:4px; padding:12px; border:0; border-radius:10px; background:var(--a); color:#fff; font:inherit; font-size:14.5px; font-weight:650; cursor:pointer; transition:filter .12s; }
.dt-submit:hover:not(:disabled) { filter:brightness(.9); }
.dt-submit:disabled { opacity:.6; cursor:default; }

/* feed */
.dt-feed-head { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
.dt-feed-head h2 { margin-bottom:2px; }
.dt-feed-head small { font-size:12.5px; color:var(--mute); }
.dt-search { position:relative; width:min(100%,280px); }
.dt-search svg { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--mute); pointer-events:none; }
.dt-search input { width:100%; padding:9px 12px 9px 33px; border:1px solid var(--line); border-radius:9px; font:inherit; font-size:13.5px; background:#fff; }
.dt-search input:focus { outline:2px solid var(--a); outline-offset:-1px; border-color:var(--a); }

.dt-table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
.dt-table { width:100%; min-width:760px; border-collapse:collapse; font-size:13px; display:table; white-space:normal; }
.dt-table thead th { background:#f7f3ec; color:var(--mute); font-size:11px; font-weight:650; letter-spacing:.06em; text-transform:uppercase; padding:10px 12px; text-align:left; border-bottom:1px solid var(--line); white-space:nowrap; }
.dt-table td { padding:11px 12px; border-bottom:1px solid #f1ebe2; vertical-align:top; }
.dt-table tbody tr:last-child td { border-bottom:0; }
.dt-table tbody tr:hover { background:#fdfbf8; }
.dt-table .r { text-align:right; }
.dt-name { font-weight:650; text-transform:uppercase; font-size:12.5px; letter-spacing:.01em; }
.dt-co { font-size:12px; color:var(--mute); text-transform:uppercase; margin-top:1px; }
.dt-money { font-variant-numeric:tabular-nums; font-weight:600; white-space:nowrap; }
.dt-remarks { max-width:340px; color:#4d443b; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-transform:uppercase; font-size:12.5px; }
.dt-dash { color:#c4b9ab; }
.dt-via { color:var(--mute); white-space:nowrap; }
.dt-date { color:var(--mute); white-space:nowrap; font-size:12.5px; }
.dt-none { text-align:center; padding:36px 12px !important; color:var(--mute); }
.dt-pill { display:inline-block; padding:2px 9px; border-radius:99px; background:#f1ebe2; color:#5b5249; font-size:11.5px; font-weight:650; white-space:nowrap; }
.dt-pill.in { background:var(--green-soft); color:var(--green); }
.dt-pill.out { background:var(--red-soft); color:var(--red); }

.dt-pager { display:flex; align-items:center; justify-content:center; gap:14px; margin-top:14px; font-size:13px; color:var(--mute); }
.dt-pager button { cursor:pointer; padding:7px 13px; border-radius:8px; border:1px solid var(--line); background:#fff; font:inherit; font-size:13px; font-weight:600; color:var(--ink); }
.dt-pager button:hover:not(:disabled) { border-color:var(--a); color:var(--a); }
.dt-pager button:disabled { opacity:.4; cursor:default; }

@media (max-width:1100px) {
  .dt-grid { grid-template-columns:1fr; }
  .dt-form { position:static; }
}
@media (max-width:560px) {
  .dt-card { padding:14px; }
  .dt-two { grid-template-columns:1fr; }
}
`;

export default function Page() {
  return (
    <RequireAuth>
      <StaffPage />
    </RequireAuth>
  );
}