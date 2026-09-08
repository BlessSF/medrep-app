import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/client';
import { dateStr, money } from '../../lib/format';

export default function Monthly() {
  const [rows, setRows] = useState<any[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (company) params.set('company', company);
    const r = await api.get(`/reports/monthly.php?${params}`);
    setRows(r.rows);
    setCompanies(r.companies);
  }

  useEffect(() => { load(); }, [company]);

  return (
    <Layout>
      <div className="topline"><h1>Sales Reports</h1></div>

      <div className="card">
        <div className="form-row" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Search name</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          </div>
          <div className="field">
            <label>Company</label>
            <select value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">All companies</option>
              {companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn secondary" onClick={load}>Search</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th><th>Company</th><th className="num">Deposit</th><th className="num">Payable</th>
              <th className="num">Cashout</th><th className="num">Gift Card</th><th className="num">Balance</th><th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="empty-state">No results.</td></tr>}
            {rows.map((r) => (
              <tr key={r.name}>
                <td><Link to={`/admin/customers/${encodeURIComponent(r.name)}`}>{r.name}</Link></td>
                <td>{r.company}</td>
                <td className="num">{money(r.total_deposit)}</td>
                <td className="num">{money(r.total_payable)}</td>
                <td className="num">{money(r.total_cashout)}</td>
                <td className="num">{money(r.total_giftcard)}</td>
                <td className="num">{money(r.total_balance)}</td>
                <td>{dateStr(r.latest_transaction)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
