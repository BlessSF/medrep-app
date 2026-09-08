import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { StatCard } from '../../components/ui';
import api from '../../api/client';
import { dateStr, money } from '../../lib/format';

export default function Dashboard() {
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    api.get('/reports/dashboard.php').then(setData);
  }, []);

  if (!data) return <Layout><div className="empty-state">Loading…</div></Layout>;

  return (
    <Layout>
      <div className="topline"><h1>Dashboard</h1></div>

      <div className="stat-row">
        <StatCard label="Total deposits" value={money(data.total_deposit)} />
        <StatCard label="Total payable" value={money(data.total_payable)} />
        <StatCard label="Total cashed out" value={money(data.total_cashout)} />
        <StatCard label="Net balance" value={money(data.total_balance)} negative={data.total_balance < 0} />
        <StatCard label="Gift card balance" value={money(data.total_giftcard_balance)} />
      </div>

      <div className="stat-row">
        <StatCard label="Medreps on file" value={String(data.medrep_count)} />
        <StatCard label="Companies" value={String(data.company_count)} />
      </div>

      <div className="card">
        <h2>Latest transactions</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Company</th><th className="num">Deposit</th><th className="num">Dine In</th>
              <th className="num">Takeout</th><th className="num">Cashout</th><th>Remarks</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.latest_transactions.map((r: any) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.company}</td>
                <td className="num">{r.deposit > 0 ? money(r.deposit) : '—'}</td>
                <td className="num">{r.dinein > 0 ? money(r.dinein) : '—'}</td>
                <td className="num">{r.takeout > 0 ? money(r.takeout) : '—'}</td>
                <td className="num">{r.cashout > 0 ? money(r.cashout) : '—'}</td>
                <td>{r.remarks}</td>
                <td>{dateStr(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
