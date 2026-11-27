'use client';

import { useState, type FormEvent } from 'react';
import { Modal } from './ui';

export type BulkField = 'date_given' | 'customer_name' | 'redeemed_by' | 'payment_mode' | 'remarks' | 'date_availed' | 'note';
export type BulkChanges = Partial<Record<BulkField, string>>;
type RowValues = Partial<Record<BulkField, string | null>>;

// Must match MAX_BULK in backend/api/vouchers/index.php.
export const MAX_BULK = 1000;

// "1-50, 75, 80-90" -> [1..50, 75, 80..90]
export function parseSeries(text: string, max: number): { list: number[] } | { error: string } {
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { error: 'Type series numbers, e.g. 1-50, 75' };
  const found = new Set<number>();
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:\s*(?:-|–|to)\s*(\d+))?$/i);
    if (!m) return { error: `“${part}” isn’t a number or range. Try 1-50, 75` };
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    if (lo < 1 || hi > max) return { error: `Series numbers go from 1 to ${max.toLocaleString()}.` };
    for (let n = lo; n <= hi; n++) found.add(n);
  }
  return { list: [...found].sort((a, b) => a - b) };
}

// [1,2,3,7] -> "0001–0003, 0007"
export function describeSeries(list: number[], pad: number, maxGroups = 4): string {
  const label = (n: number) => String(n).padStart(pad, '0');
  const groups: string[] = [];
  for (let i = 0; i < list.length; i++) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    groups.push(i === j ? label(list[i]) : `${label(list[i])}–${label(list[j])}`);
    i = j;
  }
  return groups.length > maxGroups
    ? `${groups.slice(0, maxGroups).join(', ')} +${groups.length - maxGroups} more`
    : groups.join(', ');
}

export function BulkFillModal({ rows, label, paymentModes, remarks, saving, onApply, onClose }: {
  rows: RowValues[];
  label: string;
  paymentModes: string[];
  remarks: string[];
  saving: boolean;
  onApply: (changes: BulkChanges, onlyEmpty: boolean) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<BulkChanges>({});
  const [onlyEmpty, setOnlyEmpty] = useState(true);

  const set = (key: BulkField, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const changes = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ''),
  ) as BulkChanges;
  const entries = Object.entries(changes) as [BulkField, string][];

  // Preview: how many rows will change, and how many already hold something different.
  let willChange = 0;
  let conflicts = 0;
  for (const row of rows) {
    const current = entries.map(([k, v]) => ({ old: (row[k] || '').trim(), next: v }));
    if (current.some((c) => c.old !== c.next && (!onlyEmpty || c.old === ''))) willChange++;
    if (current.some((c) => c.old !== '' && c.old !== c.next)) conflicts++;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (willChange > 0 && !saving) onApply(changes, onlyEmpty);
  }

  const text = (key: BulkField, title: string, placeholder: string, max: number) => (
    <div className="field"><label htmlFor={'bulk-' + key}>{title}</label>
      <input id={'bulk-' + key} value={values[key] || ''} maxLength={max} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} /></div>
  );
  const date = (key: BulkField, title: string) => (
    <div className="field"><label htmlFor={'bulk-' + key}>{title}</label>
      <input id={'bulk-' + key} type="date" value={values[key] || ''} onChange={(e) => set(key, e.target.value)} /></div>
  );
  const choice = (key: BulkField, title: string, options: string[]) => (
    <div className="field"><label htmlFor={'bulk-' + key}>{title}</label>
      <select id={'bulk-' + key} value={values[key] || ''} onChange={(e) => set(key, e.target.value)}>
        <option value="">No change</option>{options.map((o) => <option key={o}>{o}</option>)}
      </select></div>
  );

  return (
    <Modal title={`Fill ${rows.length.toLocaleString()} ${rows.length === 1 ? 'voucher' : 'vouchers'}`} onClose={() => { if (!saving) onClose(); }}>
      <form onSubmit={submit} className="vm-bulk-form">
        <p className="vm-bulk-sub">Series <b>{label}</b>. Anything you leave blank stays as it is.</p>

        <div className="vm-bulk-grid">
          {date('date_given', 'Date given')}
          {text('customer_name', 'Customer name', 'No change', 255)}
          {text('redeemed_by', 'Redeemed by', 'No change', 255)}
          {choice('payment_mode', 'Payment', paymentModes)}
          {choice('remarks', 'Remarks', remarks)}
          {date('date_availed', 'Date availed')}
          <div className="vm-bulk-wide">{text('note', 'Note (c/o Acctng)', 'No change', 500)}</div>
        </div>

        <label className="vm-bulk-opt">
          <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />
          <span>Only fill empty cells (keep data that’s already there)</span>
        </label>

        {entries.length > 0 && (
          <div className={'vm-bulk-preview' + (conflicts > 0 && !onlyEmpty ? ' warn' : '')} aria-live="polite">
            <b>{willChange.toLocaleString()}</b> of {rows.length.toLocaleString()} rows will change.
            {conflicts > 0 && (onlyEmpty
              ? ` ${conflicts.toLocaleString()} already have different data, which will be kept.`
              : ` Existing data in ${conflicts.toLocaleString()} rows will be replaced.`)}
          </div>
        )}

        <div className="vm-bulk-actions">
          <button type="button" className="vm-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="vm-btn solid" disabled={saving || willChange === 0}>
            {saving ? 'Saving…' : willChange > 0 ? `Apply to ${willChange.toLocaleString()} ${willChange === 1 ? 'row' : 'rows'}` : 'Apply'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
