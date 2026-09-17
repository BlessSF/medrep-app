export function money(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : v ?? 0;
  if (Number.isNaN(n)) return '₱0.00';
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dateStr(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
