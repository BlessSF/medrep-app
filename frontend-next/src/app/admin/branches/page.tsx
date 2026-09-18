'use client';

import { useEffect, useState, useRef, type FormEvent } from 'react';
import Layout from '../../../components/Layout';
import RequireAuth from '../../../components/RequireAuth';
import { Modal, Banner } from '../../../components/ui';
import { IconTrash } from '../../../components/icons';
import { useAuth } from '../../../context/AuthContext';
import api, { ApiError } from '../../../api/client';

export interface BranchSettings {
  color: string;   // hex, used as sidebar accent + brand primary
  image: string;   // data-URL or public path
}

const DEFAULT_COLORS = [
  '#1b4332', '#c0392b', '#1a3a5c', '#6b3fa0',
  '#b8540a', '#1a5c4a', '#7c3d00', '#2c4a1a',
];

function loadSettings(): Record<string, BranchSettings> {
  try { return JSON.parse(localStorage.getItem('branch_settings') || '{}'); } catch { return {}; }
}
function saveSettings(s: Record<string, BranchSettings>) {
  localStorage.setItem('branch_settings', JSON.stringify(s));
  // Notify other components
  window.dispatchEvent(new Event('branch_settings_changed'));
}

function BranchesPage() {
  const { branch: currentBranch } = useAuth();
  const [branches, setBranches] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editBranch, setEditBranch] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, BranchSettings>>({});
  const [form, setForm] = useState({ name: '', admin_username: '', admin_password: '' });
  const [editForm, setEditForm] = useState<BranchSettings>({ color: '#1b4332', image: '' });
  const [msg, setMsg] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await api.get('/branches/list.php');
    setBranches(r.branches);
  }

  useEffect(() => {
    load();
    setSettings(loadSettings());
  }, []);

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

  function openEdit(name: string) {
    const s = settings[name] ?? { color: '#1b4332', image: '' };
    setEditForm({ ...s });
    setEditBranch(name);
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEditForm((f) => ({ ...f, image: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  }

  function saveEdit() {
    if (!editBranch) return;
    const next = { ...settings, [editBranch]: editForm };
    setSettings(next);
    saveSettings(next);
    setEditBranch(null);
    setMsg({ text: `Settings saved for ${editBranch}.`, kind: 'success' });
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Theme</th>
              <th style={{ width: 1, whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => {
              const s = settings[b];
              return (
                <tr key={b}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Branch avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, overflow: 'hidden',
                        background: s?.color ?? '#1b4332', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                      }}>
                        {s?.image
                          ? <img src={s.image} alt={b} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{b[0]}</span>
                        }
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{b}</div>
                        {b === currentBranch && <span className="badge active">Current</span>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 5,
                        background: s?.color ?? '#1b4332',
                        border: '1.5px solid rgba(0,0,0,0.1)',
                        flexShrink: 0,
                      }} />
                      <span className="muted" style={{ fontSize: 12 }}>
                        {s?.color ?? 'Default'}
                      </span>
                      {s?.image && (
                        <span style={{ fontSize: 11, color: '#4e9669', fontWeight: 600 }}>
                          ✓ Photo set
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="actions-cell">
                    <div className="action-group">
                      <button
                        className="btn small secondary"
                        onClick={() => openEdit(b)}
                        title={`Customize ${b}`}
                      >
                        ✎ Customize
                      </button>
                      <button
                        className="icon-btn danger"
                        title={b === currentBranch ? "Can't delete the branch you're signed in to" : `Delete ${b}`}
                        disabled={b === currentBranch}
                        onClick={() => handleDelete(b)}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New branch modal */}
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

      {/* Customize branch modal */}
      {editBranch && (
        <Modal title={`Customize — ${editBranch}`} onClose={() => setEditBranch(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Color picker */}
            <div className="field">
              <label>Brand color</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, color: c }))}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: c, border: editForm.color === c ? '3px solid #fff' : '2px solid transparent',
                      outline: editForm.color === c ? '2px solid ' + c : 'none',
                      cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="color"
                  value={editForm.color}
                  onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                  style={{ width: 42, height: 36, padding: 2, border: '1.5px solid #d4ceba', borderRadius: 8, cursor: 'pointer' }}
                />
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#6a6255' }}>{editForm.color}</span>
              </div>
            </div>

            {/* Image upload */}
            <div className="field">
              <label>Branch hero photo</label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '2px dashed #d4ceba', borderRadius: 12,
                  padding: 20, textAlign: 'center', cursor: 'pointer',
                  background: '#faf8f2', transition: 'border-color 0.12s',
                  position: 'relative', overflow: 'hidden',
                  minHeight: editForm.image ? 140 : 80,
                }}
              >
                {editForm.image ? (
                  <>
                    <img
                      src={editForm.image}
                      alt="preview"
                      style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 12, opacity: 0,
                      transition: 'opacity 0.15s',
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Click to change</span>
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#9a9183', fontSize: 13 }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>🖼</div>
                    Click to upload a photo
                    <div style={{ fontSize: 11, marginTop: 4, color: '#b8b0a3' }}>JPG, PNG — shown on the login page</div>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageFile}
                />
              </div>
              {editForm.image && (
                <button
                  type="button"
                  className="btn danger small"
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                  onClick={() => setEditForm((f) => ({ ...f, image: '' }))}
                >
                  Remove photo
                </button>
              )}
            </div>

            {/* Preview */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6255', display: 'block', marginBottom: 8 }}>Preview</label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: editForm.color, borderRadius: 12,
                padding: '12px 16px', color: '#fff',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, overflow: 'hidden',
                  background: 'rgba(255,255,255,0.15)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {editForm.image
                    ? <img src={editForm.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontWeight: 800, fontSize: 18 }}>{editBranch[0]}</span>
                  }
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>MEDREP</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{editBranch}</div>
                </div>
              </div>
            </div>

            <button className="btn" type="button" onClick={saveEdit}>
              Save settings
            </button>
          </div>
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