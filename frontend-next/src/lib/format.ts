export function money(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : v ?? 0;
  if (Number.isNaN(n)) return '₱0.00';
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Everything the business does happens in Philippine time, whatever the
// viewer's device or the hosting server is set to.
export const PH_TZ = 'Asia/Manila';

// The database stamps rows with its own clock, whatever zone that is. Rather
// than guess, the server tells us what time it thinks it is (server_now at
// login / page load) and we compare it with the real time to learn the offset.
// Until the first reply we use the last offset we learned (or UTC).
let serverOffsetMin = 0;
try {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('medrep_server_offset') : null;
  if (saved !== null && !Number.isNaN(Number(saved))) serverOffsetMin = Number(saved);
} catch { /* ignore */ }

export function setServerClock(serverNow: string | null | undefined): void {
  if (!serverNow) return;
  const asUtc = new Date(String(serverNow).trim().replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(asUtc)) return;
  // Round to the nearest 15 minutes to absorb network delay and small clock drift.
  serverOffsetMin = Math.round((asUtc - Date.now()) / 60000 / 15) * 15;
  try { localStorage.setItem('medrep_server_offset', String(serverOffsetMin)); } catch { /* ignore */ }
}

function offsetString(): string {
  const sign = serverOffsetMin < 0 ? '-' : '+';
  const abs = Math.abs(serverOffsetMin);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** Turn a "YYYY-MM-DD HH:MM:SS" string from the database into a real Date. */
export function parseServerDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  // A plain date has no clock time, so there is nothing to convert.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00Z') : new Date(s.replace(' ', 'T') + offsetString());
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateStr(v: string | null | undefined): string {
  if (!v) return '';
  const d = parseServerDate(v);
  if (!d) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v).trim())) {
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  return d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: PH_TZ });
}

export const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];