'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Layout from '../../../components/Layout';
import RequireAuth from '../../../components/RequireAuth';
import { Banner } from '../../../components/ui';
import api, { ApiError } from '../../../api/client';

function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [currentUsername, setCurrentUsername] = useState('');
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const [newUser, setNewUser] = useState({ new_username: '', new_password: '', new_role: 'cashier' });
  const [pwUser, setPwUser] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState('');

  async function load() {
    const r = await api.get('/users/index.php');
    setUsers(r.users);
    setCurrentUsername(r.current_username);
  }
  useEffect(() => { load(); }, []);

  async function addUser(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post('/users/index.php', { action: 'add', ...newUser });
      setMsg({ text: r.message, kind: 'success' });
      setNewUser({ new_username: '', new_password: '', new_role: 'cashier' });
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Failed to add user.', kind: 'error' });
    }
  }

  async function deleteUser(username: string) {
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
      const r = await api.post('/users/index.php', { action: 'delete', delete_username: username });
      setMsg({ text: r.message, kind: 'success' });
      load();
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Failed to delete user.', kind: 'error' });
    }
  }

  async function changePassword(username: string) {
    try {
      const r = await api.post('/users/index.php', { action: 'change_password', change_password_username: username, new_password: pwValue });
      setMsg({ text: r.message, kind: 'success' });
      setPwUser(null);
      setPwValue('');
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : 'Failed to change password.', kind: 'error' });
    }
  }

  return (
    <Layout>
      <div className="topline"><h1>Users</h1></div>
      <Banner message={msg?.text || ''} kind={msg?.kind || 'success'} />

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Add user</h2>
        <form onSubmit={addUser} className="form-row">
          <div className="field">
            <label>Username</label>
            <input value={newUser.new_username} onChange={(e) => setNewUser((f) => ({ ...f, new_username: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={newUser.new_password} onChange={(e) => setNewUser((f) => ({ ...f, new_password: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={newUser.new_role} onChange={(e) => setNewUser((f) => ({ ...f, new_role: e.target.value }))}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn" type="submit">Add user</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Username</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.username}>
                <td>{u.username}{u.username === currentUsername && <span className="muted"> (you)</span>}</td>
                <td><span className="badge active">{u.role}</span></td>
                <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {pwUser === u.username ? (
                    <>
                      <input type="password" placeholder="New password" value={pwValue} onChange={(e) => setPwValue(e.target.value)} style={{ width: 140 }} />
                      <button className="btn small" onClick={() => changePassword(u.username)}>Save</button>
                    </>
                  ) : (
                    <button className="btn secondary small" onClick={() => setPwUser(u.username)}>Change password</button>
                  )}
                  {u.username !== currentUsername && (
                    <button className="btn danger small" onClick={() => deleteUser(u.username)}>Delete</button>
                  )}
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
      <UsersPage />
    </RequireAuth>
  );
}
