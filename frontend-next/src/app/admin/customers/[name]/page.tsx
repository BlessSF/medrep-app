'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Layout from '../../../../components/Layout';
import RequireAuth from '../../../../components/RequireAuth';
import { Banner, EditableCell, StatCard } from '../../../../components/ui';
import api, { ApiError } from '../../../../api/client';
import { money, MONTH_NAMES } from '../../../../lib/format';
import { IconTrash } from '../../../../components/icons';

function CustomerProfilePage() {
  const params = useParams();
  const name = decodeURIComponent(String(params.name || ''));
  const [data, setData] = useState<any | null>(null);
  // '' now means "All years" instead of defaulting to the current year.
  const [year, setYear] = useState<number | ''>(new Date().getFullYear());
  const [month, setMonth] = useState<number | ''>('');
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const [quickAdd, setQuickAdd] = useState({ type: 'dinein', amount: '', payment_method: 'na', card: '', remarks: '' });
  const [bankChoice, setBankChoice] = useState<'maya' | 'metrobank' | 'others'>('maya');

  async function load() {
    const r = await api.get(`/employees/profile.php?name=${encodeURIComponent(name)}${year !== '' ? `&year=${year}` : ''}${month !== '' ? `&month=${month}` : ''}`);
    setData(r);
  }

  useEffect(() => { if (name) load(); }, [name, year, month]);

  // Running total: same per-row delta formula the backend uses for the
  // overall balance (compute_balance in api_helpers.php), just applied
  // cumulatively in chronological order instead of summed all at once.
  // Records come back newest-first, so we walk oldest-first to accumulate,
  // then map the totals back onto the original (newest-first) row order.
  // NOTE: this hook must run before any early return below (Rules of Hooks) —
  // it guards internally against `data` being null on the first render.
  const runningTotals = useMemo(() => {
    const rows = [...(data?.records || [])].reverse();
    let running = 0;
    const byId = new Map<number, number>();
    for (const r of rows) {
      const method = (r.payment_method || '').toString().trim().toLowerCase();
      const isCard = method === 'card';
      const payable = isCard ? 0 : (Number(r.dinein) || 0) + (Number(r.takeout) || 0) + (Number(r.giftcard) || 0);
      const cashoutPart = isCard ? 0 : (Number(r.cashout) || 0) + (Number(r.interest) || 0);
      const delta = (Number(r.deposit) || 0) + (Number(r.receiver_amount) || 0) - payable - cashoutPart - (Number(r.sender_amount) || 0);
      running += delta;
      byId.set(r.id, running);
    }
    return byId;
  }, [data?.records]);

  async function addQuick(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post('/employees/transaction/add.php', {
        name, company: data?.employee?.company, ...quickAdd, amount: parseFloat(quickAdd.amount || '0'),
      });
      setMsg({ text: r.message, kind: 'success' });
      setQuickAdd({ type: 'dinein', amount: '', payment_method: 'na', card: '', remarks: '' });
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Failed to add.', kind: 'error' });
    }
  }

  async function updateField(id: number, field: string, value: string) {
    await api.post('/employees/transaction/update.php', { id, field, value });
    load();
  }

  async function deleteRow(id: number) {
    if (!confirm('Delete this transaction row?')) return;
    await api.post('/employees/transaction/delete.php', { id });
    load();
  }

  // Download links for this medrep's transactions, honoring whatever
  // year/month filter is currently applied to the table above.
  function exportUrl(format: 'csv' | 'xlsx' | 'pdf') {
    const params = new URLSearchParams({ medrep: name, format });
    if (year !== '') params.set('year', String(year));
    if (month !== '') params.set('month', String(month));
    return api.rawUrl(`/export.php?${params.toString()}`);
  }

  if (!data) return <Layout><div className="empty-state">Loading…</div></Layout>;

  const t = data.totals;
  const yearlySummary: Array<{ year: number; net: number }> = data.yearly_summary || [];

  // Options for the year filter: "All years" plus a range covering every
  // year that actually has history for this customer (falls back to a
  // handful of recent years if there's no history yet).
  const currentYear = new Date().getFullYear();
  const historyYears = yearlySummary.map((y) => y.year);
  const minYear = historyYears.length ? Math.min(...historyYears, currentYear) : currentYear - 5;
  const yearOptions: number[] = [];
  for (let y = currentYear; y >= minYear; y--) yearOptions.push(y);

  return (
    <Layout
      sidebarStatus={
        <span className={`sidebar-status-dot ${data.blocked ? 'blocked' : 'active'}`} title={data.blocked ? 'Blocked' : 'Active'} />
      }
    >
      <div className="topline">
        <h1>{data.employee.name}</h1>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 16 }}>{data.employee.company}</p>
      <Banner message={msg?.text || ''} kind={msg?.kind || 'success'} />

      <div className="stat-row">
        <StatCard label="Balance" value={money(t.balance)} negative={t.balance < 0} />
        <StatCard label="Total deposit" value={money(t.total_deposit)} />
        <StatCard label="Total payable" value={money(t.total_payable)} />
        <StatCard label="Total cashed out" value={money(t.total_cashout)} />
        <StatCard label="Gift card balance" value={money(t.giftcard_balance)} />
      </div>

      {yearlySummary.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Yearly summary</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {yearlySummary.map((y) => (
              <span key={y.year} className={`balance-pill ${y.net < 0 ? 'receivable' : 'payable'}`}>
                {y.year}: {y.net < 0 ? 'Payable' : 'Balance'} {money(Math.abs(y.net))}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Quick add transaction</h2>
        <form onSubmit={addQuick}>
          <div className="form-row">
            <div className="field">
              <label>Type</label>
              <select value={quickAdd.type} onChange={(e) => setQuickAdd((f) => ({ ...f, type: e.target.value }))}>
                <option value="dinein">Dine In</option>
                <option value="takeout">Takeout</option>
                <option value="deposit">Deposit</option>
                <option value="cashout">Cash Out</option>
                <option value="interest">Interest</option>
                <option value="giftcard">Gift Card</option>
              </select>
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" min="0" step="0.01" value={quickAdd.amount} onChange={(e) => setQuickAdd((f) => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div className="field">
              <label>Payment method</label>
              <select
                value={quickAdd.payment_method}
                onChange={(e) => {
                  const pm = e.target.value;
                  setQuickAdd((f) => ({
                    ...f,
                    payment_method: pm,
                    card: pm === 'card' ? (bankChoice === 'others' ? '' : (bankChoice === 'maya' ? 'Maya' : 'Metro Bank')) : '',
                  }));
                }}
              >
                <option value="na">N/A</option>
                <option value="cash">Cash</option>
                <option value="card">Card/Swipe</option>
                <option value="paid">Paid</option>
                <option value="giftcard">Gift Card</option>
              </select>
            </div>
            {quickAdd.payment_method === 'card' && (
              <div className="field">
                <label>Bank</label>
                <select
                  value={bankChoice}
                  onChange={(e) => {
                    const choice = e.target.value as 'maya' | 'metrobank' | 'others';
                    setBankChoice(choice);
                    setQuickAdd((f) => ({
                      ...f,
                      card: choice === 'maya' ? 'Maya' : choice === 'metrobank' ? 'Metro Bank' : '',
                    }));
                  }}
                >
                  <option value="maya">Maya</option>
                  <option value="metrobank">Metro Bank</option>
                  <option value="others">Others</option>
                </select>
              </div>
            )}
            {quickAdd.payment_method === 'card' && bankChoice === 'others' && (
              <div className="field">
                <label>Specify card/bank name</label>
                <input
                  value={quickAdd.card}
                  onChange={(e) => setQuickAdd((f) => ({ ...f, card: e.target.value }))}
                  placeholder="Specify card/bank name"
                  required
                />
              </div>
            )}
            <div className="field">
              <label>Remarks</label>
              <input value={quickAdd.remarks} onChange={(e) => setQuickAdd((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
          </div>
          <button className="btn" type="submit">Add</button>
        </form>
      </div>

      <div className="card">
        <div className="topline" style={{ marginBottom: 12 }}>
          <h2>Transaction history</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={month} onChange={(e) => setMonth(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">All months</option>
              {MONTH_NAMES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">All years</option>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <a className="btn secondary small" href={exportUrl('csv')} target="_blank" rel="noopener noreferrer">⇩ CSV</a>
            <a className="btn secondary small" href={exportUrl('xlsx')} target="_blank" rel="noopener noreferrer">⇩ Excel</a>
            <a className="btn secondary small" href={exportUrl('pdf')} target="_blank" rel="noopener noreferrer">⇩ PDF</a>
          </div>
        </div>
        <div className="table-scroll">
        <table className="col-divided">
          <thead>
            <tr>
              <th className="nowrap-cell">Date</th><th>Cashier</th>
              <th className="num">Dine In</th><th className="num">Takeout</th><th className="num">Deposit</th>
              <th className="num">Cashout</th><th className="num">Interest</th><th className="num">Gift Card</th>
              <th>Transfer Name</th><th className="num">Transfer Amount</th>
              <th>Payment Method</th><th>Bank</th>
              <th className="num">Running Total</th><th>Type</th><th>Status</th><th>Remarks</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.records.length === 0 && <tr><td colSpan={17} className="empty-state">No transactions in this period.</td></tr>}
            {data.records.map((r: any) => {
              const running = runningTotals.get(r.id) ?? 0;
              const transferName = r.sender_amount > 0 ? r.receiver_name : (r.receiver_amount > 0 ? r.sender_name : '');
              const transferAmount = r.sender_amount > 0 ? r.sender_amount : (r.receiver_amount > 0 ? r.receiver_amount : 0);
              return (
              <tr key={r.id}>
                <td className="nowrap-cell"><EditableCell value={r.created_at} onSave={(v) => updateField(r.id, 'created_at', v)} /></td>
                <td className="muted">{r.cashier || '—'}</td>
                <td className="num"><EditableCell value={r.dinein > 0 ? r.dinein : ''} onSave={(v) => updateField(r.id, 'dinein', v)} /></td>
                <td className="num"><EditableCell value={r.takeout > 0 ? r.takeout : ''} onSave={(v) => updateField(r.id, 'takeout', v)} /></td>
                <td className="num"><EditableCell value={r.deposit > 0 ? r.deposit : ''} onSave={(v) => updateField(r.id, 'deposit', v)} /></td>
                <td className="num"><EditableCell value={r.cashout > 0 ? r.cashout : ''} onSave={(v) => updateField(r.id, 'cashout', v)} /></td>
                <td className="num"><EditableCell value={r.interest > 0 ? r.interest : ''} onSave={(v) => updateField(r.id, 'interest', v)} /></td>
                <td className="num"><EditableCell value={r.giftcard > 0 ? r.giftcard : ''} onSave={(v) => updateField(r.id, 'giftcard', v)} /></td>
                <td className="muted">{transferName || '—'}</td>
                <td className="num">{transferAmount > 0 ? money(transferAmount) : '—'}</td>
                <td className="muted">{r.payment_method || '—'}</td>
                <td className="muted">{r.card || '—'}</td>
                <td className="num">
                  <span className={`balance-pill ${running < 0 ? 'receivable' : 'payable'}`}>{money(Math.abs(running))}</span>
                </td>
                <td><span className={`badge ${running < 0 ? 'blocked' : 'active'}`}>{running < 0 ? 'Payable' : 'Receivable'}</span></td>
                <td>
                  {r.block && r.block.toLowerCase() === 'block'
                    ? <span className="badge blocked">Blocked</span>
                    : <span className="badge active">Active</span>}
                </td>
                <td className="muted"><EditableCell value={r.remarks || ''} onSave={(v) => updateField(r.id, 'remarks', v)} /></td>
                <td className="actions-cell">
                  <button className="icon-btn danger" title="Delete" onClick={() => deleteRow(r.id)}><IconTrash /></button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </Layout>
  );
}

export default function Page() {
  return (
    <RequireAuth role="admin">
      <CustomerProfilePage />
    </RequireAuth>
  );
}