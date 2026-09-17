# MedRep — Next.js frontend + PHP API backend

Your original app (`medrep/`, 34 PHP page-files) rebuilt as:
- **`backend/`** — your same PHP + MySQL logic, exposed as a JSON API under `/api/*`. Your database is untouched.
- **`frontend-next/`** — the React frontend rebuilt on **Next.js** (App Router + TypeScript), talking to that same API.
- **`frontend/`** — the original plain Vite/React version, kept in case you want it instead. Both point at the same backend; use whichever one you keep.

Every feature from the original app is covered: login, cashier's daily-transaction screen, admin dashboard, customer list + profile/ledger (inline editing), companies, users, tracking/audit log, daily sales, sales reports, receivables/payables breakdown, cashout report + chart, CSV/Excel export.

## Quick start

**1. Backend** — put `backend/` on your PHP host, edit `backend/includes/db_config.php` with your DB credentials. See `backend/README.md`.

**2. Frontend (Next.js):**
```
cd frontend-next
npm install
npm run dev
```
Edit `frontend-next/.env.local` if your API isn't at `http://localhost/medrep-api/api`. Open `http://localhost:3000` and log in with an existing user.

## Tested

Same as before: real MySQL + PHP server in the sandbox, full API smoke test (login, transactions, balances, block/unblock, edit, delete, all reports, users, export). For the Next.js app specifically: clean `tsc` typecheck, clean `next build` (all 14 routes compiled — 13 static, 1 dynamic for `/admin/customers/[name]`), and every route verified to return 200 with no server errors against the live PHP backend.

## Note carried over from before

The original balance formula double-counts `receiver_amount` for a medrep who *receives* a transfer. Ported exactly as-is (see `backend/includes/api_helpers.php`'s `compute_balance()`) — flagging it in case you want it corrected.
