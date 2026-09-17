import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { StatCard } from '../../components/ui';
import api from '../../api/client';
import { money, MONTH_NAMES } from '../../lib/format';

export default function Receivables() {
  const now = new Date();
  const [type, setType] = useState<'receivable' | 'payable'>('receivable');
  const [scope, setScope] = useState<'alltime' | 'filtered' | 'date'>('alltime');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [cutoffDate, setCutoffDate] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ type, scope });
    if (scope === 'filtered') { params.set('month', String(month)); params.set('year', String(year)); }
    if (scope === 'date') params.set('date', cutoffDate);
    api.get(`/reports/receivables.php?${params}`).then(setData);
  }, [type, scope, month, year, cutoffDate]);

  return (
    <Layout>
      <div className="topline"><h1>Receivables &amp; Payables</h1></div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-row">
          <div className="field">
            <label>Show</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="receivable">Receivables (they owe us)</option>
              <option value="payable">Payables (we owe them)</option>
            </select>
          </div>
          <div className="field">
            <label>Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value as any)}>
              <option value="alltime">All time</option>
              <option value="filtered">Specific month</option>
              <option value="date">As of date</option>
            </select>
          </div>
          {scope === 'filtered' && (
            <>
              <div className="field">
                <label>Month</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTH_NAMES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Year</label>
                <input type="number" style={{ width: 90 }} value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
            </>
          )}
          {scope === 'date' && (
            <div className="field">
              <label>As of</label>
              <input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {data && (
        <>
          <div className="stat-row">
            <StatCard label={`Grand total ${type === 'receivable' ? 'receivable' : 'payable'}`} value={money(Math.abs(data.grand_total))} negative={type === 'receivable'} />
            <StatCard label="Medreps in this list" value={String(data.total_medreps)} />
          </div>

          {Object.keys(data.by_company).length === 0 && <div className="card empty-state">Nothing to show for this filter.</div>}

          {Object.entries(data.by_company).map(([company, group]: [string, any]) => (
            <div className="card" key={company} style={{ marginBottom: 16 }}>
              <div className="topline" style={{ marginBottom: 8 }}>
                <h2>{company}</h2>
                <strong className="num" style={{ fontFamily: 'var(--mono)' }}>{money(Math.abs(group.subtotal))}</strong>
              </div>
              <table>
                <thead><tr><th>Name</th><th className="num">Balance</th></tr></thead>
                <tbody>
                  {group.rows.map((r: any) => (
                    <tr key={r.name}>
                      <td><Link to={`/admin/customers/${encodeURIComponent(r.name)}`}>{r.name}</Link></td>
                      <td className="num">{money(Math.abs(r.balance))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </Layout>
  );
}
