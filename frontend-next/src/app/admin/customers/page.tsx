'use client';

import { useEffect, useState, Suspense, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import RequireAuth from '../../../components/RequireAuth';
import { Banner, Modal } from '../../../components/ui';
import api, { ApiError } from '../../../api/client';
import { money, dateStr } from '../../../lib/format';
import { IconEdit, IconBan, IconCheck, IconTrash, IconDownload } from '../../../components/icons';

interface Medrep {
  name: string;
  company: string;
  balance: number;
  total_deposit: number;
  total_payable: number;
  blocked: boolean;
  last_activity: string;
}

function CustomersPage() {
  const searchParams = useSearchParams();
  const companyFilter = searchParams.get('company') || '';
  const [medreps, setMedreps] = useState<Medrep[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Medrep | null>(null);
  const [newForm, setNewForm] = useState({ medrep_name: '', medrep_company: '' });
  const [editForm, setEditForm] = useState({ edit_name: '', edit_company: '' });

  async function load() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (companyFilter) params.set('company', companyFilter);
    const qs = params.toString();
    const r = await api.get(`/employees/medreps.php${qs ? `?${qs}` : ''}`);
    setMedreps(r.medreps);
  }

  async function loadCompanies() {
    const r = await api.get('/companies/index.php');
    setCompanies(r.companies.map((c: any) => c.name).sort());
  }

  useEffect(() => { loadCompanies(); }, []);

  async function addMedrep(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post('/employees/medreps.php', newForm);
      setMsg({ text: r.message, kind: 'success' });
      setShowAdd(false);
      setNewForm({ medrep_name: '', medrep_company: '' });
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Failed to add medrep.', kind: 'error' });
    }
  }

  async function toggleBlock(m: Medrep) {
    try {
      const r = await api.post(m.blocked ? '/employees/unblock.php' : '/employees/block.php', { name: m.name });
      setMsg({ text: r.message, kind: 'success' });
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Action failed.', kind: 'error' });
    }
  }

  async function deleteCustomer(m: Medrep) {
    if (!confirm(`Delete ALL records for "${m.name}"? This cannot be undone.`)) return;
    try {
      await api.post('/employees/delete_customer.php', { name: m.name });
      setMsg({ text: 'Customer deleted successfully.', kind: 'success' });
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Delete failed.', kind: 'error' });
    }
  }

  function openEdit(m: Medrep) {
    setEditTarget(m);
    setEditForm({ edit_name: m.name, edit_company: m.company });
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    try {
      await api.post('/employees/edit.php', { original_name: editTarget.name, ...editForm });
      setMsg({ text: 'Customer updated successfully.', kind: 'success' });
      setEditTarget(null);
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Update failed.', kind: 'error' });
    }
  }

  useEffect(() => { load(); }, [companyFilter]);

  return (
    <Layout>
      <div className="topline">
        <h1>Customers</h1>
        <button className="btn" onClick={() => setShowAdd(true)}>+ Add medrep</button>
      </div>
      <Banner message={msg?.text || ''} kind={msg?.kind || 'success'} />

      <div className="card">
        {companyFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="badge active">Filtering by company: {companyFilter}</span>
            <Link href="/admin/customers" className="btn secondary small">Clear filter</Link>
          </div>
        )}
        <input
          className="search-input"
          placeholder="Search name or company…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          style={{ marginBottom: 12 }}
        />
        <table className="col-divided">
          <thead>
            <tr>
              <th>Name</th><th>Company</th><th className="num">Deposit</th><th className="num">Payable</th>
              <th className="num">Balance</th><th>Type</th><th className="nowrap-cell">Submitted</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {medreps.length === 0 && <tr><td colSpan={9} className="empty-state">No medreps found.</td></tr>}
            {medreps.map((m) => {
              const isPayable = m.balance < 0;
              return (
              <tr key={m.name}>
                <td><Link href={`/admin/customers/${encodeURIComponent(m.name)}`}>{m.name}</Link></td>
                <td><Link href={`/admin/companies/${encodeURIComponent(m.company)}`}>{m.company}</Link></td>
                <td className="num">{money(m.total_deposit)}</td>
                <td className="num">{money(m.total_payable)}</td>
                <td className="num">
                  <span className={`balance-pill ${isPayable ? 'receivable' : 'payable'}`}>
                    {money(Math.abs(m.balance))}
                  </span>
                </td>
                <td><span className={`badge ${isPayable ? 'blocked' : 'active'}`}>{isPayable ? 'Payable' : 'Receivable'}</span></td>
                <td className="muted nowrap-cell">{m.last_activity ? dateStr(m.last_activity) : '—'}</td>
                <td><span className={`badge ${m.blocked ? 'blocked' : 'active'}`}>{m.blocked ? 'Blocked' : 'Active'}</span></td>
                <td className="actions-cell">
                  <div className="action-group">
                    <a
                      className="icon-btn"
                      title="Download transactions (CSV)"
                      href={api.rawUrl(`/export.php?medrep=${encodeURIComponent(m.name)}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <IconDownload />
                    </a>
                    <button className="icon-btn" title="Edit" onClick={() => openEdit(m)}><IconEdit /></button>
                    <button
                      className={`icon-btn ${m.blocked ? '' : 'warn'}`}
                      title={m.blocked ? 'Unblock' : 'Block'}
                      onClick={() => toggleBlock(m)}
                    >
                      {m.blocked ? <IconCheck /> : <IconBan />}
                    </button>
                    <button className="icon-btn danger" title="Delete" onClick={() => deleteCustomer(m)}><IconTrash /></button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="Add medrep" onClose={() => setShowAdd(false)}>
          <form onSubmit={addMedrep}>
            <div className="field">
              <label>Name</label>
              <input value={newForm.medrep_name} onChange={(e) => setNewForm((f) => ({ ...f, medrep_name: e.target.value }))} required autoFocus />
            </div>
            <div className="field">
              <label>Company</label>
              <select
                value={newForm.medrep_company}
                onChange={(e) => setNewForm((f) => ({ ...f, medrep_company: e.target.value }))}
                required
              >
                <option value="" disabled>Select a company…</option>
                {companies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn" type="submit">Add</button>
          </form>
        </Modal>
      )}

      {editTarget && (
        <Modal title={`Edit "${editTarget.name}"`} onClose={() => setEditTarget(null)}>
          <form onSubmit={saveEdit}>
            <div className="field">
              <label>Name</label>
              <input value={editForm.edit_name} onChange={(e) => setEditForm((f) => ({ ...f, edit_name: e.target.value }))} required />
            </div>
            <div className="field">
              <label>Company</label>
              <select
                value={editForm.edit_company}
                onChange={(e) => setEditForm((f) => ({ ...f, edit_company: e.target.value }))}
                required
              >
                {!companies.includes(editForm.edit_company) && editForm.edit_company && (
                  <option value={editForm.edit_company}>{editForm.edit_company} (not in list)</option>
                )}
                {companies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn" type="submit">Save</button>
          </form>
        </Modal>
      )}
    </Layout>
  );
}

export default function Page() {
  return (
    <RequireAuth role="admin">
      <Suspense fallback={<Layout><div className="empty-state">Loading…</div></Layout>}>
        <CustomersPage />
      </Suspense>
    </RequireAuth>
  );
}