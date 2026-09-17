'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Layout from '../../../../components/Layout';
import RequireAuth from '../../../../components/RequireAuth';
import { StatCard, Modal, Banner } from '../../../../components/ui';
import api, { ApiError } from '../../../../api/client';
import { money, dateStr } from '../../../../lib/format';

interface Medrep {
  name: string;
  company: string;
  balance: number;
  total_deposit: number;
  total_payable: number;
  blocked: boolean;
  last_activity: string;
}

function CompanyProfilePage() {
  const params = useParams();
  const name = decodeURIComponent(String(params.name || ''));
  const [medreps, setMedreps] = useState<Medrep[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  async function load() {
    const r = await api.get(`/employees/medreps.php?company=${encodeURIComponent(name)}`);
    setMedreps(r.medreps);
  }

  useEffect(() => { if (name) load(); }, [name]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post('/employees/medreps.php', { medrep_name: newName, medrep_company: name });
      setMsg({ text: r.message, kind: 'success' });
      setNewName('');
      setShowAdd(false);
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Failed to add medrep.', kind: 'error' });
    }
  }

  const totals = useMemo(() => {
    if (!medreps) return null;
    return medreps.reduce(
      (acc, m) => ({
        deposit: acc.deposit + Number(m.total_deposit || 0),
        payable: acc.payable + Number(m.total_payable || 0),
        balance: acc.balance + Number(m.balance || 0),
      }),
      { deposit: 0, payable: 0, balance: 0 }
    );
  }, [medreps]);

  if (!medreps) return <Layout><div className="empty-state">Loading…</div></Layout>;

  return (
    <Layout>
      <div className="topline">
        <h1>{name}</h1>
        <button className="btn" onClick={() => setShowAdd(true)}>+ Add medrep</button>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 16 }}>
        {medreps.length} medrep{medreps.length === 1 ? '' : 's'} under this company
      </p>
      <Banner message={msg?.text || ''} kind={msg?.kind || 'success'} />

      {totals && (
        <div className="stat-row">
          <StatCard label="Total deposit" value={money(totals.deposit)} />
          <StatCard label="Total payable" value={money(totals.payable)} />
          <StatCard label="Net balance" value={money(Math.abs(totals.balance))} negative={totals.balance < 0} />
        </div>
      )}

      <div className="card">
        <table className="col-divided">
          <thead>
            <tr>
              <th>Name</th><th className="num">Deposit</th><th className="num">Payable</th>
              <th className="num">Balance</th><th>Type</th><th className="nowrap-cell">Submitted</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {medreps.length === 0 && <tr><td colSpan={7} className="empty-state">No medreps under this company.</td></tr>}
            {medreps.map((m) => {
              const isPayable = m.balance < 0;
              return (
                <tr key={m.name}>
                  <td><Link href={`/admin/customers/${encodeURIComponent(m.name)}`}>{m.name}</Link></td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title={`Add medrep to ${name}`} onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd}>
            <div className="field">
              <label>Medrep name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label>Company</label>
              <input value={name} disabled />
            </div>
            <button className="btn" type="submit">Add medrep</button>
          </form>
        </Modal>
      )}
    </Layout>
  );
}

export default function Page() {
  return (
    <RequireAuth role="admin">
      <CompanyProfilePage />
    </RequireAuth>
  );
}