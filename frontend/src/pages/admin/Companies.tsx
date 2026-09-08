import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Banner } from '../../components/ui';
import api, { ApiError } from '../../api/client';

export default function Companies() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  async function load() {
    const r = await api.get('/companies/index.php');
    setCompanies(r.companies);
  }
  useEffect(() => { load(); }, []);

  async function addCompany(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post('/companies/index.php', { action: 'add', name: newName });
      setMsg({ text: r.message, kind: 'success' });
      setNewName('');
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Failed to add company.', kind: 'error' });
    }
  }

  async function saveRename(id: number) {
    try {
      const r = await api.post('/companies/index.php', { action: 'rename', id, name: renameValue });
      setMsg({ text: r.message, kind: 'success' });
      setRenaming(null);
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Failed to rename.', kind: 'error' });
    }
  }

  async function del(id: number, name: string) {
    if (!confirm(`Delete company "${name}"? Existing customer records are left as-is.`)) return;
    await api.post('/companies/index.php', { action: 'delete', id });
    load();
  }

  const filtered = companies.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Layout>
      <div className="topline"><h1>Companies</h1></div>
      <Banner message={msg?.text || ''} kind={msg?.kind || 'success'} />

      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={addCompany} className="form-row">
          <div className="field">
            <label>Company name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Acme Corp" required />
          </div>
          <button className="btn" type="submit">+ Add company</button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <a className="btn secondary" href={api.rawUrl('/export.php')}>⇩ Download all (CSV)</a>
        <a className="btn secondary" href={api.rawUrl('/export.php?format=xlsx')}>⇩ Download all, by company (Excel)</a>
      </div>

      <div className="card">
        <input className="search-input" placeholder="Search companies…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
        <table>
          <thead><tr><th>Company</th><th>Records</th><th>Added</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={4} className="empty-state">No companies yet.</td></tr>}
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  {renaming === c.id ? (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                      <button className="btn small" onClick={() => saveRename(c.id)}>Save</button>
                    </span>
                  ) : (
                    <>
                      <Link to={`/admin/customers?company=${encodeURIComponent(c.name)}`}>{c.name}</Link>{' '}
                      <button className="btn secondary small" onClick={() => { setRenaming(c.id); setRenameValue(c.name); }}>✎</button>
                    </>
                  )}
                </td>
                <td><span className="badge active">{c.record_count}</span></td>
                <td>{c.created_at}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <a className="btn secondary small" href={api.rawUrl(`/export.php?company=${encodeURIComponent(c.name)}`)}>Download</a>
                  <button className="btn danger small" onClick={() => del(c.id, c.name)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
