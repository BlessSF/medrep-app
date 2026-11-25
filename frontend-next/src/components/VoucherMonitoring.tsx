'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Layout from './Layout';
import { Banner, Modal } from './ui';
import { useAuth } from '../context/AuthContext';
import api, { ApiError } from '../api/client';

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

export default function VoucherMonitoring() {
  const { role } = useAuth();
  // The server decides who may add, resize and delete vouchers (admins, plus
  // cashiers of some branches), so follow what it says.
  const [canManage, setCanManage] = useState(role === 'admin');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [beginning, setBeginning] = useState(0);
  const [items, setItems] = useState<Record<number, Item>>({});
  const itemsRef = useRef<Record<number, Item>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'given' | 'availed'>('all');
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
    if (typeof r.can_manage === 'boolean') setCanManage(r.can_manage);
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
    setPage(0); setQ(''); setFilter('all');
    if (refreshList) { const l = await api.get('/vouchers/index.php'); setVouchers(l.vouchers); }
  }

  function reload() {
    setLoading(true);
    setLoadError('');
    loadList().catch((e) => { setLoading(false); setLoadError(errText(e, 'Could not load vouchers.')); });
  }

  useEffect(() => {
    reload();
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
  const totalAvailed = rows.reduce((s, v) => s + v.availed, 0);

  const pad = Math.max(3, String(beginning).length);
  const series = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out: number[] = [];
    for (let n = 1; n <= beginning; n++) {
      const it = items[n];
      if (filter === 'given' && !isGivenOut(it)) continue;
      if (filter === 'availed' && !it?.date_availed) continue;
      if (needle) {
        const hay = [String(n), String(n).padStart(pad, '0'), it?.customer_name, it?.redeemed_by, it?.payment_mode, it?.remarks, it?.note, it?.date_given, it?.date_availed]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      out.push(n);
    }
    return out;
  }, [items, beginning, q, filter, pad]);

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
  const segAvailed = active && active.beginning ? Math.min(100, (active.availed / active.beginning) * 100) : 0;
  const segPending = active && active.beginning ? Math.min(100 - segAvailed, (Math.max(0, active.given_out - active.availed) / active.beginning) * 100) : 0;

  return (
    <Layout>
      <style>{VM_CSS}</style>
      <div className="vm">
        <Banner message={msg?.text || ''} kind={msg?.kind || 'success'} />

        {/* ---------- Page header ---------- */}
        <header className="vm-head">
          <div>
            <h1>Voucher Monitoring</h1>
            <p>Track every voucher from stock, to customer, to redeemed.</p>
          </div>
          <dl className="vm-totals">
            <div><span className="vm-ti neutral"><TicketIcon small /></span><section><dd>{rows.length}</dd><dt>Vouchers</dt></section></div>
            <div><span className="vm-ti out"><StatusIcon state="out" size={18} /></span><section><dd className="c-out">{totalOut.toLocaleString()}</dd><dt>Given out</dt></section></div>
            <div><span className="vm-ti stock"><StatusIcon state="stock" size={18} /></span><section><dd>{totalLeft.toLocaleString()}</dd><dt>In stock</dt></section></div>
            <div><span className="vm-ti done"><StatusIcon state="availed" size={18} /></span><section><dd className="c-done">{totalAvailed.toLocaleString()}</dd><dt>Availed</dt></section></div>
          </dl>
        </header>

        {/* ---------- Voucher picker: one scrolling row ---------- */}
        <div className="vm-strip-wrap">
          <div className="vm-strip" role="tablist" aria-label="Vouchers">
            {rows.map((v) => {
              const out = v.beginning ? Math.min(100, (v.given_out / v.beginning) * 100) : 0;
              const av = v.beginning ? Math.min(out, (v.availed / v.beginning) * 100) : 0;
              const low = v.beginning > 0 && v.beginning - v.given_out <= v.beginning * 0.1;
              return (
                <button key={v.id} role="tab" aria-selected={v.id === activeId}
                  className={'vm-tab' + (v.id === activeId ? ' on' : '')}
                  onClick={() => v.id !== activeId && openVoucher(v.id)}>
                  <span className="vm-tab-name"><span className="vm-tab-ico"><TicketIcon small /></span><span className="vm-tab-t">{v.name}</span>{low && <em>Low</em>}</span>
                  <span className="vm-tab-nums"><StatusIcon state="out" size={13} /><b>{v.given_out.toLocaleString()}</b> / {v.beginning.toLocaleString()}
                    {v.availed > 0 && <span className="vm-tab-av"><StatusIcon state="availed" size={13} />{v.availed.toLocaleString()} availed</span>}
                  </span>
                  <span className="vm-bar"><i className="pending" style={{ width: out + '%' }} /><i className="done" style={{ width: av + '%' }} /></span>
                </button>
              );
            })}
          {canManage && (
            <button className="vm-add" onClick={() => { setFormName(''); setFormQty(''); setModal('new'); }}>
              <PlusIcon /> <span>New voucher</span>
            </button>
          )}
          </div>
        </div>

        {loading && <div className="vm-empty">Loading vouchers…</div>}
        {!loading && loadError && (
          <div className="vm-blank err">
            <h3>Couldn’t load vouchers</h3>
            <p>{loadError}</p>
            <button className="vm-btn solid" onClick={reload}>Try again</button>
          </div>
        )}
        {!loading && !loadError && !active && (
          <div className="vm-blank">
            <TicketIcon />
            <h3>No vouchers yet</h3>
            <p>{canManage ? 'Add your first voucher to start tracking stock and redemptions.' : 'An admin needs to add vouchers before they can be tracked here.'}</p>
            {canManage && <button className="vm-btn solid" onClick={() => { setFormName(''); setFormQty(''); setModal('new'); }}>+ New voucher</button>}
          </div>
        )}

        {active && (
          <section className="vm-panel">
            {/* ---------- Panel header ---------- */}
            <div className="vm-panel-head">
              <div>
                <h2>{active.name}</h2>
                <span className={'vm-save ' + save}><SaveIcon state={save} />{saveLabel}</span>
              </div>
              <div className="vm-actions">
                <button className="vm-btn" onClick={exportExcel}><DownloadIcon /> Export to Excel</button>
                {canManage && <button className="vm-btn danger" onClick={() => setModal('remove')}><TrashIcon /> Remove</button>}
              </div>
            </div>

            {/* ---------- Summary: one strip + one stacked bar ---------- */}
            <div className="vm-summary">
              <div className="vm-sum-grid">
                <div>
                  <label>Beginning</label>
                  <b>{active.beginning.toLocaleString()}</b>
                  {canManage && <button className="vm-link" onClick={() => { setFormQty(String(active.beginning)); setModal('beginning'); }}>Change quantity</button>}
                </div>
                <div>
                  <label>Given out</label>
                  <b className="c-out">{active.given_out.toLocaleString()}</b>
                  <small>{pctOut}% of stock</small>
                </div>
                <div>
                  <label>Availed</label>
                  <b className="c-done">{active.availed.toLocaleString()}</b>
                  <small>{pctAvailed}% of given out</small>
                </div>
                <div>
                  <label>Ending</label>
                  <b>{(active.beginning - active.given_out).toLocaleString()}</b>
                  <small>still in stock</small>
                </div>
              </div>
              <div className="vm-stack" role="img" aria-label={`${active.availed} availed, ${Math.max(0, active.given_out - active.availed)} given out and not yet availed, ${active.beginning - active.given_out} in stock`}>
                <i className="done" style={{ width: segAvailed + '%' }} />
                <i className="pending" style={{ width: segPending + '%' }} />
              </div>
              <div className="vm-legend">
                <span><i className="done" />Availed</span>
                <span><i className="pending" />Given out, not yet availed</span>
                <span><i className="stock" />In stock</span>
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
                <button className={filter === 'all' ? 'on' : ''} onClick={() => { setFilter('all'); setPage(0); }}>All</button>
                <button className={filter === 'given' ? 'on' : ''} onClick={() => { setFilter('given'); setPage(0); }}><StatusIcon state="out" size={14} />Given out <em>{liveOut}</em></button>
                <button className={filter === 'availed' ? 'on' : ''} onClick={() => { setFilter('availed'); setPage(0); }}><StatusIcon state="availed" size={14} />Availed <em>{liveAvailed}</em></button>
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
                    const state: RowState = it.date_availed ? 'availed' : out ? 'out' : 'stock';
                    return (
                      <tr key={n} className={state}>
                        <td><span className="vm-series">{String(n).padStart(pad, '0')}</span></td>
                        <td><span className={'vm-status ' + state}><StatusIcon state={state} />{state === 'availed' ? 'Availed' : state === 'out' ? 'Given out' : 'In stock'}</span></td>
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
type RowState = 'stock' | 'out' | 'availed';

// One icon per state, so the status reads without relying on colour alone.
function StatusIcon({ state, size = 15 }: { state: RowState | ''; size?: number }) {
  if (state === 'availed') {
    return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></svg>;
  }
  if (state === 'out') {
    return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M7 17 17 7M9 7h8v8" /></svg>;
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg>;
}
function SaveIcon({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'saving') return <svg className="spin" width="14" height="14" viewBox="0 0 24 24" {...stroke}><path d="M21 12a9 9 0 1 1-6.2-8.6" /></svg>;
  if (state === 'error') return <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>;
  return <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" />{state === 'saved' && <path d="m8 12.5 3 3 5-6" />}</svg>;
}
const CheckIcon = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const PlusIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><path d="M12 5v14M5 12h14" /></svg>;
const SearchIcon = () => <svg className="vm-search-ico" width="16" height="16" viewBox="0 0 24 24" {...stroke}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
const DownloadIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>;
const TrashIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;

const VM_CSS = `
.vm { --a:var(--brand-primary,#d9580d); --a-soft:color-mix(in srgb,var(--a) 9%,#fff); --a-line:color-mix(in srgb,var(--a) 30%,#fff);
  --ink:#241c15; --mute:#7a6c5f; --line:#e8e0d5; --bg:#faf7f2; --card:#fff;
  --green:#2e7d4f; --green-soft:#e7f4ec; --warn:#a96a0c; --warn-soft:#fcf0d6; --red:#b42318;
  color:var(--ink); max-width:1500px; }
.vm *, .vm *::before, .vm *::after { box-sizing:border-box; }
.vm h1, .vm h2, .vm h3 { margin:0; }
.vm .spin { animation:vmspin .8s linear infinite; }
@keyframes vmspin { to { transform:rotate(360deg); } }

/* header */
.vm-head { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap; margin-bottom:20px; }
.vm-head h1 { font-size:26px; font-weight:750; letter-spacing:-.02em; }
.vm-head p { margin:4px 0 0; font-size:14px; color:var(--mute); }
.vm-totals { display:flex; margin:0; background:var(--card); border:1px solid var(--line); border-radius:12px; }
.vm-totals > div { display:flex; align-items:center; gap:12px; padding:10px 22px 10px 16px; border-left:1px solid var(--line); min-width:150px; }
.vm-totals section { display:block; }
.vm-ti { flex:none; width:36px; height:36px; border-radius:10px; display:grid; place-items:center; background:#f1ebe2; color:var(--mute); }
.vm-ti.neutral { background:var(--a-soft); color:var(--a); }
.vm-ti.out { background:var(--warn-soft); color:var(--warn); }
.vm-ti.done { background:var(--green-soft); color:var(--green); }
.vm-totals > div:first-child { border-left:0; }
.vm-totals dd { margin:0; font-size:21px; font-weight:750; line-height:1.15; font-variant-numeric:tabular-nums; letter-spacing:-.01em; }
.vm-totals dt { margin-top:2px; font-size:11px; letter-spacing:.07em; text-transform:uppercase; color:var(--mute); }
.vm .c-out { color:var(--warn); } .vm .c-done { color:var(--green); }

/* picker: a single row that scrolls sideways */
.vm-strip-wrap { display:block; margin-bottom:18px; }
.vm-strip { flex:1; min-width:0; display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:10px; }
.vm-tab { min-width:0; cursor:pointer; text-align:left; font:inherit; color:var(--ink); display:flex; flex-direction:column; gap:5px; padding:11px 13px 11px;
  background:var(--card); border:1px solid var(--line); border-radius:10px; transition:border-color .15s, box-shadow .15s; }
.vm-tab:hover { border-color:var(--a-line); }
.vm-tab.on { border-color:var(--a); box-shadow:0 0 0 3px var(--a-soft); }
.vm-tab-name { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vm-tab-ico { flex:none; width:24px; height:24px; border-radius:7px; display:grid; place-items:center; background:var(--a-soft); color:var(--a); }
.vm-tab-ico svg { width:14px; height:14px; }
.vm-tab-t { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; }
.vm-tab.on .vm-tab-ico { background:var(--a); color:#fff; }
.vm-tab-nums svg { color:var(--warn); }
.vm-tab-name em { flex:none; font-style:normal; font-size:9.5px; letter-spacing:.06em; padding:1px 6px; border-radius:99px; background:var(--warn-soft); color:var(--warn); }
.vm-tab-nums { display:flex; align-items:center; gap:4px; font-size:12px; color:var(--mute); font-variant-numeric:tabular-nums; }
.vm-tab-nums b { font-size:17px; color:var(--ink); font-weight:750; }
.vm-tab-av { margin-left:auto; display:inline-flex; align-items:center; gap:4px; padding:2px 8px 2px 6px; border-radius:99px; background:var(--green-soft); color:var(--green); font-size:11.5px; font-weight:650; white-space:nowrap; }
.vm-tab-nums .vm-tab-av svg { color:var(--green); }
.vm-bar { position:relative; display:block; height:4px; border-radius:99px; background:#efe8de; overflow:hidden; }
.vm-bar i { position:absolute; left:0; top:0; bottom:0; border-radius:99px; transition:width .3s; }
.vm-bar i.pending { background:#e0a540; } .vm-bar i.done { background:var(--green); }
.vm-add { min-height:78px; display:flex; align-items:center; justify-content:center; gap:7px; padding:0 16px; border:1.5px dashed var(--a-line); border-radius:10px; background:transparent; color:var(--a); font:inherit; font-size:13.5px; font-weight:650; cursor:pointer; white-space:nowrap; }
.vm-add:hover { background:var(--a-soft); border-color:var(--a); }

/* empty states */
.vm-empty { text-align:center; padding:30px; color:var(--mute); }
.vm-blank { display:flex; flex-direction:column; align-items:center; gap:6px; text-align:center; padding:56px 20px; background:var(--card); border:1px dashed var(--line); border-radius:14px; color:var(--a); }
.vm-blank.err { color:var(--red); }
.vm-blank h3 { color:var(--ink); font-size:17px; margin-top:6px; }
.vm-blank p { margin:0 0 12px; color:var(--mute); font-size:13.5px; }

/* panel */
.vm-panel { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px; }
.vm-panel-head { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap; margin-bottom:16px; }
.vm-panel-head h2 { font-size:21px; font-weight:780; letter-spacing:-.015em; text-transform:uppercase; }
.vm-actions { display:flex; gap:8px; flex-wrap:wrap; }
.vm-save { display:inline-flex; align-items:center; gap:6px; margin-top:5px; font-size:12px; color:var(--mute); }
.vm-save.saving { color:var(--warn); }
.vm-save.saved { color:var(--green); }
.vm-save.error { color:var(--red); font-weight:600; }

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

/* summary */
.vm-summary { margin-bottom:18px; padding:16px 18px 14px; background:var(--bg); border:1px solid var(--line); border-radius:12px; }
.vm-sum-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
.vm-sum-grid > div { padding:0 18px; border-left:1px solid var(--line); }
.vm-sum-grid > div:first-child { padding-left:0; border-left:0; }
.vm-sum-grid label { display:block; font-size:11px; font-weight:650; letter-spacing:.07em; text-transform:uppercase; color:var(--mute); }
.vm-sum-grid b { display:block; margin:3px 0 1px; font-size:30px; font-weight:780; line-height:1.15; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
.vm-sum-grid small { font-size:12px; color:var(--mute); }
.vm-link { background:none; border:0; padding:0; font:inherit; font-size:12.5px; font-weight:600; color:var(--a); cursor:pointer; }
.vm-link:hover { text-decoration:underline; }
.vm-stack { display:flex; height:8px; margin-top:16px; border-radius:99px; background:#e9e1d6; overflow:hidden; }
.vm-stack i { display:block; height:100%; transition:width .3s; }
.vm-stack i.done { background:var(--green); } .vm-stack i.pending { background:#e0a540; }
.vm-legend { display:flex; gap:18px; flex-wrap:wrap; margin-top:9px; font-size:12px; color:var(--mute); }
.vm-legend span { display:inline-flex; align-items:center; gap:6px; }
.vm-legend i { width:10px; height:10px; border-radius:3px; background:#e9e1d6; }
.vm-legend i.done { background:var(--green); } .vm-legend i.pending { background:#e0a540; }

/* toolbar */
.vm-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.vm-search-wrap { position:relative; flex:0 1 340px; min-width:220px; }
.vm-search-ico { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--mute); pointer-events:none; }
.vm-search { width:100%; padding:9px 32px 9px 34px; border-radius:10px; border:1px solid var(--line); background:var(--card); font:inherit; font-size:13.5px; }
.vm-clear { position:absolute; right:6px; top:50%; transform:translateY(-50%); width:22px; height:22px; border:0; border-radius:50%; background:#efe8de; color:var(--mute); font-size:10px; cursor:pointer; }
.vm-search:focus, .vm-table input:focus, .vm-table select:focus { outline:2px solid var(--a); outline-offset:-1px; background:#fff; }
.vm-seg { display:inline-flex; padding:3px; background:#f1ebe2; border-radius:10px; }
.vm-seg button { display:inline-flex; align-items:center; gap:6px; border:0; background:none; font:inherit; font-size:13px; font-weight:600; padding:6px 12px; border-radius:7px; cursor:pointer; color:var(--mute); }
.vm-seg button em { font-style:normal; font-size:11.5px; padding:1px 6px; border-radius:99px; background:rgba(36,28,21,.08); font-variant-numeric:tabular-nums; }
.vm-seg button.on { background:var(--card); color:var(--ink); box-shadow:0 1px 3px rgba(36,28,21,.12); }
.vm-seg button.on em { background:var(--a-soft); color:var(--a); }
.vm-count { margin-left:auto; font-size:12.5px; color:var(--mute); font-variant-numeric:tabular-nums; }

/* table */
.vm-table-wrap { overflow:auto; max-height:calc(100vh - 190px); min-height:240px; border:1px solid var(--line); border-radius:12px; background:var(--card); }
.vm-table { width:100%; min-width:1120px; border-collapse:separate; border-spacing:0; font-size:13px; }
.vm-table thead th { position:sticky; top:0; z-index:2; background:var(--bg); padding:11px 10px; font-size:11px; font-weight:700; letter-spacing:.07em; text-transform:uppercase;
  color:var(--mute); text-align:left; border-bottom:1px solid var(--line); white-space:nowrap; }
.vm-table td { padding:4px 6px; border-bottom:1px solid #f3ede4; vertical-align:middle; background:var(--card); }
.vm-table tbody tr:last-child td { border-bottom:0; }
/* series + status stay put while the rest scrolls sideways */
.vm-table th:nth-child(1), .vm-table td:nth-child(1) { position:sticky; left:0; z-index:1; width:92px; min-width:92px; }
.vm-table th:nth-child(2), .vm-table td:nth-child(2) { position:sticky; left:92px; z-index:1; width:132px; min-width:132px; box-shadow:1px 0 0 var(--line); }
.vm-table thead th:nth-child(1), .vm-table thead th:nth-child(2) { z-index:3; }
.vm-table tbody tr:hover td { background:#fdfaf6; }
.vm-table tbody tr.availed td { background:#f7fbf8; }
.vm-table tbody tr.availed:hover td { background:#f0f8f3; }
.vm-table tbody tr.out td:first-child { box-shadow:inset 3px 0 0 #e0a540; }
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
.vm-series { display:inline-block; font-family:var(--mono,ui-monospace,monospace); font-size:12px; font-weight:600; padding:3px 9px; margin-left:4px; border-radius:6px; background:#f1ebe2; color:#5a4d41; }
.vm-status { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:650; padding:3px 10px 3px 8px; border-radius:99px; background:#f1ebe2; color:var(--mute); white-space:nowrap; }
.vm-status svg { flex:none; }
.vm-status.out { background:var(--warn-soft); color:var(--warn); }
.vm-status.availed { background:var(--green-soft); color:var(--green); }

/* pager */
.vm-pager { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-top:14px; font-size:13px; color:var(--mute); }
.vm-pager > div { display:flex; align-items:center; gap:10px; }
.vm-page { font-variant-numeric:tabular-nums; }

@media (max-width:900px) {
  .vm-totals { width:100%; }
  .vm-totals { flex-wrap:wrap; }
  .vm-totals > div { flex:1 1 45%; padding:10px 14px; min-width:0; }
  .vm-totals > div:nth-child(3) { border-left:0; }
  .vm-sum-grid { grid-template-columns:repeat(2,minmax(0,1fr)); row-gap:16px; }
  .vm-sum-grid > div:nth-child(3) { padding-left:0; border-left:0; }
}
@media (max-width:700px) {
  .vm-panel { padding:14px; border-radius:12px; }
  .vm-count { margin-left:0; }
    .vm-add { padding:0 12px; }
  .vm-totals dd { font-size:18px; }
}
`;