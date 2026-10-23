# StudentXchange

A clean, campus-first marketplace for students in Eswatini. The app has a combined customer/seller portal, a separate admin route, distinct item and service categories, and manual escrow controls.

## Stack

- Vite, React, TypeScript, Tailwind CSS, React Router, TanStack Query
- Node.js 20+, Express, TypeScript, `tsx`
- Neon Postgres via `pg`
- Vercel for the existing linked production project

## Local setup

1. Install Node.js 20 LTS or later.
2. Install packages in the project root: `npm install`
3. Keep the existing Neon URL in `server/.env` as `DATABASE_URL` (never prefix it with `VITE_`). Set a random `JWT_SECRET` of at least 32 characters.
4. `npm run db:migrate` validates the existing Prisma `public` schema without changing it. Apply additive feature migrations with `npm --prefix server run migrate:admin-controls`, `npm --prefix server run migrate:email-verification`, `npm --prefix server run migrate:dpo-checkout`, `npm --prefix server run migrate:payout-reference`, and `npm --prefix server run migrate:payments-engine`. The email migration marks existing administrators as needing verification; ordinary accounts remain usable. Run `npm run db:seed` to add any missing categories and create or update the admin account; ordinary users and existing categories are preserved.
5. Start the API with `npm run api:dev` and the Vite app with `npm run dev` in another terminal.

The Vite dev server proxies `/api` to `http://localhost:3000`. Vercel rewrites `/api/*` to the Express function. The production API function reads `DATABASE_URL`, `JWT_SECRET`, `DPO_COMPANY_TOKEN`, `DPO_SERVICE_TYPE`, `FRONTEND_URL`, and `API_BASE_URL` from server-side Vercel variables; browser variables must never contain database credentials or provider secrets. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are only needed for local seed/reset commands. The API uses the existing Prisma tables and enums in Neon `public`; it does not use the older `sx_*` tables.

## Administrator email verification

Customer and seller accounts can register and sign in without email verification. New administrators, and administrators whose password is reset, must verify their email before signing in. Verification links and confirmation messages use the Resend SDK. For local work, copy `server/.env.example` to `server/.env.local`, set `RESEND_API_KEY`, and use `EMAIL_FROM=onboarding@resend.dev` only for testing; set `API_BASE_URL=http://localhost:3000` and `FRONTEND_URL=http://localhost:5173`. In Vercel, set `RESEND_API_KEY`, `EMAIL_FROM`, `API_BASE_URL=https://studentxchange.vercel.app`, and `FRONTEND_URL=https://studentxchange.vercel.app` as server-side variables. Use a sender domain verified in Resend in production. Verification tokens are stored as hashes and expire after 15 minutes; each token is single-use. After an admin password reset, use the login form's “Resend verification email” action, then open the API verification link before signing in. Do not prefix mail credentials with `VITE_`.


## Reset the admin password

Admin passwords cannot be recovered from Neon because only a password hash is stored. The admin login reads from the Prisma `users` table (the legacy `sx_users` table is not used). To reset the account, run this from the `server/` directory on a machine with the linked Neon `DATABASE_URL` in `server/.env`:

```powershell
  $env:ADMIN_EMAIL = " "
  $secure = Read-Host "New admin password (12+ characters)" -AsSecureString
  $env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $secure).Password
  $env:CONFIRM_ADMIN_PASSWORD_RESET = "YES"
  npm run admin:reset
```

The command updates the existing account's password hash, ensures it has the admin role, activates it, and requires email verification again. It never prints the password and does not require a Vercel environment variable or a deployment. After it completes, request a verification email from the login form and verify the address before signing in. Do not commit or paste the password into project files or browser environment variables.

## Routes

- `/` marketplace with physical item and service tabs
- `/orders` customer orders and receipt/dispute actions
- `/seller` seller verification, listing controls and orders
- `/admin` separate administrator portal
- `GET /api/health`, `/api/categories`, `/api/listings`
- `POST /api/auth/register`, `/api/auth/login`
- `POST /api/listings`, `/api/orders`, `GET /api/orders`
- Admin escrow review and manual hold/release APIs
- Seller verification, listing edit/removal, receipt confirmation and disputes
- Admin category, KYC, dispute-resolution and payout queues
- DPO Pay hosted checkout, server-side payment verification and refunds
- MTN MoMo Collections requests, verified callback/status polling, and optional Disbursements payouts
- Escrow ledger, dispute resolution, delivery tracking and scheduled auto-release

The DPO Pay v6 route creates a hosted checkout token, redirects buyers to DPO, and verifies payments with DPO before marking an order paid. Set `DPO_COMPANY_TOKEN` and `DPO_SERVICE_TYPE` in server variables, then apply the DPO checkout and payments-engine migrations. Configure DPO's push callback in the merchant portal to `https://<your-api-host>/api/payments/dpo/webhook`; the buyer redirect alone is not treated as payment proof. Confirm that your merchant account supports `SZL` and the intended Eswatini payment methods before production.

MTN MoMo uses the updated MoMo API host and credentials. Set the Collections subscription key for payments, the Disbursements subscription key for payouts, your User ID and Credential Token, and the correct `MTN_TARGET_ENVIRONMENT` (`sandbox` while testing; use the Eswatini value issued for your production partner account). Buyers approve a request on their phone; callbacks are acknowledged only after the backend checks MTN's status endpoint. Buyers can also poll payment status from My orders. Seller payouts remain queued unless `MTN_AUTO_PAYOUT=true` and the Disbursements credentials are configured. Keep it false until MTN has enabled and you have tested the merchant account.

Payments-engine migration creates the idempotent escrow ledger, records existing held balances, adds MoMo references and delivery timestamps, and adds the `SPLIT` escrow state. Escrow is an application ledger: it records platform obligations but cannot itself segregate or custody money in a bank account. Actual card refunds require DPO's refund API; MoMo buyer refunds are deliberately left for merchant-side handling until an approved refund/reversal flow is configured. Do not mark a MoMo-funded dispute refunded before the merchant has completed the transfer/reversal.

Orders move to held after verified payment. Sellers mark delivery, then buyers can confirm receipt to release the seller's net amount into the payout queue; otherwise the scheduled job releases after 72 hours if no open dispute exists. Neon Function Triggers invoke the job hourly, and the Vercel API route accepts only the Vercel cron secret or the separate `NEON_TRIGGER_SECRET` shared with the Neon function. No payment-provider credentials belong in browser variables.
