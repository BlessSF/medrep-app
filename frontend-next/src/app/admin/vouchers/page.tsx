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
  const [modal, setModal] = useState<'new' | 'beginning' | null>(null);
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
    if (!confirm(`Remove "${active.name}" and all ${active.given_out} recorded rows? This cannot be undone.`)) return;
    try {
      await api.post('/vouchers/index.php', { action: 'delete', id: active.id });
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

  return (
    <Layout>
      <style>{VM_CSS}</style>
      <div className="vm">
        <Banner message={msg?.text || ''} kind={msg?.kind || 'success'} />

        <header className="vm-head">
          <div>
            <h1>Voucher Monitoring</h1>
            <p>Track every voucher from stock to customer to redeemed.</p>
          </div>
          <dl className="vm-head-stats">
            <div><dd>{rows.length}</dd><dt>Vouchers</dt></div>
            <div><dd>{totalOut}</dd><dt>Given out</dt></div>
            <div><dd>{totalLeft}</dd><dt>In stock</dt></div>
          </dl>
        </header>

        <div className="vm-tabs" role="tablist">
          {rows.map((v) => {
            const pct = v.beginning ? Math.min(100, (v.given_out / v.beginning) * 100) : 0;
            return (
              <button key={v.id} role="tab" aria-selected={v.id === activeId} className={'vm-tab' + (v.id === activeId ? ' on' : '')}
                onClick={() => v.id !== activeId && openVoucher(v.id)}>
                <span className="vm-tab-name">{v.name}</span>
                <span className="vm-tab-meta">{v.given_out} / {v.beginning} out</span>
                <span className="vm-bar"><i style={{ width: pct + '%' }} /></span>
              </button>
            );
          })}
          <button className="vm-tab vm-new" onClick={() => { setFormName(''); setFormQty(''); setModal('new'); }}>
            + New voucher
          </button>
        </div>

        {loading && <div className="vm-empty">Loading…</div>}
        {!loading && !active && <div className="vm-empty">No vouchers yet. Click “New voucher” to add your first one.</div>}

        {active && (
          <>
            <div className="vm-stats">
              <div><label>Beginning</label><b>{active.beginning}</b>
                <button className="vm-link" onClick={() => { setFormQty(String(active.beginning)); setModal('beginning'); }}>Change</button></div>
              <div><label>Total out</label><b>{active.given_out}</b><small>given to customers</small></div>
              <div><label>Ending</label><b>{active.beginning - active.given_out}</b><small>still available</small></div>
              <div><label>Availed</label><b>{active.availed}</b><small>with a date availed</small></div>
            </div>

            <div className="vm-toolbar">
              <input className="vm-search" placeholder="Search series no., name, note…" value={q}
                onChange={(e) => { setQ(e.target.value); setPage(0); }} />
              <label className="vm-check">
                <input type="checkbox" checked={onlyGiven} onChange={(e) => { setOnlyGiven(e.target.checked); setPage(0); }} />
                Show given out only
              </label>
              <span className="vm-spacer" />
              <button className="vm-btn" onClick={exportExcel}>Export to Excel</button>
              <button className="vm-btn danger" onClick={removeVoucher}>Remove voucher</button>
              <span className={'vm-save ' + save}>{saveLabel}</span>
            </div>

            <div className="vm-table-wrap">
              <table className="vm-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Status</th><th>Series no.</th><th>Customer name</th>
                    <th>Redeemed by</th><th>Mode of payment</th><th>Remarks</th>
                    <th>Date availed</th><th>Note (c/o Acctng)</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && <tr><td colSpan={9} className="vm-empty">Nothing matches.</td></tr>}
                  {visible.map((n) => {
                    const it = items[n] || blank(n);
                    const out = isGivenOut(it);
                    return (
                      <tr key={n}>
                        <td><DateField value={it.date_given} onChange={(v) => patch(n, { date_given: v }, true)} /></td>
                        <td><span className={'vm-status' + (it.date_availed ? ' availed' : out ? ' out' : '')}>{it.date_availed ? 'Availed' : out ? 'Sold out' : 'In stock'}</span></td>
                        <td className="vm-series">{String(n).padStart(pad, '0')}</td>
                        <td><input value={it.customer_name} onChange={(e) => patch(n, { customer_name: e.target.value }, false)} onBlur={() => saveCurrent(n)} /></td>
                        <td><input placeholder="Who redeemed it" value={it.redeemed_by} onChange={(e) => patch(n, { redeemed_by: e.target.value }, false)} onBlur={() => saveCurrent(n)} /></td>
                        <td><select value={it.payment_mode} onChange={(e) => patch(n, { payment_mode: e.target.value }, true)}>
                          <option value="" />{PAYMENT_MODES.map((o) => <option key={o}>{o}</option>)}</select></td>
                        <td><select value={it.remarks} onChange={(e) => patch(n, { remarks: e.target.value }, true)}>
                          <option value="" />{REMARKS.map((o) => <option key={o}>{o}</option>)}</select></td>
                        <td><DateField value={it.date_availed} onChange={(v) => patch(n, { date_availed: v }, true)} /></td>
                        <td><input value={it.note} onChange={(e) => patch(n, { note: e.target.value }, false)} onBlur={() => saveCurrent(n)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="vm-pager">
              <button className="vm-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>← Prev</button>
              <span>Page {safePage + 1} of {pages} · {series.length} rows</span>
              <button className="vm-btn" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>Next →</button>
            </div>
          </>
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
  const s = small ? 16 : 30;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.2a2.8 2.8 0 0 0 0 5.6V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.2a2.8 2.8 0 0 0 0-5.6V7Z" />
    </svg>
  );
}

const VM_CSS = `
.vm { --o:#d9580d; --o-dark:#a8430a; --ink:#2b2118; --mute:#7d6c5e; --line:#e6ddd2; --soft:#faf6f1; --paper:#fff; color:var(--ink); }
.vm * { box-sizing:border-box; }

.vm-head { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap;
  padding:0 0 16px; border-bottom:2px solid var(--o); margin-bottom:20px; }
.vm-head h1 { margin:0; font-size:24px; font-weight:700; letter-spacing:-.015em; }
.vm-head p { margin:4px 0 0; font-size:13.5px; color:var(--mute); }
.vm-head-stats { display:flex; margin:0; }
.vm-head-stats div { padding:0 22px; border-left:1px solid var(--line); text-align:right; }
.vm-head-stats div:first-child { border-left:0; }
.vm-head-stats dd { margin:0; font-size:22px; font-weight:700; font-variant-numeric:tabular-nums; color:var(--o-dark); }
.vm-head-stats dt { font-size:11px; color:var(--mute); text-transform:uppercase; letter-spacing:.06em; }

.vm-tabs { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:18px; border-bottom:1px solid var(--line); }
.vm-tab { cursor:pointer; font:inherit; text-align:left; background:none; border:0; border-bottom:3px solid transparent; margin-bottom:-1px;
  padding:10px 16px 9px; min-width:150px; display:flex; flex-direction:column; gap:3px; color:var(--mute); }
.vm-tab:hover { background:var(--soft); }
.vm-tab-name { font-size:13px; font-weight:700; color:var(--ink); text-transform:uppercase; letter-spacing:.02em; }
.vm-tab-meta { font-size:12px; font-variant-numeric:tabular-nums; }
.vm-bar { display:block; height:3px; background:var(--line); margin-top:4px; }
.vm-bar i { display:block; height:100%; background:var(--o); }
.vm-tab.on { border-bottom-color:var(--o); background:var(--soft); }
.vm-tab.on .vm-tab-meta { color:var(--o-dark); }
.vm-new { min-width:0; flex-direction:row; align-items:center; color:var(--o-dark); font-weight:600; font-size:13px; padding:0 14px; }

.vm-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); background:var(--paper); border:1px solid var(--line); border-radius:6px; margin-bottom:18px; }
.vm-stats > div { padding:14px 18px; border-left:1px solid var(--line); }
.vm-stats > div:first-child { border-left:0; }
.vm-stats label { display:block; font-size:11px; font-weight:600; letter-spacing:.07em; text-transform:uppercase; color:var(--mute); }
.vm-stats b { display:block; font-size:30px; font-weight:700; line-height:1.15; margin:3px 0 2px; font-variant-numeric:tabular-nums; }
.vm-stats small { font-size:12px; color:var(--mute); }
.vm-link { background:none; border:0; padding:0; font:inherit; font-size:12px; color:var(--o-dark); text-decoration:underline; cursor:pointer; }

.vm-toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
.vm-search { flex:0 1 300px; min-width:200px; padding:8px 12px; border-radius:6px; border:1px solid var(--line); background:var(--paper); font:inherit; font-size:13.5px; }
.vm-search:focus, .vm-table input:focus, .vm-table select:focus { outline:2px solid var(--o); outline-offset:-1px; }
.vm-check { display:flex; gap:6px; align-items:center; font-size:13px; cursor:pointer; color:var(--ink); }
.vm-check input { accent-color:var(--o); }
.vm-spacer { flex:1; }
.vm-btn { cursor:pointer; padding:8px 14px; border-radius:6px; font:inherit; font-weight:600; font-size:13px; background:var(--paper); color:var(--ink); border:1px solid var(--line); }
.vm-btn:hover:not(:disabled) { border-color:var(--o); color:var(--o-dark); }
.vm-btn:disabled { opacity:.4; cursor:default; }
.vm-btn.danger { color:#a3281d; }
.vm-btn.danger:hover:not(:disabled) { border-color:#a3281d; color:#a3281d; }
.vm-btn.solid { background:var(--o); color:#fff; border-color:var(--o); }
.vm-btn.solid:hover { background:var(--o-dark); color:#fff; }
.vm-save { font-size:12px; color:var(--mute); min-width:150px; text-align:right; }
.vm-save.saved { color:#2f7d32; } .vm-save.error { color:#a3281d; font-weight:600; }

.vm-table-wrap { overflow:auto; max-height:calc(100vh - 150px); border:1px solid var(--line); border-radius:6px; background:var(--paper); }
.vm-table { width:100%; min-width:1080px; border-collapse:separate; border-spacing:0; font-size:13px; }
.vm-table thead th { position:sticky; top:0; z-index:2; background:#f3ebe1; color:var(--ink); padding:10px 10px; font-size:11px; font-weight:700;
  letter-spacing:.06em; text-transform:uppercase; text-align:left; border-bottom:2px solid var(--o); white-space:nowrap; }
.vm-table td { padding:3px 6px; border-bottom:1px solid #f0e9e0; vertical-align:middle; }
.vm-table tbody tr:hover td { background:#fffaf4; }
.vm-table input, .vm-table select { width:100%; height:32px; padding:0 8px; border:1px solid transparent; border-radius:4px; background:transparent; font:inherit; font-size:13px; min-width:0; color:var(--ink); }
.vm-table input:hover, .vm-table select:hover, .vm-date:hover { border-color:var(--line); background:#fff; }
.vm-table input::placeholder { color:#b3a595; }
.vm-date { position:relative; display:flex; align-items:center; justify-content:space-between; gap:6px; height:32px; padding:0 8px; border:1px solid transparent; border-radius:4px; font-size:13px; cursor:pointer; white-space:nowrap; min-width:150px; }
.vm-date .ph { color:#b3a595; }
.vm-date .cal { color:#a89684; flex-shrink:0; }
.vm-date input { position:absolute; inset:0; width:100%; height:100%; opacity:0; pointer-events:none; }
.vm-series { font-family:var(--mono); font-weight:600; color:var(--mute); padding-left:10px !important; }
.vm-status { display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:600; color:var(--mute); white-space:nowrap; }
.vm-status::before { content:''; width:8px; height:8px; border-radius:50%; background:#cdbfb1; }
.vm-status.out { color:var(--o-dark); } .vm-status.out::before { background:var(--o); }
.vm-status.availed { color:#2f7d32; } .vm-status.availed::before { background:#2f7d32; }
.vm-pager { display:flex; justify-content:center; align-items:center; gap:14px; margin:14px 0 4px; font-size:13px; color:var(--mute); }
.vm-empty { text-align:center; padding:28px; color:var(--mute); }
@media (max-width:700px) { .vm-head-stats div { padding:0 12px; } .vm-tab { flex:1 1 40%; } }
`;

export default function Page() {
  return (
    <RequireAuth role="admin">
      <VouchersPage />
    </RequireAuth>
  );
}