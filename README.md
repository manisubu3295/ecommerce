# Barani's Couture — cinematic vintage fashion store

A complete React + Tailwind (Vite) e-commerce storefront: multi-page routing, a
product catalog with detail pages, a theme configurator (90s Cinema / Neo Noir /
Essentials / Rust & Relic presets), a size-aware persistent cart, real Razorpay
checkout with a local-only demo fallback, transactional email, and full on-page
SEO + structured data (see "SEO & GEO" below).

```
site/
├── index.html            Vite entry + baseline meta/OG/JSON-LD (pre-hydration)
├── public/
│   ├── robots.txt         crawler rules + sitemap reference
│   ├── sitemap.xml        canonical URLs for every route
│   ├── llms.txt           plain-text brand/catalog summary for AI answer engines
│   └── _redirects         Netlify SPA fallback (all routes -> index.html)
├── src/
│   ├── main.jsx           HelmetProvider + BrowserRouter + Catalog/Theme/Cart/Admin providers
│   ├── App.jsx            layout: top bar, nav, <Routes>, footer, drawers
│   ├── context/           CatalogContext (products/categories/settings from the API),
│   │                      ThemeContext (active theme, persisted via admin settings),
│   │                      CartContext (cart, persisted to localStorage), AdminAuthContext
│   ├── data/              siteConfig.js, themePresets.js, products.js (catalog)
│   ├── lib/                jsonld.js (structured data), pricing.js (shared subtotal/tax/
│   │                       shipping math used by both client and server)
│   ├── hooks/              useModalBehavior.js (Esc-to-close + scroll lock for overlays)
│   ├── components/        Nav, Footer, ProductCard, CartDrawer, CheckoutModal, ThemeAdminPanel, Seo, ScrollToTop
│   └── pages/              Home, Shop, ProductDetail, About, FAQ, Contact, OrderSuccess, TrackOrder, Admin, NotFound
├── server/
│   ├── index.js            Express + PostgreSQL API (catalog, checkout, admin, webhooks)
│   └── lib/mailer.js       SMTP transactional email (no-ops if unconfigured)
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── package.json
```

## Run it

```bash
cd site
npm install
npm run dev        # http://localhost:5173
npm run server     # PostgreSQL API on http://localhost:8787
npm run dev:full   # run Vite and the API together
npm run build      # production build to dist/
npm run preview    # preview the production build
npm test           # runs src/**/*.test.js with Node's built-in test runner
```

### PostgreSQL setup

Create a database and copy `.env.example` to `.env`, then set `DATABASE_URL` to
your PostgreSQL connection string, for example:

```text
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/baraniscouture
```

The API creates its tables and seeds the initial catalog on first startup. The
database user must have permission to create tables in `baraniscouture`.

## Checkout and admin

Checkout is a two-step, server-authoritative flow (`POST /api/checkout/init` then
`POST /api/checkout/:id/confirm`):

1. **Init** validates the cart against the database (price, stock/size) inside a
   transaction with row locks, reserves stock, generates the order id and access
   token server-side, and persists the order as `pending_payment` **before** any
   payment UI opens — so a dropped connection or closed tab never loses an order
   that was actually charged. If Razorpay keys are configured it also creates the
   gateway order; abandoned `pending_payment` orders release their reserved stock
   automatically after 30 minutes.
2. **Confirm** verifies the Razorpay payment signature server-side against the
   order it created (never a client-supplied value) and marks the order `processing`.

Live payment requires `VITE_RAZORPAY_KEY_ID` (browser) plus `RAZORPAY_KEY_ID` and
`RAZORPAY_KEY_SECRET` (server) with matching Test Mode credentials. Without them,
checkout returns `503` **unless** you explicitly set `ALLOW_DEMO_CHECKOUT=true` for
local development — this is off by default (and always off when
`NODE_ENV=production`) so a forgotten env var can never accept an unpaid order.

Order totals (`src/lib/pricing.js`) include optional tax and shipping, configured
once in `SITE_CONFIG.tax` / `SITE_CONFIG.shippingFee` / `SITE_CONFIG.freeShippingThreshold`
(`src/data/siteConfig.js`) — both default to 0, so nothing changes until you set
real figures for the business.

