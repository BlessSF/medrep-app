'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import RequireAuth from '../../../components/RequireAuth';
import { Banner } from '../../../components/ui';
import api, { ApiError } from '../../../api/client';
import { dateStr } from '../../../lib/format';
import { IconCheck } from '../../../components/icons';

interface Medrep { name: string; company: string; blocked: boolean; last_activity: string }

function BlockMedrepPage() {
  const [medreps, setMedreps] = useState<Medrep[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  async function load() {
    const r = await api.get('/employees/medreps.php');
    setMedreps(r.medreps);
  }

  useEffect(() => { load(); }, []);

  const blocked = useMemo(() => {
    const list = medreps.filter((m) => m.blocked);
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((m) => m.name.toLowerCase().includes(query) || m.company.toLowerCase().includes(query));
  }, [medreps, q]);

  async function handleUnblock(m: Medrep) {
    try {
      const r = await api.post('/employees/unblock.php', { name: m.name });
      setMsg({ text: r.message, kind: 'success' });
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Failed to unblock.', kind: 'error' });
    }
  }

  return (
    <Layout>
      <div className="topline"><h1>Block Medrep</h1></div>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        Medreps currently blocked from submitting new transactions. Unblock a name here to restore access.
      </p>
      <Banner message={msg?.text || ''} kind={msg?.kind || 'success'} />

      <div className="card">
        <input
          className="search-input"
          placeholder="Search blocked medreps…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <table>
          <thead>
            <tr><th>Name</th><th>Company</th><th>Last transaction</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {blocked.length === 0 && (
              <tr><td colSpan={5} className="empty-state">
                {q ? 'No blocked medreps match your search.' : 'No medreps are currently blocked.'}
              </td></tr>
            )}
            {blocked.map((m) => (
              <tr key={m.name}>
                <td><Link href={`/admin/customers/${encodeURIComponent(m.name)}`}>{m.name}</Link></td>
                <td>{m.company}</td>
                <td>{m.last_activity ? dateStr(m.last_activity) : '—'}</td>
                <td><span className="badge blocked">Blocked</span></td>
                <td>
                  <button className="icon-btn" title="Unblock" onClick={() => handleUnblock(m)}><IconCheck /></button>
                </td>
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
      <BlockMedrepPage />
    </RequireAuth>
  );
}