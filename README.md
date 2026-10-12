# StudentXchange

A three-sided marketplace PWA for university students in Eswatini. Buy and sell **physical items** and **services** with **escrow-protected payments** (DPO Pay / MTN MoMo). Strict **black / white / blue** color scheme. Two portals: combined Seller+Customer app, and a separate MFA-protected Admin portal.

## Quick start

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build
```

**Demo accounts**

| Portal | Email | Password |
|---|---|---|
| Marketplace (dual role) | `naledi@student.sz` | any |
| Marketplace (customer) | `thandi@student.sz` | any |
| Admin (Portal 2) | `admin@student.sz` | any + 6-digit OTP shown on screen |

## Project structure

```
StudentXchange/
├── index.html                  # PWA meta, theme-color #0A3D91
├── vite.config.ts              # Vite + vite-plugin-pwa (manifest, workbox)
├── tailwind.config.js          # Strict black/white/blue palette
├── public/
│   └── icons/                  # SVG + generated 192/512 PNG icons
└── src/
    ├── main.tsx / App.tsx      # Entry + QueryClient
    ├── index.css               # Tailwind layers + component classes
    ├── types/index.ts          # Domain models (Order, EscrowStatus, Category…)
    ├── data/mockData.ts        # Seed users, listings, orders, categories
    ├── lib/
    │   ├── api.ts              # API client (mock — swap for NestJS calls)
    │   └── utils.ts            # SZL formatting, escrow badges, gradients
    ├── stores/                 # Zustand: auth, cart, role switcher
    ├── components/
    │   ├── ui/                 # Icon, Badge, EmptyState, Spinner, StatCard
    │   ├── layout/             # AppShell, BottomNav, Header, RoleSwitcher
    │   └── marketplace/        # ListingCard, CategoryGrid, SearchBar, TypeTabs
    ├── pages/
    │   ├── auth/               # Login, Register
    │   ├── customer/           # Home, ListingDetail, Cart, Checkout, Orders, OrderDetail, Profile
    │   ├── seller/             # Dashboard, Listings, CreateListing, Orders, KYC, Payouts
    │   └── admin/              # Login (MFA), Dashboard, Users, KYC, Categories,
    │                           # Orders, Escrow control, Disputes, Payouts, Settings, Audit
    └── router/index.tsx        # Role-based guards + portal separation
```

## Color system (strict)

| Token | Hex | Use |
|---|---|---|
| Primary (Deep Blue) | `#0A3D91` | Primary buttons, active nav, brand |
| Secondary (Light Blue) | `#3B82F6` | Accents, links |
| Accent (Sky Blue) | `#60A5FA` | Highlights, gradients |
| Background | `#FFFFFF` | App background |
| Surface (Off-White) | `#F8FAFC` | Cards, inputs |
| Text Primary | `#0A0A0A` | Headings, body |
| Text Secondary | `#4B5563` | Captions, metadata |
| Border | `#E5E7EB` | Dividers, card borders |
| Success | `#2563EB` | Success states (blue, not green) |
| Error | `#0A0A0A` | Error states (black on white) |
| Warning | `#9CA3AF` | Warnings (gray, not orange) |

No other colors are used anywhere in the UI.

## Portals & routing

- **Portal 1 — `/`** (combined): one login, role-based views inside. Dual-role users get a Customer/Seller mode switcher on the home screen. Single-role users are pinned to their only view.
- **Portal 2 — `/admin`** (separate): separate login screen, MFA (6-digit OTP) required. Admin-only screens: dashboard, users, KYC, categories, orders, escrow control, disputes, payouts, settings, audit log.

Guards live in `src/router/index.tsx` (`RequireAuth`, `RequireSeller`, `RequireAdmin`).

## Escrow with admin withholding

**Normal flow:** buyer pays → funds held in escrow → seller ships/delivers → buyer confirms receipt → funds release to seller minus 10% commission.

**Admin override:** from `/admin/escrow`, an admin can **withhold** funds at any point (freezing automatic release, with a mandatory reason), then later **release to seller**, **refund buyer**, or **split funds** via a percentage slider. Every action is written to the audit log with timestamp and reason.

Escrow states: `pending_payment`, `held`, `withheld_by_admin`, `released`, `refunded`, `split`, `disputed`.

## Category system

Two separate admin-managed trees (`src/data/mockData.ts`):

- **Physical items:** Electronics, Furniture & Dorm, Clothing & Fashion, Food & Snacks, Beauty & Personal Care, Sports & Fitness, Stationery & Art, Miscellaneous
- **Services:** Tutoring, Printing & Design, Laundry & Cleaning, Moving & Delivery, Tech Repair, Beauty Services, Event Services, Hostel & Room Services, Miscellaneous Services

Each listing belongs to exactly one leaf category. Physical items have stock + condition; services have duration + availability slots.

## Install on Android (PWA)

1. Deploy `dist/` to a public HTTPS URL (see deployment below).
2. Open the URL in **Chrome on Android**.
3. Tap the **three-dot menu** → **"Add to Home screen"** (or **"Install app"**).
4. Confirm — the app installs with its own icon and opens in **standalone mode** (no browser chrome).

The PWA is installable because it ships a valid `manifest.webmanifest`, a service worker (`sw.js`), and 192px + 512px icons.

## Build an APK (optional)

### Option A — Bubblewrap (recommended, no Android Studio)

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://your-domain.com/manifest.webmanifest
bubblewrap build
# Output: app-release-signed.apk — transfer to your phone and install
```

### Option B — Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "StudentXchange" "com.studentxchange.app" --web-dir=dist
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

Transfer the APK to your phone, open it in the Files app, and allow installation from unknown sources when prompted.

## Deploy (Vercel / Netlify)

### Vercel

```bash
npm install -g vercel
vercel          # follow prompts — framework preset: Vite
vercel --prod   # production deploy
```

Or push to GitHub and import the repo in the Vercel dashboard — it auto-detects Vite.

### Netlify

```bash
npm install -g netlify-cli
netlify deploy --dir=dist --prod
```

Or drag the `dist/` folder into [app.netlify.com/drop](https://app.netlify.com/drop).

> **HTTPS is required** for PWA installability and service workers. Both Vercel and Netlify provide free automatic HTTPS.

## Backend integration (reference stack)

The app is frontend-complete with an in-memory mock API (`src/lib/api.ts`). To connect the reference backend (Node.js + NestJS + PostgreSQL + Prisma + Redis):

1. Replace the mock functions in `src/lib/api.ts` with `fetch()` calls to your API base URL.
2. Move auth tokens into `Authorization: Bearer` headers (the auth store already persists a token).
3. Wire DPO Pay and MTN MoMo webhooks to update `escrowStatus` server-side.
4. Keep the admin escrow endpoints (`/admin/escrow/withhold|release|refund|split`) server-authoritative — the UI already calls them as mutations.

## Tech stack

- **Vite 5** + **React 18** + **TypeScript**
- **Tailwind CSS 3** (custom black/white/blue theme)
- **React Router 6** (role-based routes, portal separation)
- **TanStack Query 5** (data fetching)
- **Zustand** (auth, cart, role switcher)
- **vite-plugin-pwa** (Android installability, service worker, offline cache)
