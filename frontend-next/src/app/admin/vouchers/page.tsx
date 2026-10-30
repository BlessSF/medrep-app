'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Layout from '../../../components/Layout';
import RequireAuth from '../../../components/RequireAuth';
import { Banner, Modal } from '../../../components/ui';
import api, { ApiError } from '../../../api/client';

type Voucher = { id: number; name: string; beginning: number; given_out: number; availed: number };
type Item = {
  series_no: number;
  date_given: string | null;
  customer_name: string;
  redeemed_by: string;
  payment_mode: string;
  remarks: string;
  date_availed: string | null;
  note: string;
};

const PAYMENT_MODES = ['Cash', 'GCash', 'Card', 'Cheque', 'Bank transfer', 'Other'];
const REMARKS = ['Sold', 'Sponsorship'];
const PAGE_SIZE = 50;

const blank = (series: number): Item => ({
  series_no: series, date_given: null, customer_name: '', redeemed_by: '',
  payment_mode: '', remarks: '', date_availed: null, note: '',
});
const isGivenOut = (i?: Item) => !!i && (!!i.date_given || i.customer_name.trim() !== '');

function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [beginning, setBeginning] = useState(0);
  const [items, setItems] = useState<Record<number, Item>>({});
  const itemsRef = useRef<Record<number, Item>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [onlyGiven, setOnlyGiven] = useState(false);
  const [page, setPage] = useState(0);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const [modal, setModal] = useState<'new' | 'beginning' | 'remove' | null>(null);
  const [formName, setFormName] = useState('');
  const [formQty, setFormQty] = useState('');

  const flash = (text: string, kind: 'success' | 'error' = 'success') => {
    setMsg({ text, kind });
    setTimeout(() => setMsg(null), 4000);
  };
  const errText = (e: unknown, fallback: string) =>
    e instanceof ApiError
      ? e.message
      : `${fallback} Could not reach /vouchers/index.php (${e instanceof Error ? e.message : 'network error'}) — check the file is uploaded to api/vouchers/ on your PHP host.`;

  async function loadList(selectId?: number | null) {
    const r = await api.get('/vouchers/index.php');
    setVouchers(r.vouchers);
    const next = selectId ?? activeId;
    const pick = r.vouchers.find((v: Voucher) => v.id === next) || r.vouchers[0];
    if (pick) await openVoucher(pick.id, false);
    else { setActiveId(null); setItems({}); itemsRef.current = {}; setBeginning(0); }
    setLoading(false);
  }

  async function openVoucher(id: number, refreshList = false) {
    const r = await api.get(`/vouchers/index.php?id=${id}`);
    const map: Record<number, Item> = {};
    r.items.forEach((i: Item) => { map[i.series_no] = i; });
    itemsRef.current = map;
    setItems(map);
    setActiveId(id);
    setBeginning(r.voucher.beginning);
    setPage(0); setQ(''); setOnlyGiven(false);
    if (refreshList) { const l = await api.get('/vouchers/index.php'); setVouchers(l.vouchers); }
  }

  useEffect(() => {
    loadList().catch((e) => { setLoading(false); flash(errText(e, 'Could not load vouchers.'), 'error'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist(row: Item) {
    if (!activeId) return;
    setSave('saving');
    try {
      await api.post('/vouchers/index.php', { action: 'save_item', voucher_id: activeId, ...row });
      setSave('saved');
    } catch (e) {
      setSave('error');
      flash(errText(e, 'Could not save that row.'), 'error');
    }
  }

  function patch(series: number, change: Partial<Item>, saveNow: boolean) {
    const row = { ...(itemsRef.current[series] || blank(series)), ...change };
    itemsRef.current = { ...itemsRef.current, [series]: row };
    setItems(itemsRef.current);
    if (saveNow) persist(row);
  }
  const saveCurrent = (series: number) => {
    const row = itemsRef.current[series];
    if (row) persist(row);
  };

  // live counts for the open voucher (so tiles update instantly as you type)
  const liveOut = useMemo(() => Object.values(items).filter(isGivenOut).length, [items]);
  const liveAvailed = useMemo(() => Object.values(items).filter((i) => !!i.date_availed).length, [items]);
  const rows = vouchers.map((v) => v.id === activeId ? { ...v, beginning, given_out: liveOut, availed: liveAvailed } : v);
  const active = rows.find((v) => v.id === activeId) || null;
  const totalOut = rows.reduce((s, v) => s + v.given_out, 0);
  const totalLeft = rows.reduce((s, v) => s + (v.beginning - v.given_out), 0);

  const pad = Math.max(3, String(beginning).length);
  const series = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out: number[] = [];
    for (let n = 1; n <= beginning; n++) {
      const it = items[n];
      if (onlyGiven && !isGivenOut(it)) continue;
      if (needle) {
        const hay = [String(n), String(n).padStart(pad, '0'), it?.customer_name, it?.redeemed_by, it?.payment_mode, it?.remarks, it?.note, it?.date_given, it?.date_availed]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      out.push(n);
    }
    return out;
  }, [items, beginning, q, onlyGiven, pad]);

  const pages = Math.max(1, Math.ceil(series.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = series.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  async function createVoucher(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post('/vouchers/index.php', { action: 'create', name: formName, beginning: Number(formQty) });
      setModal(null); setFormName(''); setFormQty('');
      await loadList(r.id);
      flash(r.message);
    } catch (err) { flash(errText(err, 'Could not create voucher.'), 'error'); }
  }

  async function changeBeginning(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/vouchers/index.php', { action: 'set_beginning', id: activeId, beginning: Number(formQty) });
      setModal(null);
      await openVoucher(activeId!, true);
      flash('Beginning quantity updated.');
    } catch (err) { flash(errText(err, 'Could not update quantity.'), 'error'); }
  }

  async function removeVoucher() {
    if (!active) return;
    try {
      await api.post('/vouchers/index.php', { action: 'delete', id: active.id });
      setModal(null);
      await loadList(null);
      flash('Voucher removed.');
    } catch (err) { flash(errText(err, 'Could not remove voucher.'), 'error'); }
  }

  function exportExcel() {
    if (!active) return;
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const head = ['Date', 'Sold out', 'Series no.', 'Customer name', 'Redeemed by', 'Mode of payment', 'Remarks', 'Date availed', 'Note (c/o Acctng)'];
    const lines = [head.map(esc).join(',')];
    for (let n = 1; n <= beginning; n++) {
      const it = items[n] || blank(n);
      lines.push([longDate(it.date_given), isGivenOut(it) ? 'SOLD OUT' : 'IN STOCK', String(n).padStart(pad, '0'),
        it.customer_name, it.redeemed_by, it.payment_mode, it.remarks, longDate(it.date_availed), it.note].map(esc).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${active.name.replace(/[^\w]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const saveLabel = save === 'saving' ? 'Saving…' : save === 'error' ? 'Save failed' : save === 'saved' ? 'All changes saved' : 'All changes save automatically';

  const pctOut = active && active.beginning ? Math.min(100, Math.round((active.given_out / active.beginning) * 100)) : 0;
  const pctAvailed = active && active.given_out ? Math.min(100, Math.round((active.availed / active.given_out) * 100)) : 0;

  return (
    <Layout>
      <style>{VM_CSS}</style>
      <div className="vm">
        <Banner message={msg?.text || ''} kind={msg?.kind || 'success'} />

        {/* ---------- Page header ---------- */}
        <header className="vm-head">
          <div className="vm-head-text">
            <h1>Voucher Monitoring</h1>
            <p>Track every voucher from stock, to customer, to redeemed.</p>
          </div>
          <div className="vm-kpis">
            <div className="vm-kpi"><span className="vm-kpi-ico"><TicketIcon small /></span><div><b>{rows.length}</b><small>Vouchers</small></div></div>
            <div className="vm-kpi"><span className="vm-kpi-ico out"><ArrowIcon /></span><div><b>{totalOut.toLocaleString()}</b><small>Given out</small></div></div>
            <div className="vm-kpi"><span className="vm-kpi-ico stock"><BoxIcon /></span><div><b>{totalLeft.toLocaleString()}</b><small>In stock</small></div></div>
          </div>
        </header>

        {/* ---------- Voucher picker ---------- */}
        <div className="vm-picker" role="tablist" aria-label="Vouchers">
          {rows.map((v) => {
            const pct = v.beginning ? Math.min(100, (v.given_out / v.beginning) * 100) : 0;
            const low = v.beginning > 0 && v.beginning - v.given_out <= v.beginning * 0.1;
            return (
              <button key={v.id} role="tab" aria-selected={v.id === activeId}
                className={'vm-card' + (v.id === activeId ? ' on' : '')}
                onClick={() => v.id !== activeId && openVoucher(v.id)}>
                <span className="vm-card-top">
                  <span className="vm-card-name">{v.name}</span>
                  {low && <span className="vm-chip warn">Low</span>}
                </span>
                <span className="vm-card-nums"><b>{v.given_out.toLocaleString()}</b><small>/ {v.beginning.toLocaleString()} out</small></span>
                <span className="vm-bar"><i style={{ width: pct + '%' }} /></span>
              </button>
            );
          })}
          <button className="vm-card vm-new" onClick={() => { setFormName(''); setFormQty(''); setModal('new'); }}>
            <span className="vm-plus">+</span>
            <span>New voucher</span>
          </button>
        </div>

        {loading && <div className="vm-empty">Loading vouchers…</div>}
        {!loading && !active && (
          <div className="vm-blank">
            <TicketIcon />
            <h3>No vouchers yet</h3>
            <p>Add your first voucher to start tracking stock and redemptions.</p>
            <button className="vm-btn solid" onClick={() => { setFormName(''); setFormQty(''); setModal('new'); }}>+ New voucher</button>
          </div>
        )}

        {active && (
          <section className="vm-panel">
            {/* ---------- Panel header ---------- */}
            <div className="vm-panel-head">
              <div>
                <h2>{active.name}</h2>
                <span className={'vm-save ' + save}><i />{saveLabel}</span>
              </div>
              <div className="vm-actions">
                <button className="vm-btn" onClick={exportExcel}><DownloadIcon /> Export to Excel</button>
                <button className="vm-btn danger" onClick={() => setModal('remove')}><TrashIcon /> Remove</button>
              </div>
            </div>

            {/* ---------- Summary tiles ---------- */}
            <div className="vm-stats">
              <div className="vm-stat">
                <label>Beginning</label>
                <b>{active.beginning.toLocaleString()}</b>
                <button className="vm-link" onClick={() => { setFormQty(String(active.beginning)); setModal('beginning'); }}>Change quantity</button>
              </div>
              <div className="vm-stat">
                <label>Total out</label>
                <b className="c-out">{active.given_out.toLocaleString()}</b>
                <small>{pctOut}% given to customers</small>
              </div>
              <div className="vm-stat">
                <label>Ending</label>
                <b className="c-stock">{(active.beginning - active.given_out).toLocaleString()}</b>
                <small>still available</small>
              </div>
              <div className="vm-stat">
                <label>Availed</label>
                <b className="c-done">{active.availed.toLocaleString()}</b>
                <small>{pctAvailed}% of given out redeemed</small>
              </div>
            </div>

            {/* ---------- Toolbar ---------- */}
            <div className="vm-toolbar">
              <div className="vm-search-wrap">
                <SearchIcon />
                <input className="vm-search" placeholder="Search series no., name, note…" value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(0); }} />
                {q && <button className="vm-clear" aria-label="Clear search" onClick={() => { setQ(''); setPage(0); }}>✕</button>}
              </div>
              <div className="vm-seg" role="group" aria-label="Filter rows">
                <button className={!onlyGiven ? 'on' : ''} onClick={() => { setOnlyGiven(false); setPage(0); }}>All</button>
                <button className={onlyGiven ? 'on' : ''} onClick={() => { setOnlyGiven(true); setPage(0); }}>Given out</button>
              </div>
              <span className="vm-count">{series.length.toLocaleString()} {series.length === 1 ? 'row' : 'rows'}</span>
            </div>

            {/* ---------- Table ---------- */}
            <div className="vm-table-wrap">
              <table className="vm-table">
                <thead>
                  <tr>
                    <th>Series</th><th>Status</th><th>Date given</th><th>Customer name</th>
                    <th>Redeemed by</th><th>Payment</th><th>Remarks</th>
                    <th>Date availed</th><th>Note (c/o Acctng)</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && (
                    <tr><td colSpan={9} className="vm-empty">Nothing matches your search.</td></tr>
                  )}
                  {visible.map((n) => {
                    const it = items[n] || blank(n);
                    const out = isGivenOut(it);
                    const state = it.date_availed ? 'availed' : out ? 'out' : '';
                    return (
                      <tr key={n} className={state}>
                        <td><span className="vm-series">{String(n).padStart(pad, '0')}</span></td>
                        <td><span className={'vm-status ' + state}>{it.date_availed ? 'Availed' : out ? 'Given out' : 'In stock'}</span></td>
                        <td><DateField value={it.date_given} onChange={(v) => patch(n, { date_given: v }, true)} /></td>
                        <td><input placeholder="Customer" value={it.customer_name} onChange={(e) => patch(n, { customer_name: e.target.value }, false)} onBlur={() => saveCurrent(n)} /></td>
                        <td><input placeholder="Who redeemed it" value={it.redeemed_by} onChange={(e) => patch(n, { redeemed_by: e.target.value }, false)} onBlur={() => saveCurrent(n)} /></td>
                        <td><select value={it.payment_mode} onChange={(e) => patch(n, { payment_mode: e.target.value }, true)}>
                          <option value="">—</option>{PAYMENT_MODES.map((o) => <option key={o}>{o}</option>)}</select></td>
                        <td><select value={it.remarks} onChange={(e) => patch(n, { remarks: e.target.value }, true)}>
                          <option value="">—</option>{REMARKS.map((o) => <option key={o}>{o}</option>)}</select></td>
                        <td><DateField value={it.date_availed} onChange={(v) => patch(n, { date_availed: v }, true)} /></td>
                        <td><input placeholder="Add note" value={it.note} onChange={(e) => patch(n, { note: e.target.value }, false)} onBlur={() => saveCurrent(n)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ---------- Pager ---------- */}
            <div className="vm-pager">
              <span>Showing {series.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–{Math.min(series.length, (safePage + 1) * PAGE_SIZE)} of {series.length.toLocaleString()}</span>
              <div>
                <button className="vm-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>← Prev</button>
                <span className="vm-page">Page {safePage + 1} / {pages}</span>
                <button className="vm-btn" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>Next →</button>
              </div>
            </div>
          </section>
        )}
      </div>

      {modal === 'new' && (
        <Modal title="New voucher" onClose={() => setModal(null)}>
          <form onSubmit={createVoucher}>
            <div className="field"><label>Voucher name</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. FREE NACHOS" required autoFocus /></div>
            <div className="field" style={{ marginTop: 10 }}><label>Beginning quantity</label>
              <input type="number" min={1} max={100000} value={formQty} onChange={(e) => setFormQty(e.target.value)} placeholder="e.g. 3500" required /></div>
            <button className="vm-btn solid" type="submit" style={{ marginTop: 14 }}>Create voucher</button>
          </form>
        </Modal>
      )}
      {modal === 'beginning' && (
        <Modal title="Change beginning quantity" onClose={() => setModal(null)}>
          <form onSubmit={changeBeginning}>
            <div className="field"><label>Beginning quantity</label>
              <input type="number" min={1} max={100000} value={formQty} onChange={(e) => setFormQty(e.target.value)} required autoFocus /></div>
            <p className="muted" style={{ fontSize: 12.5 }}>Existing rows are kept. You can’t go below the highest series number that already has data.</p>
            <button className="vm-btn solid" type="submit" style={{ marginTop: 8 }}>Save</button>
          </form>
        </Modal>
      )}
      {modal === 'remove' && active && (
        <Modal title="Remove voucher?" onClose={() => setModal(null)}>
          <p style={{ margin: '0 0 6px' }}>This permanently deletes <b>{active.name}</b> and its {active.given_out} recorded rows.</p>
          <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="vm-btn danger solid" onClick={removeVoucher}>Yes, remove it</button>
            <button className="vm-btn" onClick={() => setModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function longDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// Shows "January 12, 2026" but still uses the browser's native calendar picker.
function DateField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="vm-date" onClick={() => { try { ref.current?.showPicker(); } catch { ref.current?.focus(); } }}>
      <span className={value ? '' : 'ph'}>{value ? longDate(value) : 'Pick a date'}</span>
      <svg className="cal" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
      <input ref={ref} type="date" value={value || ''} onChange={(e) => onChange(e.target.value || null)} tabIndex={-1} />
    </div>
  );
}

function TicketIcon({ small }: { small?: boolean }) {
  const s = small ? 18 : 34;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.2a2.8 2.8 0 0 0 0 5.6V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.2a2.8 2.8 0 0 0 0-5.6V7Z" />
    </svg>
  );
}
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
const ArrowIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const BoxIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg>;
const SearchIcon = () => <svg className="vm-search-ico" width="16" height="16" viewBox="0 0 24 24" {...stroke}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
const DownloadIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>;
const TrashIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;

const VM_CSS = `
.vm { --a:var(--brand-primary,#d9580d); --a-soft:color-mix(in srgb,var(--a) 10%,#fff); --a-line:color-mix(in srgb,var(--a) 28%,#fff);
  --ink:#241c15; --mute:#7a6c5f; --line:#e8e0d5; --bg:#faf7f2; --card:#fff;
  --green:#2e7d4f; --green-soft:#e7f4ec; --warn:#b7791f; --warn-soft:#fdf3dc; --red:#b42318;
  color:var(--ink); max-width:1500px; }
.vm *, .vm *::before, .vm *::after { box-sizing:border-box; }
.vm h1, .vm h2, .vm h3 { margin:0; }

/* header */
.vm-head { display:flex; justify-content:space-between; align-items:center; gap:24px; flex-wrap:wrap; margin-bottom:22px; }
.vm-head h1 { font-size:26px; font-weight:750; letter-spacing:-.02em; }
.vm-head p { margin:4px 0 0; font-size:14px; color:var(--mute); }
.vm-kpis { display:flex; gap:10px; flex-wrap:wrap; }
.vm-kpi { display:flex; align-items:center; gap:12px; padding:10px 18px 10px 12px; background:var(--card); border:1px solid var(--line); border-radius:12px; box-shadow:0 1px 2px rgba(36,28,21,.04); }
.vm-kpi b { display:block; font-size:20px; line-height:1.1; font-weight:750; font-variant-numeric:tabular-nums; }
.vm-kpi small { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--mute); }
.vm-kpi-ico { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; background:var(--a-soft); color:var(--a); }
.vm-kpi-ico.out { background:var(--warn-soft); color:var(--warn); }
.vm-kpi-ico.stock { background:var(--green-soft); color:var(--green); }

/* picker */
.vm-picker { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:10px; margin-bottom:22px; }
.vm-card { cursor:pointer; text-align:left; font:inherit; display:flex; flex-direction:column; gap:6px; padding:13px 14px 12px; background:var(--card); border:1px solid var(--line);
  border-radius:12px; transition:border-color .15s, box-shadow .15s, transform .15s; color:var(--ink); }
.vm-card:hover { border-color:var(--a-line); box-shadow:0 4px 14px rgba(36,28,21,.07); transform:translateY(-1px); }
.vm-card.on { border-color:var(--a); box-shadow:0 0 0 3px var(--a-soft); background:linear-gradient(180deg,var(--a-soft),#fff 70%); }
.vm-card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:6px; }
.vm-card-name { font-size:12.5px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; line-height:1.3; }
.vm-card-nums { display:flex; align-items:baseline; gap:5px; }
.vm-card-nums b { font-size:20px; font-weight:750; font-variant-numeric:tabular-nums; }
.vm-card-nums small { font-size:12px; color:var(--mute); }
.vm-bar { display:block; height:5px; border-radius:99px; background:#efe8de; overflow:hidden; }
.vm-bar i { display:block; height:100%; border-radius:99px; background:var(--a); transition:width .3s; }
.vm-chip { font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; padding:2px 7px; border-radius:99px; }
.vm-chip.warn { background:var(--warn-soft); color:var(--warn); }
.vm-new { align-items:center; justify-content:center; flex-direction:row; gap:8px; border-style:dashed; border-width:1.5px; color:var(--a); font-weight:650; font-size:13.5px; background:transparent; }
.vm-new:hover { background:var(--a-soft); }
.vm-plus { width:24px; height:24px; border-radius:50%; background:var(--a); color:#fff; display:grid; place-items:center; font-size:17px; line-height:1; }

/* empty states */
.vm-empty { text-align:center; padding:30px; color:var(--mute); }
.vm-blank { display:flex; flex-direction:column; align-items:center; gap:6px; text-align:center; padding:56px 20px; background:var(--card); border:1px dashed var(--line); border-radius:14px; color:var(--a); }
.vm-blank h3 { color:var(--ink); font-size:17px; margin-top:6px; }
.vm-blank p { margin:0 0 12px; color:var(--mute); font-size:13.5px; }

/* panel */
.vm-panel { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:20px; box-shadow:0 1px 3px rgba(36,28,21,.04); }
.vm-panel-head { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap; margin-bottom:18px; }
.vm-panel-head h2 { font-size:20px; font-weight:750; letter-spacing:-.01em; text-transform:uppercase; }
.vm-actions { display:flex; gap:8px; flex-wrap:wrap; }
.vm-save { display:inline-flex; align-items:center; gap:6px; margin-top:5px; font-size:12px; color:var(--mute); }
.vm-save i { width:7px; height:7px; border-radius:50%; background:#cfc3b5; }
.vm-save.saving i { background:var(--warn); animation:vmpulse 1s infinite; }
.vm-save.saved { color:var(--green); } .vm-save.saved i { background:var(--green); }
.vm-save.error { color:var(--red); font-weight:600; } .vm-save.error i { background:var(--red); }
@keyframes vmpulse { 50% { opacity:.25; } }

/* buttons */
.vm-btn { display:inline-flex; align-items:center; gap:7px; cursor:pointer; padding:8px 14px; border-radius:9px; font:inherit; font-weight:600; font-size:13px; background:var(--card); color:var(--ink); border:1px solid var(--line); transition:all .15s; }
.vm-btn:hover:not(:disabled) { border-color:var(--a); color:var(--a); background:var(--a-soft); }
.vm-btn:disabled { opacity:.4; cursor:default; }
.vm-btn.danger { color:var(--red); }
.vm-btn.danger:hover:not(:disabled) { border-color:var(--red); color:var(--red); background:#fdecea; }
.vm-btn.solid { background:var(--a); color:#fff; border-color:var(--a); }
.vm-btn.solid:hover { filter:brightness(.92); background:var(--a); color:#fff; }
.vm-btn.danger.solid { background:var(--red); border-color:var(--red); color:#fff; }
.vm-btn.danger.solid:hover { background:var(--red); color:#fff; }

/* stat tiles */
.vm-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; margin-bottom:18px; }
.vm-stat { padding:14px 16px; background:var(--bg); border:1px solid var(--line); border-radius:12px; }
.vm-stat label { display:block; font-size:11px; font-weight:650; letter-spacing:.07em; text-transform:uppercase; color:var(--mute); }
.vm-stat b { display:block; font-size:32px; font-weight:780; line-height:1.15; margin:4px 0 2px; font-variant-numeric:tabular-nums; letter-spacing:-.02em; }
.vm-stat b.c-out { color:var(--warn); } .vm-stat b.c-stock { color:var(--a); } .vm-stat b.c-done { color:var(--green); }
.vm-stat small { font-size:12px; color:var(--mute); }
.vm-link { background:none; border:0; padding:0; font:inherit; font-size:12.5px; font-weight:600; color:var(--a); cursor:pointer; }
.vm-link:hover { text-decoration:underline; }

/* toolbar */
.vm-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.vm-search-wrap { position:relative; flex:0 1 340px; min-width:220px; }
.vm-search-ico { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--mute); pointer-events:none; }
.vm-search { width:100%; padding:9px 32px 9px 34px; border-radius:10px; border:1px solid var(--line); background:var(--card); font:inherit; font-size:13.5px; }
.vm-clear { position:absolute; right:6px; top:50%; transform:translateY(-50%); width:22px; height:22px; border:0; border-radius:50%; background:#efe8de; color:var(--mute); font-size:10px; cursor:pointer; }
.vm-search:focus, .vm-table input:focus, .vm-table select:focus { outline:2px solid var(--a); outline-offset:-1px; background:#fff; }
.vm-seg { display:inline-flex; padding:3px; background:#f1ebe2; border-radius:10px; }
.vm-seg button { border:0; background:none; font:inherit; font-size:13px; font-weight:600; padding:6px 14px; border-radius:7px; cursor:pointer; color:var(--mute); }
.vm-seg button.on { background:var(--card); color:var(--ink); box-shadow:0 1px 3px rgba(36,28,21,.12); }
.vm-count { margin-left:auto; font-size:12.5px; color:var(--mute); font-variant-numeric:tabular-nums; }

/* table */
.vm-table-wrap { overflow:auto; max-height:calc(100vh - 190px); min-height:240px; border:1px solid var(--line); border-radius:12px; background:var(--card); }
.vm-table { width:100%; min-width:1120px; border-collapse:separate; border-spacing:0; font-size:13px; }
.vm-table thead th { position:sticky; top:0; z-index:2; background:var(--bg); padding:11px 10px; font-size:11px; font-weight:700; letter-spacing:.07em; text-transform:uppercase;
  color:var(--mute); text-align:left; border-bottom:1px solid var(--line); white-space:nowrap; }
.vm-table td { padding:4px 6px; border-bottom:1px solid #f3ede4; vertical-align:middle; }
.vm-table tbody tr:last-child td { border-bottom:0; }
.vm-table tbody tr:hover td { background:#fdfaf6; }
.vm-table tbody tr.out td:first-child { box-shadow:inset 3px 0 0 var(--warn); }
.vm-table tbody tr.availed td:first-child { box-shadow:inset 3px 0 0 var(--green); }
.vm-table input, .vm-table select { width:100%; height:34px; padding:0 9px; border:1px solid transparent; border-radius:7px; background:transparent; font:inherit; font-size:13px; min-width:0; color:var(--ink); }
.vm-table select { cursor:pointer; min-width:110px; }
.vm-table input:hover, .vm-table select:hover, .vm-date:hover { border-color:var(--line); background:#fff; }
.vm-table input::placeholder { color:#bcae9f; }
.vm-date { position:relative; display:flex; align-items:center; justify-content:space-between; gap:8px; height:34px; padding:0 9px; border:1px solid transparent; border-radius:7px; font-size:13px; cursor:pointer; white-space:nowrap; min-width:150px; }
.vm-date .ph { color:#bcae9f; }
.vm-date .cal { color:#b3a595; flex-shrink:0; }
.vm-date:hover .cal { color:var(--a); }
.vm-date input { position:absolute; inset:0; width:100%; height:100%; opacity:0; pointer-events:none; }
.vm-series { display:inline-block; font-family:var(--mono); font-size:12px; font-weight:600; padding:3px 9px; margin-left:4px; border-radius:6px; background:#f1ebe2; color:#5a4d41; }
.vm-status { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:650; padding:3px 10px; border-radius:99px; background:#f1ebe2; color:var(--mute); white-space:nowrap; }
.vm-status::before { content:''; width:6px; height:6px; border-radius:50%; background:currentColor; opacity:.7; }
.vm-status.out { background:var(--warn-soft); color:var(--warn); }
.vm-status.availed { background:var(--green-soft); color:var(--green); }

/* pager */
.vm-pager { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-top:14px; font-size:13px; color:var(--mute); }
.vm-pager > div { display:flex; align-items:center; gap:10px; }
.vm-page { font-variant-numeric:tabular-nums; }

@media (max-width:700px) {
  .vm-panel { padding:14px; border-radius:12px; }
  .vm-count { margin-left:0; }
  .vm-kpi { flex:1 1 40%; }
}
`;

export default function Page() {
  return (
    <RequireAuth role="admin">
      <VouchersPage />
    </RequireAuth>
  );
}