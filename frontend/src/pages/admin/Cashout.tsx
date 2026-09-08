import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import Layout from '../../components/Layout';
import { StatCard } from '../../components/ui';
import api from '../../api/client';
import { dateStr, money, MONTH_NAMES } from '../../lib/format';

export default function Cashout() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    api.get(`/reports/cashout.php?month=${month}&year=${year}&chart_year=${year}`).then(setData);
  }, [month, year]);

  const chartData = data?.chart
    ? MONTH_NAMES.slice(1).map((label, i) => ({
        month: label.slice(0, 3),
        Cashout: data.chart.cashout[i + 1] || 0,
        Interest: data.chart.interest[i + 1] || 0,
      }))
    : [];

  return (
    <Layout>
      <div className="topline">
        <h1>Cashout Report</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" style={{ width: 90 }} value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
      </div>

      {data && (
        <>
          <div className="stat-row">
            <StatCard label="Total cashed out" value={money(data.summary.total_cashout)} />
            <StatCard label="Total interest paid" value={money(data.summary.total_interest)} />
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h2>{year} by month</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e1d3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Legend />
                <Bar dataKey="Cashout" fill="#1b4332" />
                <Bar dataKey="Interest" fill="#b8860f" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2>Transactions this month</h2>
            <table>
              <thead><tr><th>Name</th><th className="num">Cashout</th><th className="num">Interest</th><th>Date</th></tr></thead>
              <tbody>
                {data.rows.length === 0 && <tr><td colSpan={4} className="empty-state">No cashouts in this period.</td></tr>}
                {data.rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td className="num">{r.cashout > 0 ? money(r.cashout) : '—'}</td>
                    <td className="num">{r.interest > 0 ? money(r.interest) : '—'}</td>
                    <td>{dateStr(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  );
}
