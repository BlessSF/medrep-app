'use client';

import { useState, type KeyboardEvent } from 'react';

export function Banner({ message, kind }: { message: string; kind: 'success' | 'error' }) {
  if (!message) return null;
  return <div className={`banner ${kind}`}>{message}</div>;
}

export function StatCard({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className={'stat-card' + (negative ? ' negative' : '')}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export function EditableCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function commit() {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        style={{ width: '100%', padding: '2px 4px' }}
      />
    );
  }

  return (
    <span className="editable-cell" onClick={() => setEditing(true)} title="Click to edit">
      {value || <span className="muted">—</span>}
    </span>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,42,31,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div className="card" style={{ width: 420, maxWidth: '92vw', maxHeight: '86vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2>{title}</h2>
          <button className="btn secondary small" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
