import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/client';
import { money, MONTH_NAMES } from '../../lib/format';

export default function Daily() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [days, setDays] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/reports/daily.php?month=${month}&year=${year}`).then((r) => setDays(r.days));
  }, [month, year]);

  const totals = days.reduce(
    (acc, d) => ({
      dinein: acc.dinein + Number(d.dinein), takeout: acc.takeout + Number(d.takeout),
      deposit: acc.deposit + Number(d.deposit), cashout: acc.cashout + Number(d.cashout),
      giftcard: acc.giftcard + Number(d.giftcard), interest: acc.interest + Number(d.interest),
    }),
    { dinein: 0, takeout: 0, deposit: 0, cashout: 0, giftcard: 0, interest: 0 }
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
          <input type="number" style={{ width: 90 }} value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Date</th><th className="num">Deposit</th><th className="num">Dine In</th><th className="num">Takeout</th>
              <th className="num">Gift Card</th><th className="num">Cashout</th><th className="num">Interest</th><th className="num">Records</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 && <tr><td colSpan={8} className="empty-state">No transactions in this period.</td></tr>}
            {days.map((d) => (
              <tr key={d.transaction_date}>
                <td>{d.transaction_date}</td>
                <td className="num">{money(d.deposit)}</td>
                <td className="num">{money(d.dinein)}</td>
                <td className="num">{money(d.takeout)}</td>
                <td className="num">{money(d.giftcard)}</td>
                <td className="num">{money(d.cashout)}</td>
                <td className="num">{money(d.interest)}</td>
                <td className="num">{d.record_count}</td>
              </tr>
            ))}
          </tbody>
          {days.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td className="num">{money(totals.deposit)}</td>
                <td className="num">{money(totals.dinein)}</td>
                <td className="num">{money(totals.takeout)}</td>
                <td className="num">{money(totals.giftcard)}</td>
                <td className="num">{money(totals.cashout)}</td>
                <td className="num">{money(totals.interest)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Layout>
  );
}
