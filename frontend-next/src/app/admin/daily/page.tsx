'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import RequireAuth from '../../../components/RequireAuth';
import { StatCard } from '../../../components/ui';
import api from '../../../api/client';
import { money, MONTH_NAMES } from '../../../lib/format';

function DailyPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [days, setDays] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total_receivable_all_time: 0, total_payable_all_time: 0,
    total_receivable_selected_period: 0, total_payable_selected_period: 0,
  });
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get(`/reports/daily.php?month=${month}&year=${year}`).then((r) => {
      setDays(r.days);
      setSummary({
        total_receivable_all_time: r.total_receivable_all_time,
        total_payable_all_time: r.total_payable_all_time,
        total_receivable_selected_period: r.total_receivable_selected_period,
        total_payable_selected_period: r.total_payable_selected_period,
      });
    });
  }, [month, year]);

  const filteredDays = q ? days.filter((d) => d.transaction_date.includes(q)) : days;

  const totals = filteredDays.reduce(
    (acc, d) => ({
      dinein: acc.dinein + Number(d.dinein), takeout: acc.takeout + Number(d.takeout),
      deposit: acc.deposit + Number(d.deposit), cashout: acc.cashout + Number(d.cashout),
      giftcard: acc.giftcard + Number(d.giftcard), interest: acc.interest + Number(d.interest),
      total_sales: acc.total_sales + Number(d.total_sales),
    }),
    { dinein: 0, takeout: 0, deposit: 0, cashout: 0, giftcard: 0, interest: 0, total_sales: 0 }
  );

  return (
    <Layout>
      <div className="topline">
        <h1>Daily Sales</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            <option value={0}>All months</option>
            {MONTH_NAMES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            <option value={0}>All years</option>
            {Array.from({ length: now.getFullYear() - 2022 + 1 }, (_, i) => now.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Link className="btn secondary" href="/admin/receivables">Receivables &amp; Payables</Link>
        </div>
      </div>

      <div className="stat-row">
        <StatCard
          label="Total receivables (all time)"
          value={money(Math.abs(summary.total_receivable_all_time))}
          negative={summary.total_receivable_all_time < 0}
        />
        <StatCard label="Total payables (all time)" value={money(summary.total_payable_all_time)} />
        <StatCard
          label="Total receivables (selected period)"
          value={money(Math.abs(summary.total_receivable_selected_period))}
          negative={summary.total_receivable_selected_period < 0}
        />
        <StatCard label="Total payables (selected period)" value={money(summary.total_payable_selected_period)} />
      </div>

      <div className="card">
        <input
          className="search-input"
          placeholder="Search by date…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <div className="table-scroll">
        <table className="col-divided">
          <thead>
            <tr>
              <th className="nowrap-cell">Date</th><th className="num">Dine In</th><th className="num">Takeout</th>
              <th className="num">Total Sales</th><th className="num">Deposit</th><th className="num">Gift Card</th>
              <th className="num">Cashout</th><th className="num">Interest</th><th className="num">Records</th>
              <th className="num">Total Payable</th><th className="num">Total Receivable</th>
            </tr>
          </thead>
          <tbody>
            {filteredDays.length === 0 && <tr><td colSpan={11} className="empty-state">No transactions in this period.</td></tr>}
            {filteredDays.map((d) => (
              <tr key={d.transaction_date}>
                <td className="nowrap-cell">{d.transaction_date}</td>
                <td className="num">{money(d.dinein)}</td>
                <td className="num">{money(d.takeout)}</td>
                <td className="num" style={{ fontWeight: 700 }}>{money(d.total_sales)}</td>
                <td className="num">{money(d.deposit)}</td>
                <td className="num">{money(d.giftcard)}</td>
                <td className="num">{money(d.cashout)}</td>
                <td className="num">{money(d.interest)}</td>
                <td className="num">{d.record_count}</td>
                <td className="num">
                  <span className="balance-pill payable">{money(d.total_payable_snapshot)}</span>
                </td>
                <td className="num">
                  <span className="balance-pill receivable">{money(Math.abs(d.total_receivable_snapshot))}</span>
                </td>
              </tr>
            ))}
          </tbody>
          {filteredDays.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td className="num">{money(totals.dinein)}</td>
                <td className="num">{money(totals.takeout)}</td>
                <td className="num">{money(totals.total_sales)}</td>
                <td className="num">{money(totals.deposit)}</td>
                <td className="num">{money(totals.giftcard)}</td>
                <td className="num">{money(totals.cashout)}</td>
                <td className="num">{money(totals.interest)}</td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          Total Payable / Total Receivable are branch-wide snapshots as of each date — the net balance across
          every medrep, calculated using only transactions up to and including that day (same logic as the
          Receivables page's "As of Date" view). They can rise or fall day to day depending on that day's activity.
        </p>
      </div>
    </Layout>
  );
}

export default function Page() {
  return (
    <RequireAuth role="admin">
      <DailyPage />
    </RequireAuth>
  );
}