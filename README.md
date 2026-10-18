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
4. Run `npm run db:migrate`, then `npm run db:seed`. The ignored `server/.env` contains the local admin bootstrap credentials.
5. Start the API with `npm run api:dev` and the Vite app with `npm run dev` in another terminal.

The Vite dev server proxies `/api` to `http://localhost:3000`. Vercel rewrites `/api/*` to the Express function. The production API function reads `DATABASE_URL`, `JWT_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` from server-side Vercel variables; browser variables must never contain database credentials.

## Routes

- `/` marketplace with physical item and service tabs
- `/admin` separate administrator portal
- `GET /api/health`, `/api/categories`, `/api/listings`
- `POST /api/auth/register`, `/api/auth/login`
- `POST /api/listings`, `/api/orders`, `GET /api/orders`
- Admin escrow review and manual hold/release APIs
- Seller verification, listing edit/removal, receipt confirmation and disputes
- Admin category, KYC, dispute-resolution and payout queues
- DPO Pay / MTN MoMo checkout stubs and authenticated webhook handlers

Payment callbacks and DPO Pay / MTN MoMo transactions require provider credentials and webhook verification before handling real money. No payment provider secrets belong in browser variables.
