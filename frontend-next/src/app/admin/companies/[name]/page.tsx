'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Layout from '../../../../components/Layout';
import RequireAuth from '../../../../components/RequireAuth';
import { StatCard } from '../../../../components/ui';
import api from '../../../../api/client';
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

  useEffect(() => {
    if (!name) return;
    api.get(`/employees/medreps.php?company=${encodeURIComponent(name)}`).then((r) => setMedreps(r.medreps));
  }, [name]);

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
      <div className="topline"><h1>{name}</h1></div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 16 }}>
        {medreps.length} medrep{medreps.length === 1 ? '' : 's'} under this company
      </p>

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