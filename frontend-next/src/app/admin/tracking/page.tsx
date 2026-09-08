'use client';

import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import RequireAuth from '../../../components/RequireAuth';
import api from '../../../api/client';
import { dateStr, MONTH_NAMES } from '../../../lib/format';

function TrackingPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [logs, setLogs] = useState<any[]>([]);
  const [years, setYears] = useState<number[]>([]);

  useEffect(() => {
    api.get(`/logs/list.php?month=${month}&year=${year}`).then((r) => {
      setLogs(r.logs);
      setYears(r.years.length ? r.years : [now.getFullYear()]);
    });
  }, [month, year]);

  return (
    <Layout>
      <div className="topline">
        <h1>Tracking</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={4} className="empty-state">No activity logged for this period.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{dateStr(l.timestamp)}</td>
                <td>{l.username}</td>
                <td>{l.action}</td>
                <td>{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

export default function Page() {
  return (
    <RequireAuth role="admin">
      <TrackingPage />
    </RequireAuth>
  );
}
