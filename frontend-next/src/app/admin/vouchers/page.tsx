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

const PAYMENT_MODES = ['Cash', 'GCash', 'Card', 'Bank transfer', 'Other'];
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

  const series = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out: number[] = [];
    for (let n = 1; n <= beginning; n++) {
      const it = items[n];
      if (onlyGiven && !isGivenOut(it)) continue;
      if (needle) {
        const hay = [String(n), it?.customer_name, it?.redeemed_by, it?.payment_mode, it?.remarks, it?.note, it?.date_given, it?.date_availed]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      out.push(n);
    }
    return out;
  }, [items, beginning, q, onlyGiven]);

  const pages = Math.max(1, Math.ceil(series.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = series.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const pad = Math.max(3, String(beginning).length);

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

        <header className="vm-hero">
          <div className="vm-hero-icon"><TicketIcon /></div>
          <div className="vm-hero-text">
            <h1>Voucher Monitoring</h1>
            <p>Track every voucher from stock to customer to redeemed.</p>
          </div>
          <div className="vm-hero-stats">
            <div><b>{rows.length}</b><span>Vouchers</span></div>
            <div><b>{totalOut}</b><span>Given out</span></div>
            <div><b>{totalLeft}</b><span>Left in stock</span></div>
          </div>
        </header>

        <div className="vm-tabs">
          {rows.map((v) => {
            const pct = v.beginning ? Math.min(100, (v.given_out / v.beginning) * 100) : 0;
            return (
              <button key={v.id} className={'vm-tab' + (v.id === activeId ? ' on' : '')}
                onClick={() => v.id !== activeId && openVoucher(v.id)}>
                <span className="vm-tab-name"><TicketIcon small />{v.name}</span>
                <span className="vm-tab-meta"><b>{v.given_out}</b> out · <b>{v.beginning - v.given_out}</b> left</span>
                <span className="vm-bar"><i style={{ width: pct + '%' }} /></span>
              </button>
            );
          })}
          <button className="vm-tab vm-new" onClick={() => { setFormName(''); setFormQty(''); setModal('new'); }}>
            <span className="vm-plus">+</span> New voucher
          </button>
        </div>

        {loading && <div className="vm-empty">Loading…</div>}
        {!loading && !active && <div className="vm-empty">No vouchers yet. Click “New voucher” to add your first one.</div>}

        {active && (
          <>
            <div className="vm-stats">
              <div className="vm-stat">
                <label>Beginning</label><b>{active.beginning}</b>
                <button className="vm-link" onClick={() => { setFormQty(String(active.beginning)); setModal('beginning'); }}>Change</button>
              </div>
              <div className="vm-stat"><label>Total out</label><b>{active.given_out}</b><small>vouchers given to customers</small></div>
              <div className="vm-stat"><label>Ending</label><b>{active.beginning - active.given_out}</b><small>still available</small></div>
              <div className="vm-stat"><label>Availed</label><b>{active.availed}</b><small>with a date availed</small></div>
            </div>

            <div className="vm-toolbar">
              <input className="vm-search" placeholder="Search this table…" value={q}
                onChange={(e) => { setQ(e.target.value); setPage(0); }} />
              <label className="vm-check">
                <input type="checkbox" checked={onlyGiven} onChange={(e) => { setOnlyGiven(e.target.checked); setPage(0); }} />
                Show given out only
              </label>
              <span className="vm-spacer" />
              <button className="vm-btn" onClick={exportExcel}>⇩ Export to Excel</button>
              <button className="vm-btn danger" onClick={removeVoucher}>🗑 Remove voucher</button>
              <span className={'vm-save ' + save}>{saveLabel}</span>
            </div>

            <div className="vm-table-wrap">
              <table className="vm-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Sold<br />out</th><th>Series<br />no.</th><th>Customer name</th>
                    <th>Redeemed by</th><th>Mode of payment</th><th>Remarks<br />(sponsorship or sold)</th>
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
                        <td><span className={'vm-pill' + (it.date_availed ? ' availed' : out ? ' out' : '')}>
                          {it.date_availed ? 'Availed' : out ? 'Sold out' : 'In stock'}</span></td>
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
      <span className="cal">📅</span>
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
.vm { --o:#ea6a0a; --o-dark:#c2410c; --o-deep:#9a3412; --o-soft:#fff1e3; --o-line:#fcd9b6; --o-bg:#fff8f1; }
.vm-hero { display:flex; align-items:center; gap:16px; flex-wrap:wrap; padding:22px 24px; border-radius:20px; color:#fff;
  background:linear-gradient(120deg,var(--o-deep),var(--o-dark) 45%,var(--o)); box-shadow:0 8px 22px rgba(194,65,12,.25); }
.vm-hero-icon { width:54px; height:54px; border-radius:16px; background:rgba(255,255,255,.18); display:grid; place-items:center; }
.vm-hero-text { flex:1; min-width:220px; }
.vm-hero-text h1 { margin:0; font-size:26px; font-weight:800; letter-spacing:-.01em; color:#fff; }
.vm-hero-text p { margin:2px 0 0; font-size:13.5px; opacity:.9; }
.vm-hero-stats { display:flex; gap:10px; flex-wrap:wrap; }
.vm-hero-stats div { min-width:96px; text-align:center; padding:10px 14px; border-radius:12px; background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.28); }
.vm-hero-stats b { display:block; font-size:22px; line-height:1.1; }
.vm-hero-stats span { font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; opacity:.85; }

.vm-tabs { display:flex; gap:12px; flex-wrap:wrap; margin:18px 0; }
.vm-tab { text-align:left; cursor:pointer; padding:12px 16px; min-width:200px; border-radius:14px; background:#fff; color:#2a1608;
  border:1px solid var(--o-line); display:flex; flex-direction:column; gap:6px; font:inherit; box-shadow:0 1px 3px rgba(154,52,18,.08); }
.vm-tab:hover { border-color:var(--o); }
.vm-tab-name { display:flex; align-items:center; gap:8px; font-weight:800; font-size:13px; text-transform:uppercase; color:var(--o-dark); }
.vm-tab-meta { font-size:12px; color:#6b4a30; }
.vm-bar { height:6px; border-radius:99px; background:#fde4cc; overflow:hidden; }
.vm-bar i { display:block; height:100%; background:var(--o); border-radius:99px; transition:width .25s; }
.vm-tab.on { background:linear-gradient(135deg,var(--o-dark),var(--o)); color:#fff; border-color:var(--o-dark); box-shadow:0 6px 16px rgba(194,65,12,.3); }
.vm-tab.on .vm-tab-name, .vm-tab.on .vm-tab-meta { color:#fff; }
.vm-tab.on .vm-bar { background:rgba(255,255,255,.3); } .vm-tab.on .vm-bar i { background:#fff; }
.vm-new { min-width:150px; flex-direction:row; align-items:center; justify-content:center; gap:10px; border:2px dashed var(--o); background:transparent; box-shadow:none; font-weight:800; color:var(--o-dark); }
.vm-plus { width:28px; height:28px; border-radius:50%; background:var(--o); color:#fff; display:grid; place-items:center; font-size:18px; line-height:1; }

.vm-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; margin-bottom:18px; }
.vm-stat { background:#fff; border-radius:14px; padding:16px; text-align:center; border:1px solid var(--o-line); border-top:3px solid var(--o); }
.vm-stat label { display:block; font-size:12.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#3a2312; }
.vm-stat b { display:block; font-size:34px; margin:6px 0 2px; color:#1f1208; }
.vm-stat small { font-size:11.5px; color:#7a6150; }
.vm-link { background:none; border:0; padding:0; font:inherit; font-size:12.5px; color:var(--o-dark); text-decoration:underline; cursor:pointer; }

.vm-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
.vm-search { flex:0 1 320px; min-width:200px; padding:11px 14px; border-radius:12px; border:1px solid var(--o-line); background:#fff; font:inherit; }
.vm-search:focus, .vm-table input:focus, .vm-table select:focus { outline:2px solid var(--o); outline-offset:-1px; }
.vm-check { display:flex; gap:6px; align-items:center; font-weight:700; font-size:13.5px; cursor:pointer; }
.vm-check input { accent-color:var(--o); }
.vm-spacer { flex:1; }
.vm-btn { cursor:pointer; padding:10px 16px; border-radius:10px; font:inherit; font-weight:700; font-size:13.5px; background:#fff; color:var(--o-dark); border:1px solid var(--o-line); }
.vm-btn:hover:not(:disabled) { border-color:var(--o); background:var(--o-bg); }
.vm-btn:disabled { opacity:.45; cursor:default; }
.vm-btn.danger { color:#b42318; border-color:#f3b8b2; }
.vm-btn.solid { background:var(--o); color:#fff; border-color:var(--o); }
.vm-save { font-size:12.5px; font-weight:700; color:#6b4a30; }
.vm-save.saved { color:#2f7d32; } .vm-save.error { color:#b42318; }

.vm-table-wrap { overflow-x:auto; border-radius:14px; border:1px solid var(--o-line); background:#fff; }
.vm-table { width:100%; min-width:1100px; border-collapse:collapse; font-size:13px; }
.vm-table thead th { background:var(--o-dark); color:#fff; padding:14px 10px; font-size:11.5px; letter-spacing:.05em; text-transform:uppercase; text-align:center; position:static; }
.vm-table td { padding:8px 8px; border-bottom:1px solid #fbe6d2; vertical-align:middle; }
.vm-table tbody tr:nth-child(even) { background:var(--o-bg); }
.vm-table input, .vm-table select { width:100%; padding:9px 10px; border:1px solid var(--o-line); border-radius:10px; background:#fff; font:inherit; font-size:13px; min-width:0; }
.vm-date { position:relative; display:flex; align-items:center; justify-content:space-between; gap:6px; padding:9px 10px; border:1px solid var(--o-line); border-radius:10px; background:#fff; font-size:13px; cursor:pointer; white-space:nowrap; }
.vm-date:hover { border-color:var(--o); }
.vm-date .ph { color:#9b8574; }
.vm-date .cal { font-size:12px; }
.vm-date input { position:absolute; inset:0; width:100%; height:100%; opacity:0; pointer-events:none; }
.vm-series { text-align:center; font-weight:800; color:#9b7b62; font-family:var(--mono); }
.vm-pill { display:inline-block; padding:6px 12px; border-radius:99px; font-size:10.5px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; background:#ffe9d2; color:var(--o-deep); }
.vm-pill.out { background:var(--o); color:#fff; } .vm-pill.availed { background:#1f2937; color:#fff; }
.vm-pager { display:flex; justify-content:center; align-items:center; gap:14px; margin:16px 0 4px; font-size:13px; color:#6b4a30; }
.vm-empty { text-align:center; padding:28px; color:#8a6b55; }
@media (max-width:700px) { .vm-hero { padding:16px; } .vm-hero-text h1 { font-size:21px; } .vm-tab { flex:1 1 100%; } }
`;

export default function Page() {
  return (
    <RequireAuth role="admin">
      <VouchersPage />
    </RequireAuth>
  );
}