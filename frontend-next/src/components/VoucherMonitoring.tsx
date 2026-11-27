'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Layout from './Layout';
import { Banner, Modal } from './ui';
import { BulkFillModal, MAX_BULK, describeSeries, parseSeries, type BulkChanges } from './VoucherBulkFill';
import { useAuth } from '../context/AuthContext';
import api, { ApiError } from '../api/client';
import { exportVouchersWorkbook } from '../lib/exportVouchers';

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
  const { role, branch } = useAuth();
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
  const [exporting, setExporting] = useState(false);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const [modal, setModal] = useState<'new' | 'beginning' | 'remove' | null>(null);
  const [formName, setFormName] = useState('');
  const [formQty, setFormQty] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const lastPicked = useRef<number | null>(null); // anchor for Shift+click
  const [rangeText, setRangeText] = useState('');
  const [rangeError, setRangeError] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

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

  function storeItems(list: Item[]) {
    const map: Record<number, Item> = {};
    list.forEach((i) => { map[i.series_no] = i; });
    itemsRef.current = map;
    setItems(map);
  }

  async function openVoucher(id: number, refreshList = false) {
    const r = await api.get(`/vouchers/index.php?id=${id}`);
    storeItems(r.items);
    clearSelection();
    setRangeText(''); setBulkOpen(false);
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

  // ---------- Selecting several series and filling them at once ----------
  function clearSelection() {
    setSelected(new Set());
    setRangeError('');
    lastPicked.current = null;
  }

  function toggleRow(n: number, shift: boolean) {
    const from = lastPicked.current;
    const next = new Set(selected);
    const on = !selected.has(n);
    // Shift+click covers everything between the last click and this one, in the order shown.
    const a = shift && from !== null ? series.indexOf(from) : -1;
    const b = series.indexOf(n);
    const span = a >= 0 && b >= 0 ? series.slice(Math.min(a, b), Math.max(a, b) + 1) : [n];
    span.forEach((x) => (on ? next.add(x) : next.delete(x)));
    lastPicked.current = n;
    setSelected(next);
  }

  function setMany(list: number[], on: boolean) {
    const next = new Set(selected);
    list.forEach((x) => (on ? next.add(x) : next.delete(x)));
    setSelected(next);
  }

  function selectRange(e: FormEvent) {
    e.preventDefault();
    const result = parseSeries(rangeText, beginning);
    if ('error' in result) { setRangeError(result.error); return; }
    setMany(result.list, true);
    setRangeText(''); setRangeError('');
  }

  async function applyBulk(changes: BulkChanges, onlyEmpty: boolean) {
    if (!activeId) return;
    setBulkSaving(true);
    setSave('saving');
    let updated: number;
    try {
      const r = await api.post('/vouchers/index.php', {
        action: 'save_bulk', voucher_id: activeId, series: selectedList, changes, only_empty: onlyEmpty,
      });
      updated = r.updated;
    } catch (e) {
      setSave('error');
      setBulkSaving(false);
      flash(errText(e, 'Could not save those rows.'), 'error');
      return;
    }
    setSave('saved');
    setBulkSaving(false);
    setBulkOpen(false);
    clearSelection();
    flash(`Updated ${updated.toLocaleString()} ${updated === 1 ? 'row' : 'rows'}.`);
    try {
      // Reload the rows but stay on the same page, search and filter.
      const fresh = await api.get(`/vouchers/index.php?id=${activeId}`);
      storeItems(fresh.items);
    } catch (e) {
      flash(errText(e, 'Saved, but could not refresh the table. Reload the page.'), 'error');
    }
  }

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

  const selectedList = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);
  const pageSelected = visible.filter((n) => selected.has(n)).length;
  const allOnPage = visible.length > 0 && pageSelected === visible.length;
  const isNarrowed = q.trim() !== '' || filter !== 'all';
  const tooMany = selected.size > MAX_BULK;

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

  // One workbook: a Summary tab plus a tab for every voucher, in the branch colour.
  async function exportExcel() {
    if (exporting || vouchers.length === 0) return;
    setExporting(true);
    try {
      const all = [];
      for (const v of vouchers) {
        const r = await api.get(`/vouchers/index.php?id=${v.id}`);
        all.push({ name: v.name, beginning: r.voucher.beginning as number, items: r.items as Item[] });
      }
      await exportVouchersWorkbook(branch, all);
    } catch (e) {
      flash(errText(e, 'Could not export the vouchers.'), 'error');
    } finally {
      setExporting(false);
    }
  }

  const saveLabel = save === 'saving' ? 'Saving…' : save === 'error' ? 'Save failed' : save === 'saved' ? 'All changes saved' : 'All changes save automatically';

  const pctOut = active && active.beginning ? Math.min(100, Math.round((active.given_out / active.beginning) * 100)) : 0;
  const pctAvailed = active && active.given_out ? Math.min(100, Math.round((active.availed / active.given_out) * 100)) : 0;
  const segAvailed = active && active.beginning ? Math.min(100, (active.availed / active.beginning) * 100) : 0;
  const segPending = active && active.beginning ? Math.min(100 - segAvailed, (Math.max(0, active.given_out - active.availed) / active.beginning) * 100) : 0;

  return (
    <Layout>
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
                <button className="vm-btn" onClick={exportExcel} disabled={exporting}><DownloadIcon /> {exporting ? 'Preparing…' : 'Export all to Excel'}</button>
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
              <form className="vm-range" onSubmit={selectRange}>
                <input aria-label="Series numbers to select" placeholder="Select series, e.g. 1-50, 75" value={rangeText}
                  onChange={(e) => { setRangeText(e.target.value); setRangeError(''); }} />
                <button type="submit" className="vm-btn" disabled={!rangeText.trim()}>Select</button>
              </form>
              <span className="vm-count">{series.length.toLocaleString()} {series.length === 1 ? 'row' : 'rows'}</span>
            </div>
            {rangeError && <p className="vm-range-error" role="alert">{rangeError}</p>}

            {/* ---------- Selection bar ---------- */}
            {selected.size > 0 ? (
              <div className="vm-selbar">
                <div className="vm-selbar-info">
                  <b>{selected.size.toLocaleString()} selected</b>
                  <span>{describeSeries(selectedList, pad)}</span>
                  {tooMany && <span className="vm-selbar-warn">Limit is {MAX_BULK.toLocaleString()} at a time.</span>}
                </div>
                <div className="vm-selbar-actions">
                  {isNarrowed && series.some((n) => !selected.has(n)) && (
                    <button className="vm-link" onClick={() => setMany(series, true)}>Select all {series.length.toLocaleString()} matching</button>
                  )}
                  <button className="vm-btn" onClick={clearSelection}>Clear</button>
                  <button className="vm-btn solid" disabled={tooMany} onClick={() => setBulkOpen(true)}>Fill selected</button>
                </div>
              </div>
            ) : (
              <p className="vm-hint">Tip: tick rows to fill many at once. Hold <kbd>Shift</kbd> and click to select everything in between.</p>
            )}

            {/* ---------- Table ---------- */}
            <div className="vm-table-wrap">
              <table className="vm-table">
                <thead>
                  <tr>
                    <th>
                      <span className="vm-pick">
                        <input type="checkbox" className="vm-check" aria-label="Select all rows on this page"
                          checked={allOnPage} disabled={visible.length === 0}
                          ref={(el) => { if (el) el.indeterminate = pageSelected > 0 && !allOnPage; }}
                          onChange={() => setMany(visible, !allOnPage)} />
                        Series
                      </span>
                    </th><th>Status</th><th>Date given</th><th>Customer name</th>
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
                      <tr key={n} className={state + (selected.has(n) ? ' picked' : '')}>
                        <td>
                          <span className="vm-pick">
                            <input type="checkbox" className="vm-check" aria-label={'Select series ' + String(n).padStart(pad, '0')}
                              checked={selected.has(n)}
                              onChange={(e) => toggleRow(n, (e.nativeEvent as MouseEvent).shiftKey === true)} />
                            <span className="vm-series">{String(n).padStart(pad, '0')}</span>
                          </span>
                        </td>
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

      {/* Popups sit in their own .vm wrapper so buttons get the voucher theme colours. */}
      <div className="vm">
      {bulkOpen && selected.size > 0 && (
        <BulkFillModal
          rows={selectedList.map((n) => items[n] || blank(n))}
          label={describeSeries(selectedList, pad)}
          paymentModes={PAYMENT_MODES}
          remarks={REMARKS}
          saving={bulkSaving}
          onApply={applyBulk}
          onClose={() => setBulkOpen(false)}
        />
      )}

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
      </div>
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
