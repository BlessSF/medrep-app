'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Layout from '../../../components/Layout';
import RequireAuth from '../../../components/RequireAuth';
import { Modal, Banner } from '../../../components/ui';
import { IconTrash } from '../../../components/icons';
import { useAuth } from '../../../context/AuthContext';
import api, { ApiError } from '../../../api/client';

function BranchesPage() {
  const { branch: currentBranch } = useAuth();
  const [branches, setBranches] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', admin_username: '', admin_password: '' });
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  async function load() {
    const r = await api.get('/branches/list.php');
    setBranches(r.branches);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post('/branches/create.php', form);
      setMsg({ text: r.message, kind: 'success' });
      setForm({ name: '', admin_username: '', admin_password: '' });
      setShowAdd(false);
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Could not create branch.', kind: 'error' });
    }
  }

  async function handleDelete(name: string) {
    const confirmed = confirm(
      `Permanently delete the "${name}" branch?\n\nThis deletes ALL of its customers, transactions, companies, and user accounts. This cannot be undone.\n\nType-check: are you sure?`
    );
    if (!confirmed) return;
    try {
      const r = await api.post('/branches/delete.php', { name });
      setMsg({ text: r.message, kind: 'success' });
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Could not delete branch.', kind: 'error' });
    }
  }

  return (
    <Layout>
      <div className="topline">
        <h1>Branches</h1>
        <button className="btn" onClick={() => setShowAdd(true)}>+ New branch</button>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 16 }}>
        Each branch has its own completely separate customers, companies, and users — creating one
        starts with a blank slate. You're currently signed in to <strong>{currentBranch}</strong>.
      </p>

      {msg && <Banner message={msg.text} kind={msg.kind} />}

      <div className="card">
        <table>
          <thead><tr><th>Branch</th><th>Actions</th></tr></thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b}>
                <td>{b}{b === currentBranch && <span className="badge active" style={{ marginLeft: 8 }}>Current</span>}</td>
                <td className="actions-cell">
                  <button
                    className="icon-btn danger"
                    title={b === currentBranch ? "Can't delete the branch you're signed in to" : `Delete ${b}`}
                    disabled={b === currentBranch}
                    onClick={() => handleDelete(b)}
                  >
                    <IconTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="New branch" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd}>
            <div className="field">
              <label>Branch name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))}
                placeholder="e.g. HERO"
                required
              />
            </div>
            <div className="field">
              <label>First admin username</label>
              <input
                value={form.admin_username}
                onChange={(e) => setForm((f) => ({ ...f, admin_username: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>First admin password</label>
              <input
                type="password"
                value={form.admin_password}
                onChange={(e) => setForm((f) => ({ ...f, admin_password: e.target.value }))}
                required
              />
            </div>
            <button className="btn" type="submit">Create branch</button>
          </form>
        </Modal>
      )}
    </Layout>
  );
}

export default function Page() {
  return (
    <RequireAuth role="admin">
      <BranchesPage />
    </RequireAuth>
  );
}