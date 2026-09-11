'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Layout from '../../components/Layout';
import RequireAuth from '../../components/RequireAuth';
import { Banner } from '../../components/ui';
import api, { ApiError } from '../../api/client';
import { dateStr } from '../../lib/format';

interface Medrep { name: string; company: string; blocked: boolean }

const TX_TYPES = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'dinein', label: 'Dine In' },
  { value: 'takeout', label: 'Takeout' },
  { value: 'giftcard', label: 'Buy Gift Card' },
  { value: 'cashout', label: 'Cash Out' },
  { value: 'interest', label: 'Interest' },
  { value: 'transfer', label: 'Transfer' },
];

function StaffPage() {
  const [medreps, setMedreps] = useState<Medrep[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterQ, setFilterQ] = useState('');
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  const [form, setForm] = useState({
    name: '', company: '', amount: '', type: 'deposit',
    payment_method: 'na', card: '', remarks: '', transfer_name: '', transfer_company: '',
  });
  const [bankChoice, setBankChoice] = useState<'maya' | 'metrobank' | 'others'>('maya');

  async function loadMedreps() {
    const r = await api.get('/employees/medreps.php');
    setMedreps(r.medreps);
  }

  async function loadFeed(p = page) {
    const r = await api.get(`/employees/list.php?page=${p}&per_page=25&f_q=${encodeURIComponent(filterQ)}`);
    setRows(r.rows);
    setTotalPages(r.total_pages);
    setPage(r.page);
  }

  useEffect(() => { loadMedreps(); loadFeed(1); }, []);

  function updateField(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === 'name') {
      const match = medreps.find((m) => m.name.toLowerCase() === v.toLowerCase());
      if (match) setForm((f) => ({ ...f, company: match.company }));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api.post('/employees/transaction/add.php', { ...form, amount: parseFloat(form.amount || '0') });
      setMsg({ text: r.message || 'Success', kind: 'success' });
      setForm((f) => ({ ...f, amount: '', remarks: '', transfer_name: '', transfer_company: '' }));
      loadFeed(1);
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Something went wrong.', kind: 'error' });
    }
  }

  return (
    <Layout>
      <div className="topline">
        <h1>Daily Transaction</h1>
      </div>
      <Banner message={msg?.text || ''} kind={msg?.kind || 'success'} />

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>New transaction</h2>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="field">
              <label>Medrep name</label>
              <input list="medrep-names" value={form.name} onChange={(e) => updateField('name', e.target.value)} required />
              <datalist id="medrep-names">
                {medreps.map((m) => <option key={m.name} value={m.name} />)}
              </datalist>
            </div>
            <div className="field">
              <label>Company</label>
              <input value={form.company} onChange={(e) => updateField('company', e.target.value)} required />
            </div>
            <div className="field">
              <label>Transaction type</label>
              <select value={form.type} onChange={(e) => updateField('type', e.target.value)}>
                {TX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => updateField('amount', e.target.value)} required />
            </div>
          </div>

          {form.type === 'transfer' ? (
            <div className="form-row">
              <div className="field">
                <label>Transfer to (name)</label>
                <input list="medrep-names" value={form.transfer_name} onChange={(e) => updateField('transfer_name', e.target.value)} required />
              </div>
              <div className="field">
                <label>Their company</label>
                <input value={form.transfer_company} onChange={(e) => updateField('transfer_company', e.target.value)} required />
              </div>
            </div>
          ) : (
            <div className="form-row">
              <div className="field">
                <label>Payment method</label>
                <select
                  value={form.payment_method}
                  onChange={(e) => {
                    const pm = e.target.value;
                    updateField('payment_method', pm);
                    if (pm === 'card') {
                      // Re-apply whichever bank choice was last selected
                      // (or default to Maya) so `card` always has a value.
                      updateField('card', bankChoice === 'others' ? '' : (bankChoice === 'maya' ? 'Maya' : 'Metro Bank'));
                    } else {
                      updateField('card', '');
                    }
                  }}
                >
                  <option value="na">N/A</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card/Swipe</option>
                  <option value="paid">Paid</option>
                  <option value="giftcard">Gift Card</option>
                </select>
              </div>
              {form.payment_method === 'card' && (
                <div className="field">
                  <label>Bank</label>
                  <select
                    value={bankChoice}
                    onChange={(e) => {
                      const choice = e.target.value as 'maya' | 'metrobank' | 'others';
                      setBankChoice(choice);
                      if (choice === 'maya') updateField('card', 'Maya');
                      else if (choice === 'metrobank') updateField('card', 'Metro Bank');
                      else updateField('card', '');
                    }}
                  >
                    <option value="maya">Maya</option>
                    <option value="metrobank">Metro Bank</option>
                    <option value="others">Others</option>
                  </select>
                </div>
              )}
              {form.payment_method === 'card' && bankChoice === 'others' && (
                <div className="field">
                  <label>Specify card/bank name</label>
                  <input
                    value={form.card}
                    onChange={(e) => updateField('card', e.target.value)}
                    placeholder="Specify card/bank name"
                    required
                  />
                </div>
              )}
            </div>
          )}

          <div className="field">
            <label>Remarks</label>
            <input value={form.remarks} onChange={(e) => updateField('remarks', e.target.value)} />
          </div>

          <button className="btn" type="submit">Submit transaction</button>
        </form>
      </div>

      <div className="card">
        <div className="topline" style={{ marginBottom: 12 }}>
          <h2>Recent transactions</h2>
          <input
            className="search-input"
            placeholder="Search name or company…"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadFeed(1)}
          />
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Company</th><th>Remarks</th><th>Via</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="empty-state">No transactions yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.company}</td>
                <td>{r.remarks}</td>
                <td>{r.sender_name || '—'}</td>
                <td>{dateStr(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <button className="btn secondary small" disabled={page <= 1} onClick={() => loadFeed(page - 1)}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button className="btn secondary small" disabled={page >= totalPages} onClick={() => loadFeed(page + 1)}>Next →</button>
        </div>
      </div>
    </Layout>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <StaffPage />
    </RequireAuth>
  );
}