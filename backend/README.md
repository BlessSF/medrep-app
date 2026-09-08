# MedRep backend API (PHP)

This is your original PHP/MySQL app's business logic, re-exposed as a
JSON API under `/api/*` so the new React frontend can talk to it. Your
database, tables, and PHP/MySQL hosting stay exactly the same — nothing
here changes your data model.

The original `.php` page files (staff.php, admin.php, customer.php, ...)
are untouched and still work if you want them; the new `/api` folder is
additive.

## Setup

1. Copy this whole `backend/` folder into your PHP host (or XAMPP's `htdocs/medrep-api`).
2. Edit `includes/db_config.php` with your DB host/user/password/database name
   (same 4 values your original `includes/db_config.php` used).
3. Make sure your `employees`, `users`, `logs` tables already exist (same schema
   as before). The `companies` table is auto-created on first request.
4. Visit `http://localhost/medrep-api/api/auth/me.php` — you should get
   `{"success":false,"error":"Not logged in"}` (that means it's wired up).

## CORS / cookies note

The API uses PHP sessions (same as the original app) for auth, and is
configured to accept cross-origin requests **with cookies** from
`http://localhost:5173` (the Vite dev server) — see `includes/api_helpers.php`.
If you deploy the React build to a different origin than the API, add
that origin to the `$allowed_origins` array there.

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/login.php` | POST | `{username,password}` → sets session |
| `/api/auth/logout.php` | POST | destroys session |
| `/api/auth/me.php` | GET | current session user/role |
| `/api/employees/medreps.php` | GET/POST | list medreps w/ balances, or register a new one |
| `/api/employees/list.php` | GET | paginated transaction feed w/ filters |
| `/api/employees/profile.php` | GET | one medrep's full ledger + totals |
| `/api/employees/transaction/add.php` | POST | add deposit/dinein/takeout/giftcard/cashout/interest/transfer |
| `/api/employees/transaction/update.php` | POST | inline edit one field on one row |
| `/api/employees/transaction/delete.php` | POST | delete one row |
| `/api/employees/block.php` / `unblock.php` | POST | block/unblock a medrep |
| `/api/employees/edit.php` | POST | rename medrep / change company |
| `/api/employees/delete_customer.php` | POST | delete all of a medrep's rows |
| `/api/companies/index.php` | GET/POST | list / add / rename / delete companies |
| `/api/users/index.php` | GET/POST | admin-only user management |
| `/api/logs/list.php` | GET | audit trail (admin only) |
| `/api/reports/dashboard.php` | GET | admin dashboard totals |
| `/api/reports/daily.php` | GET | daily sales, grouped by date |
| `/api/reports/monthly.php` | GET | per-medrep aggregate summary |
| `/api/reports/receivables.php` | GET | receivables/payables breakdown |
| `/api/reports/cashout.php` | GET | cashout report + monthly chart data |
| `/api/suggestions.php` | GET | name/company autocomplete |
| `/api/export.php` | GET | CSV or `?format=xlsx` download |

All endpoints (except `auth/login.php`) require a logged-in session and
return `401` JSON if not logged in. Admin-only ones return `403`.
