'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import RequireAuth from '../../../components/RequireAuth';
import { StatCard } from '../../../components/ui';
import api from '../../../api/client';
import { money, MONTH_NAMES } from '../../../lib/format';

function ReceivablesPage() {
  const now = new Date();
  const [type, setType] = useState<'receivable' | 'payable'>('receivable');
  const [scope, setScope] = useState<'alltime' | 'filtered' | 'date'>('alltime');
  const [month, setMonth] = useState(0); // 0 = All Months
  const [year, setYear] = useState(0);   // 0 = All Years
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [cutoffDate, setCutoffDate] = useState(now.toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any | null>(null);

  const useRange = rangeFrom !== '' && rangeTo !== '';

  useEffect(() => {
    const params = new URLSearchParams({ type, scope });
    if (scope === 'filtered') {
      if (useRange) {
        params.set('range_from', rangeFrom);
        params.set('range_to', rangeTo);
      } else {
        if (month) params.set('month', String(month));
        if (year) params.set('year', String(year));
      }
    }
    if (scope === 'date') params.set('date', cutoffDate);
    api.get(`/reports/receivables.php?${params}`).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, scope, month, year, rangeFrom, rangeTo, cutoffDate]);

  const scopeLabel = useMemo(() => {
    if (scope === 'alltime') return 'All Time';
    if (scope === 'date') return `As of ${cutoffDate}`;
    if (useRange) return `${rangeFrom} – ${rangeTo}`;
    return 'Selected Period';
  }, [scope, cutoffDate, useRange, rangeFrom, rangeTo]);

  // Client-side search across medrep name and company name, same
  // convention as the Monthly report's name/company search.
  const filteredByCompany = useMemo(() => {
    if (!data) return {};
    const q = search.trim().toLowerCase();
    if (!q) return data.by_company;
    const out: Record<string, any> = {};
    for (const [company, group] of Object.entries<any>(data.by_company)) {
      const companyMatches = company.toLowerCase().includes(q);
      const rows = companyMatches ? group.rows : group.rows.filter((r: any) => r.name.toLowerCase().includes(q));
      if (rows.length > 0) out[company] = { ...group, rows };
    }
    return out;
  }, [data, search]);

  const companyEntries = Object.entries(filteredByCompany);

  return (
    <Layout>
      <div className="topline"><h1>Receivables &amp; Payables</h1></div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-row" style={{ marginBottom: scope !== 'alltime' ? 14 : 0 }}>
          <div className="segmented" role="group" aria-label="Balance type">
            <button
              type="button"
              className={`segmented-btn ${type === 'receivable' ? 'active receivable' : ''}`}
              onClick={() => setType('receivable')}
            >
              Receivables
            </button>
            <button
              type="button"
              className={`segmented-btn ${type === 'payable' ? 'active payable' : ''}`}
              onClick={() => setType('payable')}
            >
              Payables
            </button>
          </div>
          <div className="segmented" role="group" aria-label="Scope">
            <button
              type="button"
              className={`segmented-btn ${scope === 'alltime' ? 'active' : ''}`}
              onClick={() => setScope('alltime')}
            >
              All Time
            </button>
            <button
              type="button"
              className={`segmented-btn ${scope === 'filtered' ? 'active' : ''}`}
              onClick={() => setScope('filtered')}
            >
              Selected Period
            </button>
            <button
              type="button"
              className={`segmented-btn ${scope === 'date' ? 'active' : ''}`}
              onClick={() => setScope('date')}
            >
              As of Date
            </button>
          </div>
        </div>

        {scope === 'filtered' && (
          <div className="form-row" style={{ paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <div className="field">
              <label>Month</label>
              <select value={month} disabled={useRange} onChange={(e) => setMonth(Number(e.target.value))}>
                <option value={0}>All Months</option>
                {MONTH_NAMES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Year</label>
              <select value={year} disabled={useRange} onChange={(e) => setYear(Number(e.target.value))}>
                <option value={0}>All Years</option>
                {Array.from({ length: now.getFullYear() - 2022 + 1 }, (_, i) => 2022 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Or from</label>
              <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
            </div>
            <div className="field">
              <label>To (any year)</label>
              <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
            </div>
            {useRange && (
              <div className="field">
                <label>&nbsp;</label>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => { setRangeFrom(''); setRangeTo(''); }}
                >
                  &times; Clear range
                </button>
              </div>
            )}
          </div>
        )}

        {scope === 'date' && (
          <div className="form-row" style={{ paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <div className="field">
              <label>As of</label>
              <input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {data && (
        <>
          <div className="stat-row">
            <StatCard
              label={`Grand total ${type === 'receivable' ? 'receivable' : 'payable'} — ${scopeLabel}`}
              value={money(Math.abs(data.grand_total))}
              negative={type === 'receivable'}
            />
            <StatCard label="Medreps in this list" value={String(data.total_medreps)} />
          </div>

          {companyEntries.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <input
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by medrep or company…"
              />
            </div>
          )}

          {companyEntries.length === 0 && (
            <div className="card empty-state">
              {search ? 'No medreps or companies match your search.' : 'Nothing to show for this filter.'}
            </div>
          )}

          {companyEntries.map(([company, group]: [string, any]) => (
            <div className="card" key={company} style={{ marginBottom: 16 }}>
              <div className="topline" style={{ marginBottom: 8 }}>
                <h2>{company} <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>({group.rows.length} medrep{group.rows.length === 1 ? '' : 's'})</span></h2>
                <strong className="num" style={{ fontFamily: 'var(--mono)' }}>{money(Math.abs(group.subtotal))}</strong>
              </div>
              <table>
                <thead><tr><th>Name</th><th className="num">Balance</th><th>Profile</th></tr></thead>
                <tbody>
                  {group.rows.map((r: any) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td className="num"><span className={`balance-pill ${type}`}>{money(Math.abs(r.balance))}</span></td>
                      <td><Link className="btn secondary small" href={`/admin/customers/${encodeURIComponent(r.name)}`}>View</Link></td>
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

export default function Page() {
  return (
    <RequireAuth role="admin">
      <ReceivablesPage />
    </RequireAuth>
  );
}