The `/admin` route is protected by the PostgreSQL-backed admin session API. Products,
orders, contact messages, and settings are stored in PostgreSQL. Order data (which
includes customer PII) is only ever held in React state in the admin's browser, never
cached to `localStorage`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before
deployment. The theme configurator is also hidden unless the server session is
authenticated, and the selected theme is saved to the server so every visitor sees it
(not just the admin's own browser).

Order operations live in the authenticated admin workspace:

- **Orders & shipping** manages carrier, tracking number, tracking URL, fulfillment status, invoice printing, and per-item states (`pending`, `packed`, `shipped`, `delivered`, `returned`).
- **Returns & refunds** reviews customer requests submitted from the order confirmation page and approves or rejects them before manual gateway action.
- **Refund execution** attempts the Razorpay refund automatically after admin approval when `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and the verified payment ID are present; otherwise it marks the request `manual_required`.
- **Invoices** are generated from the persisted order payload and can be printed from the order workflow panel. Replace the browser print handler with a server PDF renderer for production tax invoices.
- **Messages** lists contact-form submissions (`POST /api/contact`) so they're not lost.
- **Courier integration** currently stores provider-neutral tracking fields. Connect `PATCH /api/admin/orders/:id` to a courier adapter or webhook consumer to automatically update status and tracking URLs from India Post, DHL, FedEx, or another provider.
- **Courier webhooks** can POST signed updates to `/api/webhooks/courier` using `x-courier-webhook-secret` and `COURIER_WEBHOOK_SECRET`.

### Transactional email

`server/lib/mailer.js` sends order confirmation, shipping, and return/refund-decision
emails via SMTP. Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (and optionally `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_FROM`) in `.env`. If they're unset, sending is skipped with a
one-time console log — nothing breaks, emails just don't go out.

### Inventory

Products track availability with a simple `inStock` boolean by default. Set a
numeric `stockQty` on a product (via the catalog editor) to have the server track
and atomically decrement real unit counts at checkout instead, preventing oversell
under concurrent orders.

## Pages / routes

| Route | Purpose |
|---|---|
| `/` | Hero + featured products |
| `/shop` | Full catalog, category filter, `?q=` search |
| `/product/:slug` | Product detail: gallery, sizes, reviews, related items |
| `/about` | Brand story |
| `/faq` | Shipping/returns/sizing, rendered with `FAQPage` schema |
| `/contact` | Support contact form (posts to `/api/contact`) |
| `/order-success` | Post-checkout confirmation + return/refund request (noindex) |
| `/track-order` | Look up past orders by email + mobile number |
| `/admin` | Authenticated operations workspace (noindex) |
| `*` | 404 (noindex) |

## SEO & GEO

- **Per-page SEO** (`src/components/Seo.jsx`, powered by `react-helmet-async`):
  unique `<title>`, meta description, canonical URL, Open Graph + Twitter cards
  on every route.
- **Structured data** (`src/lib/jsonld.js`): `Organization` + `WebSite` on the
  homepage, `Product`+`Offer`+`AggregateRating` on product pages, `BreadcrumbList`
  everywhere, `ItemList` on catalog pages, `FAQPage` on `/faq`.
- **Geo-targeting**: `SITE_CONFIG.shipsTo` (in `src/data/siteConfig.js`) is the
  single source of truth for which regions the store ships to — it feeds the
  footer copy, product `Offer.eligibleRegion`, and the FAQ answer, so it only
  needs to be updated in one place.
- **GEO (generative engine optimization)**: `public/llms.txt` gives AI answer
  engines / LLM crawlers a concise, factual summary of the catalog, policies and
  routes, separate from human-facing marketing copy.
- **Crawl infra**: `public/robots.txt`, a dynamic `/sitemap.xml` served by the
  API from live data, and `public/_redirects` so a static host serves
  `index.html` for deep links like `/product/matrix-trench-coat`.
- **Domain**: the live site is `https://baraniscouture.com`. It is the default
  in `src/data/siteConfig.js` and `npm run build`, and is written into the
  static files (`index.html`, `robots.txt`, `llms.txt`). `www.` requests are
  301-redirected to the apex by the server in production.

## Deploy

### Option A — one Node host (simplest)

On a VPS / Render / Railway / Fly.io with PostgreSQL available:

```bash
npm ci
npm run build                     # writes dist/ for https://baraniscouture.com
NODE_ENV=production npm run server
```

When `dist/` exists the API server also serves the storefront (hashed assets
cached for a year, SPA fallback to `index.html`), so one process serves
`/`, `/api`, `/media` and `/sitemap.xml`. Point DNS for `baraniscouture.com`
and `www.baraniscouture.com` at it, terminate HTTPS at the platform or Nginx,
and set `TRUST_PROXY=true`.

Required production environment (see `.env.example`):
`NODE_ENV=production`, `PUBLIC_SITE_URL=https://baraniscouture.com`,
`DATABASE_URL` (plus `DATABASE_SSL=false` if Postgres has no TLS),
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, live `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
and `VITE_RAZORPAY_KEY_ID` (build time), `COURIER_WEBHOOK_SECRET`, and the
`SMTP_*` settings so order emails send from `@baraniscouture.com`.

### Option B — static frontend + separate API

Upload `dist/` to Netlify / Cloudflare Pages and run the API elsewhere, with
`/api`, `/media` and `/sitemap.xml` proxied to it. `vite.config.js`'s dev proxy
shows the routes that must reach the API.

## Notes

- Product/hero images are hotlinked from Unsplash — replace with real product
  photography (and update `sitemap.xml`/`llms.txt`) before launch.
- This is a client-rendered SPA (no SSR). Googlebot renders JS and will see the
  Helmet-injected tags, but for maximum SEO robustness (fastest indexing, social
  crawlers that don't run JS) consider migrating to a server-rendered framework
  (Next.js/Remix) later — the routing/SEO/data layers here would port over almost
  unchanged.
- The hero animation and all CSS transitions freeze under "reduce motion"
  (`src/index.css`).
- Keyboard focus is visible throughout; the cart drawer and checkout modal close
  on `Esc` (`src/hooks/useModalBehavior.js`) and lock background scroll while open.
- Fonts load from Google Fonts with system fallbacks; self-host later if you want
  zero third-party requests.
