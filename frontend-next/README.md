# MedRep — Next.js frontend

Same app as the Vite/React version, rebuilt on Next.js (App Router) —
same pages, same PHP API backend, same CSS. Data-fetching pages are
client components (`'use client'`) since auth is a PHP session cookie
checked in the browser, matching how the original app worked.

## Setup
```
npm install
npm run dev
```
Edit `.env.local` if your PHP API isn't at `http://localhost/medrep-api/api`.

## Routes
- `/login`
- `/staff` — cashier's daily transaction screen
- `/admin` — dashboard
- `/admin/customers`, `/admin/customers/[name]` — customer list + ledger
- `/admin/companies`, `/admin/users`, `/admin/tracking`
- `/admin/daily`, `/admin/monthly`, `/admin/receivables`, `/admin/cashout`

## Production
```
npm run build
npm start
```
Or deploy to Vercel / any Node host — it just needs to reach the PHP API over HTTPS with CORS configured for your deployed origin (see `backend/includes/api_helpers.php`'s `$allowed_origins`).
