import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import pg from 'pg';
import { PRODUCTS } from '../src/data/products.js';
import { SITE_CONFIG } from '../src/data/siteConfig.js';
import { CITIES } from '../src/data/locations.js';
import { calculateOrderTotals } from '../src/lib/pricing.js';
import { creditNoteTax, financialYear, formatInvoiceNumber, renderCreditNoteHtml, renderInvoiceHtml } from '../src/lib/invoice.js';
import { COUNTRIES, formatAddress, phoneCandidates, stateCode, validateAddress, validateBusinessSettings } from '../src/lib/address.js';
import { normalizeWhatsAppNumber } from '../src/lib/whatsapp.js';
import { validatePolicySettings } from '../src/lib/policies.js';
import { serviceList, validateServices } from '../src/lib/services.js';

// Countries checkout accepts: the ones the store ships to that have address rules.
const SHIP_COUNTRIES = SITE_CONFIG.shipsTo.map((region) => region.code).filter((code) => COUNTRIES[code]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Saved addresses created before country codes were stored say "India".
const countryCodeOf = (value) => (COUNTRIES[value] ? value : Object.keys(COUNTRIES).find((code) => COUNTRIES[code].name === value) || 'IN');
const firstError = (errors) => Object.values(errors)[0];
import { isEmailConfigured, sendMail } from './lib/mailer.js';
import { TEMP_PASSWORD_TTL_HOURS, generateTempPassword } from './lib/tempPassword.js';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 8787);
const cookieName = 'baraniscouture_admin_session';
const customerCookieName = 'baraniscouture_customer_session';
const isProduction = process.env.NODE_ENV === 'production';
// Payment verification is REQUIRED by default. Demo checkout (no real
// payment gateway) only runs when this is explicitly turned on, and never in
// production even if someone sets it — this removes the old footgun where
// simply forgetting to set NODE_ENV=production silently accepted unpaid orders.
const allowDemoCheckout = !isProduction && process.env.ALLOW_DEMO_CHECKOUT === 'true';
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/baraniscouture';
// Managed Postgres (Render, Neon, RDS…) needs TLS; a database on the same
// machine usually has none, so DATABASE_SSL=false opts out.
const databaseSsl = process.env.DATABASE_SSL ? process.env.DATABASE_SSL === 'true' : isProduction;
const pool = new Pool({ connectionString: databaseUrl, max: 10, ssl: databaseSsl ? { rejectUnauthorized: false } : undefined });

if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Canonical host: send www.baraniscouture.com (and any other alias) to the
// apex domain so search engines index one URL per page.
const canonicalHost = new URL(SITE_CONFIG.siteUrl).host;
if (isProduction) {
  app.use((req, res, next) => {
    const host = req.headers.host;
    if (host && host !== canonicalHost && host.replace(/^www\./, '') === canonicalHost) {
      return res.redirect(301, `${SITE_CONFIG.siteUrl}${req.originalUrl}`);
    }
    next();
  });
}

const mediaDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'media');
fs.mkdirSync(mediaDirectory, { recursive: true });

// Extension is derived from the SNIFFED mimetype we allow, never from the
// client-supplied filename — otherwise an attacker can upload `evil.html`
// declared as `image/png` and have it served back as HTML from our origin.
const MEDIA_TYPE_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};
const mediaUpload = multer({
  dest: mediaDirectory,
  // No size cap: only signed-in admins can upload (requireAdmin runs first),
  // and product videos are routinely tens or hundreds of MB. The type check
  // below stays — it is what stops an uploaded file being served as HTML.
  fileFilter: (req, file, callback) => callback(null, Object.prototype.hasOwnProperty.call(MEDIA_TYPE_EXTENSIONS, file.mimetype)),
});

app.use(express.json({ limit: '12mb' }));
// Razorpay's redirect checkout (redirect: true) posts the payment result back
// as a browser form submission, not JSON.
app.use(express.urlencoded({ extended: false }));
app.use('/media', express.static(mediaDirectory, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
  },
}));

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// --- Simple in-memory rate limiter, reused for login / order lookup / contact. ---
// Self-prunes on an interval so it never grows unbounded across a long-running process.
function createRateLimiter({ max, windowMs }) {
  const attempts = new Map();
  const prune = () => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.resetAt < now) attempts.delete(key);
  };
  setInterval(prune, windowMs).unref?.();
  return {
    consume(key) {
      const now = Date.now();
      const entry = attempts.get(key) || { count: 0, resetAt: now + windowMs };
      if (entry.resetAt < now) { entry.count = 0; entry.resetAt = now + windowMs; }
      entry.count += 1;
      attempts.set(key, entry);
      return entry.count <= max;
    },
    reset(key) {
      attempts.delete(key);
    },
  };
}
const loginLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const lookupLimiter = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
const contactLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const reviewLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const customerAuthLimiter = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, admin_id BIGINT NOT NULL REFERENCES admins(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS products (id BIGINT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS admin_audit_logs (id BIGSERIAL PRIMARY KEY, admin_email TEXT, action TEXT NOT NULL, ip_address TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS contact_messages (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS reviews (id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL, name TEXT NOT NULL, rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5), comment TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews (product_id);
    CREATE TABLE IF NOT EXISTS blog_posts (
      id BIGSERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      cover_image TEXT,
      seo_title TEXT,
      seo_description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON blog_posts (status, published_at DESC);
    CREATE TABLE IF NOT EXISTS product_questions (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT,
      asked_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      answered_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_product_questions_product_id ON product_questions (product_id);
    CREATE TABLE IF NOT EXISTS coupons (
      id BIGSERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
      value NUMERIC NOT NULL CHECK (value > 0),
      min_subtotal NUMERIC NOT NULL DEFAULT 0,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner';
    -- Set when someone is given a temporary password (forgot password):
    -- they must choose a new one before doing anything else.
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS temp_password_expires_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS customers (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS temp_password_expires_at TIMESTAMPTZ;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
    -- One-time codes emailed at sign-in / sign-up; a session starts only once
    -- the code is entered. Only a hash of the code is stored.
    CREATE TABLE IF NOT EXISTS customer_otps (
      id TEXT PRIMARY KEY,
      customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      sends INTEGER NOT NULL DEFAULT 1,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS customer_sessions (
      token_hash TEXT PRIMARY KEY,
      customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS addresses (
      id BIGSERIAL PRIMARY KEY,
      customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      label TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      line1 TEXT NOT NULL,
      line2 TEXT,
      city TEXT NOT NULL,
      state TEXT,
      postal_code TEXT,
      country TEXT NOT NULL DEFAULT 'India',
      is_default BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON addresses (customer_id);
    -- One running invoice number per Indian financial year ("2026-27").
    CREATE TABLE IF NOT EXISTS invoice_counters (fy TEXT PRIMARY KEY, last_number INTEGER NOT NULL);
    -- Admin order lists page by newest first and filter by status.
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders ((payload->>'status'));
    CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders ((lower(payload->'customer'->>'email')));
  `);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@baraniscouture.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'change-me-now';
  if (isProduction && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required in production.');
  const adminResult = await pool.query('SELECT id FROM admins WHERE email = $1', [adminEmail]);
  if (!adminResult.rowCount) {
    await pool.query('INSERT INTO admins (email, password_hash) VALUES ($1, $2)', [adminEmail, await bcrypt.hash(adminPassword, 12)]);
    console.log(`Created local admin ${adminEmail}. Set ADMIN_EMAIL and ADMIN_PASSWORD before production.`);
  }

  const productResult = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if (productResult.rows[0].count === 0) {
    for (const product of PRODUCTS) await pool.query('INSERT INTO products (id, slug, payload) VALUES ($1, $2, $3)', [product.id, product.slug, product]);
  }
}

function parseCookie(header = '') {
  return Object.fromEntries(header.split(';').filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateOrderId() {
  return `ARC-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function orderAccessToken(req) {
  return req.headers['x-order-token'] || req.query.access;
}

// Order lookup (email + mobile) hands out a short-lived pass per order so the
// tracking page can open the invoice or ask for a return without the
// original confirmation link. Signed, not stored; set TRACK_TOKEN_SECRET to
// keep passes valid across server restarts.
const TRACK_SECRET = process.env.TRACK_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const TRACK_TTL_MS = 2 * 60 * 60 * 1000;
const trackMac = (orderId, expires) => crypto.createHmac('sha256', TRACK_SECRET).update(`${orderId}.${expires}`).digest('base64url');

function signTrackToken(orderId) {
  const expires = Date.now() + TRACK_TTL_MS;
  return `${expires}.${trackMac(orderId, expires)}`;
}

function hasTrackAccess(req, orderId) {
  const [expires, mac] = String(req.headers['x-track-token'] || req.query.track || '').split('.');
  if (!expires || !mac || Number(expires) < Date.now()) return false;
  const expected = trackMac(orderId, expires);
  return mac.length === expected.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

// Either the confirmation-link token or a tracking pass opens an order.
function canAccessOrder(req, order) {
  const token = orderAccessToken(req);
  return Boolean(token && hashToken(token) === order.accessTokenHash) || hasTrackAccess(req, order.id);
}

// Timeline events shown to the customer ("placed", "paid", "packed",
// "shipped", "delivered", "cancelled"), each with when it happened.
function addHistory(order, status, at = new Date().toISOString()) {
  const history = order.statusHistory || [];
  if (history.some((event) => event.status === status)) return order;
  return { ...order, statusHistory: [...history, { status, at }] };
}

// What a customer may see about their order — no internal fields (stock
// levels, token hashes, gateway ids) that ride along on the stored payload.
function publicOrderView(order) {
  const paid = Boolean(order.paymentId) || order.paymentMethod === 'demo';
  const history = order.statusHistory?.length
    ? order.statusHistory
    : [{ status: 'placed', at: order.createdAt }, ...(order.paidAt ? [{ status: 'paid', at: order.paidAt }] : [])];
  const request = (value) => (value ? { status: value.status, reason: value.reason, requestedAt: value.requestedAt } : null);
  return {
    id: order.id,
    createdAt: order.createdAt,
    status: order.status,
    statusHistory: history,
    paid,
    items: (order.items || []).map((item) => ({ id: item.id, slug: item.slug, name: item.name, image: item.image, size: item.size || null, qty: item.qty, price: Number(item.price), fulfillmentStatus: item.fulfillmentStatus || 'pending', fulfillmentUpdatedAt: item.fulfillmentUpdatedAt || null })),
    subtotal: order.subtotal,
    discount: order.discount || 0,
    couponCode: order.couponCode || null,
    shipping: order.shipping || 0,
    tax: order.tax || 0,
    total: order.total,
    carrier: order.carrier || null,
    trackingNumber: order.trackingNumber || null,
    trackingUrl: order.trackingUrl || null,
    shipTo: { name: order.customer?.name, address: order.customer?.address },
    invoiceNumber: order.invoice?.seller ? order.invoice.number : null,
    returnRequest: request(order.returnRequest),
    refundRequest: request(order.refundRequest),
    cancelReason: order.cancelReason || null,
    refunds: (order.refunds || []).map((refund) => ({ id: refund.id, amount: refund.amount, method: refund.method, at: refund.at, creditNoteNumber: refund.creditNote?.number || null })),
    refundedTotal: order.refundedTotal || 0,
  };
}

function siteUrl(path = '/') {
  return `${process.env.PUBLIC_SITE_URL || SITE_CONFIG.siteUrl}${path}`;
}

// Tax/shipping are admin-editable (Settings tab) via the same `settings`
// table used for theme/categories/announcement, so they no longer require a
// code change. Falls back to the SITE_CONFIG constants until an admin sets
// them, so checkout keeps working unconfigured.
function calculateDiscountAmount(coupon, subtotal) {
  if (coupon.type === 'percent') return Math.round(subtotal * (Number(coupon.value) / 100) * 100) / 100;
  return Math.min(Number(coupon.value), subtotal);
}

// Shared by the live cart preview (/api/coupons/validate) and the real
// checkout charge (/api/checkout/init) so a coupon can never be honored
// client-side for one amount and charged server-side for another. Pass a
// transaction client during checkout so the row lock (and used_count bump)
// happens inside the same atomic reservation as stock.
async function resolveCoupon(queryable, rawCode, subtotal, { lock = false } = {}) {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) return null;
  const result = await queryable.query(`SELECT * FROM coupons WHERE code = $1${lock ? ' FOR UPDATE' : ''}`, [code]);
  const coupon = result.rows[0];
  if (!coupon) throw new Error('Invalid coupon code.');
  if (!coupon.active) throw new Error('This coupon is no longer active.');
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) throw new Error('This coupon has expired.');
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) throw new Error('This coupon has reached its usage limit.');
  if (subtotal < Number(coupon.min_subtotal)) throw new Error(`This coupon requires a minimum order of ${formatMoney(coupon.min_subtotal)}.`);
  return { coupon, discountAmount: calculateDiscountAmount(coupon, subtotal) };
}

function formatMoney(value) {
  return `${SITE_CONFIG.currency} ${Number(value).toFixed(2)}`;
}

async function getPricingSettings(queryable = pool) {
  const result = await queryable.query(`SELECT value FROM settings WHERE key = 'pricing'`);
  const saved = result.rows[0]?.value || {};
  return {
    taxRatePercent: Number.isFinite(saved.taxRatePercent) ? saved.taxRatePercent : SITE_CONFIG.tax.ratePercent,
    shippingFee: Number.isFinite(saved.shippingFee) ? saved.shippingFee : SITE_CONFIG.shippingFee,
    freeShippingThreshold: saved.freeShippingThreshold ?? SITE_CONFIG.freeShippingThreshold,
  };
}

// Someone signed in with a temporary password may only change it (or look at
// their session / sign out) until they have.
const PASSWORD_CHANGE_ROUTES = new Set(['/api/admin/session', '/api/admin/password', '/api/admin/logout', '/api/customer/session', '/api/customer/password', '/api/customer/logout']);
const mustChangeFirst = (req) => !PASSWORD_CHANGE_ROUTES.has(req.originalUrl.split('?')[0]);

const requireAdmin = asyncHandler(async (req, res, next) => {
  const token = parseCookie(req.headers.cookie)[cookieName];
  const result = token ? await pool.query('SELECT admins.id, admins.email, admins.role, admins.must_change_password, sessions.expires_at FROM sessions JOIN admins ON admins.id = sessions.admin_id WHERE token_hash = $1 AND expires_at > NOW()', [hashToken(token)]) : { rowCount: 0 };
  if (!result.rowCount) return res.status(401).json({ error: 'Admin authentication required.' });
  const row = result.rows[0];
  req.admin = { id: row.id, email: row.email, role: row.role, mustChangePassword: row.must_change_password };
  if (row.must_change_password && mustChangeFirst(req)) return res.status(403).json({ error: 'Choose a new password first.', mustChangePassword: true });
  next();
});

// Wraps routes that only the store owner should reach — pricing/settings,
// staff management — never a staff account, even an authenticated one.
const requireOwner = asyncHandler(async (req, res, next) => {
  if (req.admin?.role !== 'owner') return res.status(403).json({ error: 'Only the store owner can do this.' });
  next();
});

// Mirrors requireAdmin exactly, against the separate customers/
// customer_sessions tables — a shopper and an admin can be logged in on the
// same browser at once without either session interfering with the other.
const requireCustomer = asyncHandler(async (req, res, next) => {
  const token = parseCookie(req.headers.cookie)[customerCookieName];
  const result = token ? await pool.query('SELECT customers.id, customers.email, customers.name, customers.must_change_password FROM customer_sessions JOIN customers ON customers.id = customer_sessions.customer_id WHERE token_hash = $1 AND expires_at > NOW()', [hashToken(token)]) : { rowCount: 0 };
  if (!result.rowCount) return res.status(401).json({ error: 'Please sign in to continue.' });
  const { must_change_password: mustChangePassword, ...customer } = result.rows[0];
  req.customer = { ...customer, mustChangePassword };
  if (mustChangePassword && mustChangeFirst(req)) return res.status(403).json({ error: 'Choose a new password first.', mustChangePassword: true });
  next();
});

// --- Stock reservation shared by checkout: runs inside a transaction with
// row locks so two simultaneous checkouts can never both sell the last unit. ---
// A product with a `sizeStock` map ({ S: 5, M: 3, ... }) tracks stock per
// size; everything else keeps the original flat `stockQty`/`inStock`
// behavior unchanged — this is purely additive per product.
async function reserveStockAndPrice(client, items) {
  const requested = Array.isArray(items) ? items : [];
  const productIds = [...new Set(requested.map((item) => Number(item.id)).filter(Number.isInteger))];
  if (!productIds.length) throw Object.assign(new Error('Cart is empty.'), { statusCode: 400 });
  const [result, servicesResult] = await Promise.all([
    client.query('SELECT id, payload FROM products WHERE id = ANY($1::bigint[]) FOR UPDATE', [productIds]),
    client.query(`SELECT value FROM settings WHERE key = 'services'`),
  ]);
  const products = new Map(result.rows.map((row) => [Number(row.id), row.payload]));
  const services = serviceList({ services: servicesResult.rows[0]?.value });
  // Running stock per product, so two lines of the same product (different
  // sizes or add-ons) are checked and deducted together, never twice from
  // the same starting number.
  const remaining = new Map();
  const normalizedItems = [];
  for (const item of requested) {
    const product = products.get(Number(item.id));
    const quantity = Number(item.qty);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw Object.assign(new Error('A cart item is unavailable or invalid.'), { statusCode: 409 });
    }
    if (!remaining.has(product.id)) remaining.set(product.id, { stockQty: product.stockQty, sizeStock: product.sizeStock && typeof product.sizeStock === 'object' ? { ...product.sizeStock } : null });
    const stock = remaining.get(product.id);
    const size = item.size || null;
    if (stock.sizeStock) {
      const available = Number(stock.sizeStock[size]) || 0;
      if (available < quantity) throw Object.assign(new Error(`${product.name} (size ${size || 'Free Size'}) only has ${available} left in stock.`), { statusCode: 409 });
      stock.sizeStock[size] = available - quantity;
    } else if (Number.isFinite(stock.stockQty)) {
      if (stock.stockQty < quantity) throw Object.assign(new Error(`${product.name} only has ${stock.stockQty} left in stock.`), { statusCode: 409 });
      stock.stockQty -= quantity;
    } else if (!product.inStock) {
      throw Object.assign(new Error(`${product.name} is out of stock.`), { statusCode: 409 });
    }
    // Add-ons are priced here from Store settings, and only those this
    // product offers — whatever the browser sent.
    const offered = new Set(product.addons || []);
    const addonDetails = services.filter((service) => offered.has(service.id) && (item.addonIds || []).includes(service.id))
      .map(({ id, name, price }) => ({ id, name, price: Number(price) }));
    normalizedItems.push({ ...product, qty: quantity, size, addonIds: addonDetails.map((a) => a.id), addonDetails, addonsTotal: addonDetails.reduce((sum, a) => sum + a.price, 0) });
  }
  for (const [productId, stock] of remaining) {
    const product = products.get(productId);
    let next = null;
    if (stock.sizeStock) next = { ...product, sizeStock: stock.sizeStock, inStock: Object.values(stock.sizeStock).some((qty) => Number(qty) > 0) };
    else if (Number.isFinite(stock.stockQty)) next = { ...product, stockQty: stock.stockQty, inStock: stock.stockQty > 0 };
    if (next) await client.query('UPDATE products SET payload = $1, updated_at = NOW() WHERE id = $2', [next, productId]);
  }
  return normalizedItems;
}

// Puts an order's units back on the shelf (the reverse of reserveStockAndPrice).
// Uses each product's current stock mode, so it's right even if the admin
// switched a product to per-size stock after the order was placed.
async function restoreStock(client, items) {
  for (const item of items || []) {
    const productResult = await client.query('SELECT payload FROM products WHERE id = $1 FOR UPDATE', [item.id]);
    if (!productResult.rowCount) continue;
    const product = productResult.rows[0].payload;
    if (product.sizeStock && typeof product.sizeStock === 'object') {
      const size = item.size || null;
      const sizeStock = { ...product.sizeStock, [size]: (Number(product.sizeStock[size]) || 0) + item.qty };
      await client.query('UPDATE products SET payload = $1, updated_at = NOW() WHERE id = $2', [{ ...product, sizeStock, inStock: true }, item.id]);
    } else if (Number.isFinite(product.stockQty)) {
      await client.query('UPDATE products SET payload = $1, updated_at = NOW() WHERE id = $2', [{ ...product, stockQty: product.stockQty + item.qty, inStock: true }, item.id]);
    }
  }
}

const razorpayAuth = () => `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;

// Asks Razorpay whether a gateway order was actually paid. A shopper can pay
// and then close the tab before being sent back to us, so "we never heard
// back" does not mean "not paid".
async function razorpayPaymentStatus(gatewayOrderId) {
  if (!gatewayOrderId || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return { state: 'none' };
  try {
    const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(gatewayOrderId)}/payments`, { headers: { Authorization: razorpayAuth() } });
    if (!response.ok) return { state: 'unknown' };
    const payments = (await response.json()).items || [];
    const captured = payments.find((payment) => payment.status === 'captured');
    if (captured) return { state: 'captured', paymentId: captured.id };
    if (payments.some((payment) => payment.status === 'authorized')) return { state: 'authorized' };
    return { state: 'none' };
  } catch {
    return { state: 'unknown' };
  }
}

// Pending-payment orders older than 30 minutes: if Razorpay says they were
// paid, confirm them (with an invoice); if payment is still in flight or
// Razorpay can't be reached, leave them for the next run; otherwise cancel
// them and put their stock back.
async function releaseExpiredPendingOrders() {
  const stale = await pool.query(`SELECT id, payload FROM orders WHERE payload->>'status' = 'pending_payment' AND created_at < NOW() - INTERVAL '30 minutes'`);
  for (const row of stale.rows) {
    const payment = await razorpayPaymentStatus(row.payload.gatewayOrderId);
    if (payment.state === 'authorized' || payment.state === 'unknown') continue;
    const client = await pool.connect();
    let confirmedOrder = null;
    try {
      await client.query('BEGIN');
      const locked = await client.query('SELECT payload FROM orders WHERE id = $1 FOR UPDATE', [row.id]);
      const order = locked.rows[0]?.payload;
      if (!order || order.status !== 'pending_payment') { await client.query('ROLLBACK'); continue; }
      if (payment.state === 'captured') {
        confirmedOrder = await issueInvoice(client, addHistory({ ...order, status: 'processing', paymentId: payment.paymentId, paidAt: new Date().toISOString(), confirmedBy: 'payment_check' }, 'paid'));
        await client.query('UPDATE orders SET payload = $1 WHERE id = $2', [confirmedOrder, order.id]);
      } else {
        await restoreStock(client, order.items);
        await client.query('UPDATE orders SET payload = $1 WHERE id = $2', [addHistory({ ...order, status: 'cancelled', cancelReason: 'payment_timeout', stockReleased: true, cancelledAt: new Date().toISOString() }, 'cancelled'), order.id]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to settle expired order', row.id, error.message);
    } finally {
      client.release();
    }
    if (confirmedOrder) sendMail(orderConfirmationEmail(confirmedOrder, null));
  }
}

// `accessToken` is null when the order was confirmed by the background payment
// check (only its hash is stored), so the email points to Track Order instead.
function orderConfirmationEmail(order, accessToken) {
  const trackLine = accessToken ? siteUrl(`/order-success?order=${order.id}&access=${accessToken}`) : `${siteUrl('/track-order')} (use your email and mobile number)`;
  const invoiceLine = order.invoice?.seller && accessToken ? `\n\nYour invoice ${order.invoice.number}: ${siteUrl(`/api/orders/${order.id}/invoice?access=${accessToken}`)}` : '';
  return {
    to: order.customer?.email,
    subject: `Order ${order.id} confirmed — ${SITE_CONFIG.name}`,
    text: `Hi ${order.customer?.name || 'there'},\n\nYour order ${order.id} is confirmed. Total: ${SITE_CONFIG.currency} ${Number(order.total).toFixed(2)}.\n\nTrack it any time: ${trackLine}${invoiceLine}\n\nThank you for shopping with ${SITE_CONFIG.name}.`,
  };
}

// --- Invoices ---
// An invoice is issued only when payment is confirmed (never at checkout
// start), numbered PREFIX/FY/00001 with one unbroken sequence per financial
// year, and stored as a frozen snapshot so later edits to products, prices or
// business details never change an invoice that was already issued.
async function getBusinessDetails(queryable = pool) {
  const result = await queryable.query(`SELECT key, value FROM settings WHERE key IN ('business', 'supportEmail')`);
  const rows = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
  const saved = rows.business || {};
  // No business email set: use the support email rather than a placeholder.
  if (!saved.email && typeof rows.supportEmail === 'string') saved.email = rows.supportEmail;
  return {
    legalName: saved.legalName?.trim() || SITE_CONFIG.legalName,
    address: saved.address?.trim() || '',
    gstin: saved.gstin?.trim().toUpperCase() || '',
    email: saved.email?.trim() || SITE_CONFIG.email,
    phone: saved.phone?.trim() || '',
    state: stateCode(saved.state) ? saved.state : '',
    invoicePrefix: (saved.invoicePrefix?.trim() || 'SB').replace(/[^A-Za-z0-9-]/g, '').slice(0, 10) || 'SB',
  };
}

const isInvoiceIssued = (order) => Boolean(order?.invoice?.seller);

// Must run inside the same transaction that marks the order paid, so a
// rolled-back payment never uses up an invoice number (no gaps).
async function issueInvoice(client, order) {
  if (isInvoiceIssued(order)) return order;
  const paidAt = order.paidAt || new Date().toISOString();
  const fy = financialYear(paidAt);
  const counter = await client.query(
    'INSERT INTO invoice_counters (fy, last_number) VALUES ($1, 1) ON CONFLICT (fy) DO UPDATE SET last_number = invoice_counters.last_number + 1 RETURNING last_number',
    [fy]
  );
  const { invoicePrefix, ...seller } = await getBusinessDetails(client);
  // GST: same state as the seller → CGST + SGST (half each); another state or
  // abroad → IGST. Needs the seller's state from Store settings; without it
  // the invoice shows a single GST line as before.
  const shipTo = order.customer?.shippingAddress;
  const tax = Number(order.tax) || 0;
  const rate = order.taxRatePercent;
  const pct = (value) => (value != null ? ` @ ${Math.round(value * 100) / 100}%` : '');
  let taxLines = [];
  if (tax > 0 && seller.state && shipTo?.country) {
    if (shipTo.country === 'IN' && shipTo.state === seller.state) {
      const cgst = Math.round((tax / 2) * 100) / 100;
      taxLines = [{ label: `CGST${pct(rate != null ? rate / 2 : null)}`, amount: cgst }, { label: `SGST${pct(rate != null ? rate / 2 : null)}`, amount: Math.round((tax - cgst) * 100) / 100 }];
    } else {
      taxLines = [{ label: `IGST${pct(rate)}`, amount: tax }];
    }
  }
  const placeOfSupply = shipTo?.country === 'IN' && shipTo.state ? `${shipTo.state} (${stateCode(shipTo.state)})` : shipTo?.country ? `Outside India (${COUNTRIES[shipTo.country]?.name || shipTo.country})` : null;
  const invoice = {
    number: formatInvoiceNumber(invoicePrefix, fy, counter.rows[0].last_number),
    issuedAt: new Date().toISOString(),
    status: 'issued',
    orderId: order.id,
    orderDate: order.createdAt,
    seller,
    buyer: { name: order.customer?.name, email: order.customer?.email, phone: order.customer?.phone, address: order.customer?.address },
    // Add-ons (fall & pico, stitching…) are part of the line: named on it and in its unit price.
    items: (order.items || []).map((item) => {
      const unit = Number(item.price) + Number(item.addonsTotal || 0);
      const extras = (item.addonDetails || []).map((addon) => addon.name).join(', ');
      return { name: extras ? `${item.name} + ${extras}` : item.name, size: item.size || null, sku: item.sku || null, hsn: item.hsn || null, qty: item.qty, unitPrice: unit, total: Math.round(unit * item.qty * 100) / 100 };
    }),
    subtotal: order.subtotal,
    discount: order.discount || 0,
    couponCode: order.couponCode || null,
    shipping: order.shipping || 0,
    tax: order.tax || 0,
    taxRatePercent: order.taxRatePercent ?? null,
    taxLines,
    placeOfSupply,
    total: order.total,
    payment: { method: order.paymentMethod, paymentId: order.paymentId || null, paidAt },
  };
  return { ...order, invoice };
}

// --- Refunds and credit notes ---
// One path for every refund: Razorpay (sent through their API) or recorded by
// hand for money returned another way (UPI, bank transfer, cash). Partial
// refunds are allowed up to what's left. When the order has an invoice, each
// refund gets a credit note (PREFIX-CN/FY/00001) that reverses the GST in
// proportion. Must run inside the caller's transaction with the order locked.
const REFUND_METHODS = new Set(['razorpay', 'upi', 'bank', 'cash', 'other']);
const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

async function recordRefund(client, order, { amount, method, reference = '', note = '', restock = false, by }) {
  const paid = Boolean(order.paymentId) || order.paymentMethod === 'demo';
  if (!paid) throw Object.assign(new Error('This order was never paid, so there is nothing to refund.'), { statusCode: 409 });
  const refunded = roundMoney(order.refundedTotal || 0);
  const remaining = roundMoney(Number(order.total) - refunded);
  const value = roundMoney(amount);
  if (!(value > 0)) throw Object.assign(new Error('Enter an amount to refund.'), { statusCode: 400 });
  if (value > remaining) throw Object.assign(new Error(`Only ${formatMoney(remaining)} is left to refund on this order.`), { statusCode: 400 });
  if (!REFUND_METHODS.has(method)) throw Object.assign(new Error('Choose how the money was refunded.'), { statusCode: 400 });

  let razorpayRefundId = null;
  if (method === 'razorpay') {
    if (!order.paymentId || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw Object.assign(new Error('This order wasn’t paid through Razorpay. Refund it another way and record how.'), { statusCode: 400 });
    }
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(order.paymentId)}/refund`, {
      method: 'POST',
      headers: { Authorization: razorpayAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(value * 100), notes: { order_id: order.id } }),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) throw Object.assign(new Error(`Razorpay didn’t accept the refund${body.error?.description ? `: ${body.error.description}` : ''}. Nothing was refunded.`), { statusCode: 502 });
    razorpayRefundId = body.id;
  }

  if (restock && !order.returnRestocked) await restoreStock(client, order.items);

  const refund = {
    id: crypto.randomBytes(6).toString('hex'),
    amount: value,
    method,
    reference: String(method === 'razorpay' ? razorpayRefundId : reference || '').trim().slice(0, 80),
    note: String(note || '').trim().slice(0, 300),
    at: new Date().toISOString(),
    by,
    restocked: Boolean(restock && !order.returnRestocked),
  };

  if (isInvoiceIssued(order)) {
    const fy = financialYear(refund.at);
    const counter = await client.query(
      'INSERT INTO invoice_counters (fy, last_number) VALUES ($1, 1) ON CONFLICT (fy) DO UPDATE SET last_number = invoice_counters.last_number + 1 RETURNING last_number',
      [`CN:${fy}`]
    );
    const prefix = order.invoice.number.split('/')[0];
    refund.creditNote = {
      number: formatInvoiceNumber(`${prefix}-CN`, fy, counter.rows[0].last_number),
      issuedAt: refund.at,
      invoiceNumber: order.invoice.number,
      invoiceDate: order.invoice.issuedAt,
      orderId: order.id,
      seller: order.invoice.seller,
      buyer: order.invoice.buyer,
      amount: value,
      ...creditNoteTax(order.invoice, value),
      reason: refund.note || null,
      refund: { method, reference: refund.reference },
    };
  }

  const refundedTotal = roundMoney(refunded + value);
  let updated = {
    ...order,
    refunds: [...(order.refunds || []), refund],
    refundedTotal,
    paymentStatus: refundedTotal >= roundMoney(order.total) ? 'refunded' : 'partially_refunded',
    returnRestocked: order.returnRestocked || refund.restocked,
  };
  if (updated.refundRequest && ['pending', 'approved'].includes(updated.refundRequest.status)) {
    updated.refundRequest = { ...updated.refundRequest, status: 'refunded', refundState: undefined, refundedAt: refund.at };
  }
  if (updated.paymentStatus === 'refunded') updated = addHistory(updated, 'refunded', refund.at);
  return updated;
}

// Verifies the Razorpay signature and, if it checks out, marks the order paid
// and issues its invoice in one transaction (row-locked, so two confirmations
// racing each other can't both issue an invoice).
async function markOrderPaid(orderId, paymentId, signature) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT payload FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    const order = result.rows[0]?.payload;
    if (!order || order.status !== 'pending_payment' || !verifyRazorpaySignature(order.gatewayOrderId, paymentId, signature)) {
      await client.query('ROLLBACK');
      return { order, confirmed: false };
    }
    const paid = await issueInvoice(client, addHistory({ ...order, status: 'processing', paymentId, paidAt: new Date().toISOString() }, 'paid'));
    await client.query('UPDATE orders SET payload = $1 WHERE id = $2', [paid, orderId]);
    await client.query('COMMIT');
    return { order: paid, confirmed: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function sendInvoicePage(res, order) {
  res.set('Cache-Control', 'private, no-store');
  if (!isInvoiceIssued(order)) {
    return res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><title>No invoice yet</title><p style="font:16px system-ui;margin:40px">There is no invoice for this order yet. An invoice is created as soon as payment is confirmed.</p>');
  }
  res.type('html').send(renderInvoiceHtml(order.invoice));
}

app.post('/api/admin/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const attemptKey = `${req.ip}:${String(email || '').toLowerCase()}`;
  if (!loginLimiter.consume(attemptKey)) return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  const result = await pool.query('SELECT id, email, password_hash, role, must_change_password, temp_password_expires_at FROM admins WHERE lower(email) = $1', [String(email || '').trim().toLowerCase()]);
  const admin = result.rows[0];
  if (!admin || !await bcrypt.compare(password || '', admin.password_hash)) {
    await pool.query('INSERT INTO admin_audit_logs (admin_email, action, ip_address) VALUES ($1, $2, $3)', [email || null, 'login_failed', req.ip]);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (admin.must_change_password && admin.temp_password_expires_at && new Date(admin.temp_password_expires_at) < new Date()) {
    return res.status(401).json({ error: 'This temporary password has expired. Ask the store owner for a new one.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  await pool.query('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES ($1, $2, $3)', [hashToken(token), admin.id, expiresAt]);
  loginLimiter.reset(attemptKey);
  await pool.query('INSERT INTO admin_audit_logs (admin_email, action, ip_address) VALUES ($1, $2, $3)', [admin.email, 'login_succeeded', req.ip]);
  res.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${isProduction ? '; Secure' : ''}`);
  res.json({ email: admin.email, role: admin.role, expiresAt, mustChangePassword: admin.must_change_password });
}));

app.get('/api/admin/session', requireAdmin, (req, res) => res.json({ email: req.admin.email, role: req.admin.role, mustChangePassword: req.admin.mustChangePassword }));

app.post('/api/admin/logout', asyncHandler(async (req, res) => {
  const token = parseCookie(req.headers.cookie)[cookieName];
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.status(204).end();
}));

// --- Customer accounts ---
// Entirely additive: guest checkout (order id + access token, or the
// email+phone lookup on /track-order) keeps working exactly as before.
// Signing in just adds a dashboard and lets future orders link to an account.
//
// Every sign-up and sign-in is confirmed with a 6-digit code emailed to the
// customer, so accounts are off entirely until real SMTP settings exist.
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SENDS = 3;
const otpHash = (challengeId, code) => hashToken(`${challengeId}:${code}`);
const maskEmail = (email) => email.replace(/^(.)(.*)(@.*)$/, (match, first, middle, domain) => `${first}${'•'.repeat(Math.min(middle.length, 6))}${domain}`);

app.get('/api/customer/auth-config', (req, res) => res.json({ accountsEnabled: isEmailConfigured() }));

function requireCustomerAccounts(req, res, next) {
  if (!isEmailConfigured()) return res.status(503).json({ error: 'Customer accounts are not available yet. Please check out as a guest and track your order with your email and mobile number.' });
  next();
}

async function startCustomerSession(res, customer) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await pool.query('INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES ($1, $2, $3)', [hashToken(token), customer.id, expiresAt]);
  res.setHeader('Set-Cookie', `${customerCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${isProduction ? '; Secure' : ''}`);
}

function otpEmail(customer, code) {
  return {
    to: customer.email,
    subject: `${code} is your ${SITE_CONFIG.name} sign-in code`,
    text: `Hi ${customer.name || 'there'},\n\nYour ${SITE_CONFIG.name} verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't try to sign in, you can ignore this email — nobody can access your account without this code.`,
  };
}

// Creates a code for this customer, emails it, and returns what the client
// needs for the next step. Older unused codes for the customer are dropped.
async function issueCustomerOtp(customer) {
  const challengeId = crypto.randomBytes(16).toString('hex');
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await pool.query('DELETE FROM customer_otps WHERE customer_id = $1 OR expires_at < NOW()', [customer.id]);
  await pool.query('INSERT INTO customer_otps (id, customer_id, code_hash, expires_at) VALUES ($1, $2, $3, $4)', [challengeId, customer.id, otpHash(challengeId, code), new Date(Date.now() + OTP_TTL_MS).toISOString()]);
  const sent = await sendMail(otpEmail(customer, code));
  if (!sent.sent) {
    await pool.query('DELETE FROM customer_otps WHERE id = $1', [challengeId]);
    const error = new Error('We couldn’t send your verification code. Please try again in a few minutes.');
    error.statusCode = 502;
    throw error;
  }
  return { otpRequired: true, challengeId, sentTo: maskEmail(customer.email) };
}

app.post('/api/customer/signup', requireCustomerAccounts, asyncHandler(async (req, res) => {
  const { email, password, name, phone } = req.body || {};
  if (!email?.trim() || !password || password.length < 8 || !name?.trim()) {
    return res.status(400).json({ error: 'Name, email, and a password of at least 8 characters are required.' });
  }
  if (!customerAuthLimiter.consume(req.ip)) return res.status(429).json({ error: 'Too many attempts. Please try again shortly.' });
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await pool.query('SELECT 1 FROM customers WHERE email = $1', [normalizedEmail]);
  if (existing.rowCount) return res.status(409).json({ error: 'An account with that email already exists. Try signing in instead.' });
  const result = await pool.query(
    'INSERT INTO customers (email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
    [normalizedEmail, await bcrypt.hash(password, 12), name.trim(), phone?.trim() || null]
  );
  const customer = result.rows[0];
  // The account exists now, but no session until the emailed code is entered.
  // If the code is never entered, signing in later sends a fresh one.
  res.status(201).json(await issueCustomerOtp(customer));
}));

app.post('/api/customer/login', requireCustomerAccounts, asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const attemptKey = `${req.ip}:${String(email || '').toLowerCase()}`;
  if (!customerAuthLimiter.consume(attemptKey)) return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  const result = await pool.query('SELECT id, email, name, password_hash, must_change_password, temp_password_expires_at FROM customers WHERE email = $1', [String(email || '').trim().toLowerCase()]);
  const customer = result.rows[0];
  if (!customer || !await bcrypt.compare(password || '', customer.password_hash)) return res.status(401).json({ error: 'Invalid email or password.' });
  if (customer.must_change_password && customer.temp_password_expires_at && new Date(customer.temp_password_expires_at) < new Date()) {
    return res.status(401).json({ error: 'This temporary password has expired. Contact us for a new one.' });
  }
  // Correct password: now prove access to the inbox before a session starts.
  res.json(await issueCustomerOtp(customer));
}));

app.post('/api/customer/verify-otp', requireCustomerAccounts, asyncHandler(async (req, res) => {
  const { challengeId, code } = req.body || {};
  if (!customerAuthLimiter.consume(`otp:${req.ip}`)) return res.status(429).json({ error: 'Too many attempts. Please try again shortly.' });
  const found = await pool.query(
    'SELECT o.id, o.code_hash, o.attempts, o.expires_at, c.id AS customer_id, c.email, c.name, c.must_change_password FROM customer_otps o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1',
    [String(challengeId || '')]
  );
  const otp = found.rows[0];
  if (!otp || new Date(otp.expires_at) < new Date()) return res.status(410).json({ error: 'This code has expired. Send a new one.' });
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return res.status(429).json({ error: 'Too many wrong codes. Send a new one.' });
  const entered = String(code || '').replace(/\D/g, '');
  const expected = Buffer.from(otp.code_hash);
  const actual = Buffer.from(otpHash(otp.id, entered));
  if (entered.length !== 6 || expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    await pool.query('UPDATE customer_otps SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
    const left = OTP_MAX_ATTEMPTS - otp.attempts - 1;
    return res.status(401).json({ error: left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Send a new one.' });
  }
  await pool.query('DELETE FROM customer_otps WHERE id = $1', [otp.id]);
  await pool.query('UPDATE customers SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1', [otp.customer_id]);
  await startCustomerSession(res, { id: otp.customer_id });
  res.json({ email: otp.email, name: otp.name, mustChangePassword: otp.must_change_password });
}));

app.post('/api/customer/resend-otp', requireCustomerAccounts, asyncHandler(async (req, res) => {
  if (!customerAuthLimiter.consume(`otp-send:${req.ip}`)) return res.status(429).json({ error: 'Too many attempts. Please try again shortly.' });
  const found = await pool.query('SELECT o.id, o.sends, c.id AS customer_id, c.email, c.name FROM customer_otps o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1', [String(req.body?.challengeId || '')]);
  const otp = found.rows[0];
  if (!otp) return res.status(410).json({ error: 'This sign-in has expired. Please start again.' });
  if (otp.sends >= OTP_MAX_SENDS) return res.status(429).json({ error: 'We’ve sent several codes already. Please start sign-in again in a few minutes.' });
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await pool.query('UPDATE customer_otps SET code_hash = $1, attempts = 0, sends = sends + 1, expires_at = $2 WHERE id = $3', [otpHash(otp.id, code), new Date(Date.now() + OTP_TTL_MS).toISOString(), otp.id]);
  const sent = await sendMail(otpEmail({ email: otp.email, name: otp.name }, code));
  if (!sent.sent) return res.status(502).json({ error: 'We couldn’t send your verification code. Please try again in a few minutes.' });
  res.json({ otpRequired: true, challengeId: otp.id, sentTo: maskEmail(otp.email) });
}));

app.get('/api/customer/session', requireCustomer, (req, res) => res.json({ email: req.customer.email, name: req.customer.name, mustChangePassword: req.customer.mustChangePassword }));

// Change password (also how a temporary password gets replaced). Signs out
// every other device, since a password change often follows a scare.
app.post('/api/customer/password', requireCustomer, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Your new password must have at least 8 characters.' });
  if (newPassword === currentPassword) return res.status(400).json({ error: 'Choose a password different from the current one.' });
  const result = await pool.query('SELECT password_hash FROM customers WHERE id = $1', [req.customer.id]);
  if (!result.rowCount || !await bcrypt.compare(currentPassword || '', result.rows[0].password_hash)) return res.status(401).json({ error: 'Your current password is incorrect.' });
  await pool.query('UPDATE customers SET password_hash = $1, must_change_password = false, temp_password_expires_at = NULL WHERE id = $2', [await bcrypt.hash(newPassword, 12), req.customer.id]);
  const currentToken = parseCookie(req.headers.cookie)[customerCookieName];
  await pool.query('DELETE FROM customer_sessions WHERE customer_id = $1 AND token_hash <> $2', [req.customer.id, hashToken(currentToken)]);
  res.status(204).end();
}));

app.post('/api/customer/logout', asyncHandler(async (req, res) => {
  const token = parseCookie(req.headers.cookie)[customerCookieName];
  if (token) await pool.query('DELETE FROM customer_sessions WHERE token_hash = $1', [hashToken(token)]);
  res.setHeader('Set-Cookie', `${customerCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.status(204).end();
}));

app.get('/api/customer/orders', requireCustomer,asyncHandler(async (req, res) => {
  // Matches by email so an order placed as a guest, before this account
  // existed, still shows up once the shopper signs in with the same email.
  const result = await pool.query(
    `SELECT payload FROM orders WHERE lower(payload->'customer'->>'email') = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.customer.email.toLowerCase()]
  );
  res.json({ orders: result.rows.map(({ payload }) => ({ id: payload.id, createdAt: payload.createdAt, status: payload.status, total: payload.total, items: payload.items, carrier: payload.carrier, trackingNumber: payload.trackingNumber, trackingUrl: payload.trackingUrl, statusHistory: publicOrderView(payload).statusHistory, invoiceNumber: payload.invoice?.seller ? payload.invoice.number : null })) });
}));

app.get('/api/customer/addresses', requireCustomer, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC', [req.customer.id]);
  res.json({ addresses: result.rows.map((row) => ({ ...row, country: countryCodeOf(row.country) })) });
}));

app.post('/api/customer/addresses', requireCustomer, asyncHandler(async (req, res) => {
  const { label, isDefault = false } = req.body || {};
  const { address, errors } = validateAddress({ ...req.body, country: req.body?.country || 'IN' }, SHIP_COUNTRIES);
  if (Object.keys(errors).length) return res.status(400).json({ error: firstError(errors), fields: errors });
  if (isDefault) await pool.query('UPDATE addresses SET is_default = false WHERE customer_id = $1', [req.customer.id]);
  const result = await pool.query(
    'INSERT INTO addresses (customer_id, label, name, phone, line1, line2, city, state, postal_code, country, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
    [req.customer.id, String(label || '').trim().slice(0, 40) || null, address.name, address.phone, address.line1, address.line2 || null, address.city, address.state || null, address.postalCode, address.country, !!isDefault]
  );
  res.status(201).json(result.rows[0]);
}));

app.delete('/api/customer/addresses/:id', requireCustomer, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM addresses WHERE id = $1 AND customer_id = $2', [req.params.id, req.customer.id]);
  res.status(204).end();
}));

app.post('/api/admin/password', requireAdmin, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 12) return res.status(400).json({ error: 'New password must contain at least 12 characters.' });
  if (newPassword === currentPassword) return res.status(400).json({ error: 'Choose a password different from the current one.' });
  const result = await pool.query('SELECT id, password_hash FROM admins WHERE email = $1', [req.admin.email]);
  if (!result.rowCount || !await bcrypt.compare(currentPassword || '', result.rows[0].password_hash)) return res.status(401).json({ error: 'Current password is incorrect.' });
  await pool.query('UPDATE admins SET password_hash = $1, must_change_password = false, temp_password_expires_at = NULL WHERE id = $2', [await bcrypt.hash(newPassword, 12), result.rows[0].id]);
  const currentToken = parseCookie(req.headers.cookie)[cookieName];
  await pool.query('DELETE FROM sessions WHERE admin_id = $1 AND token_hash <> $2', [result.rows[0].id, hashToken(currentToken)]);
  await pool.query('INSERT INTO admin_audit_logs (admin_email, action, ip_address) VALUES ($1, $2, $3)', [req.admin.email, 'password_changed', req.ip]);
  res.status(204).end();
}));

app.get('/api/admin/staff', requireAdmin, requireOwner, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, email, role, created_at FROM admins ORDER BY created_at ASC');
  res.json({ staff: result.rows });
}));

app.post('/api/admin/staff', requireAdmin, requireOwner, asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email?.trim() || !password || password.length < 12) return res.status(400).json({ error: 'Email and a password of at least 12 characters are required.' });
  const existing = await pool.query('SELECT 1 FROM admins WHERE email = $1', [email.trim().toLowerCase()]);
  if (existing.rowCount) return res.status(409).json({ error: 'An admin with that email already exists.' });
  const result = await pool.query(
    "INSERT INTO admins (email, password_hash, role) VALUES ($1, $2, 'staff') RETURNING id, email, role, created_at",
    [email.trim().toLowerCase(), await bcrypt.hash(password, 12)]
  );
  await pool.query('INSERT INTO admin_audit_logs (admin_email, action, ip_address) VALUES ($1, $2, $3)', [req.admin.email, `staff_created:${result.rows[0].email}`, req.ip]);
  res.status(201).json(result.rows[0]);
}));

app.delete('/api/admin/staff/:id', requireAdmin, requireOwner, asyncHandler(async (req, res) => {
  const target = await pool.query('SELECT email, role FROM admins WHERE id = $1', [req.params.id]);
  if (!target.rowCount) return res.status(404).json({ error: 'Admin not found.' });
  if (target.rows[0].role === 'owner') return res.status(400).json({ error: 'The store owner account cannot be removed.' });
  await pool.query('DELETE FROM admins WHERE id = $1', [req.params.id]);
  await pool.query('INSERT INTO admin_audit_logs (admin_email, action, ip_address) VALUES ($1, $2, $3)', [req.admin.email, `staff_removed:${target.rows[0].email}`, req.ip]);
  res.status(204).end();
}));

app.get('/api/admin/catalog', requireAdmin, asyncHandler(async (req, res) => {
  // Orders are no longer bundled here: the admin pages them in on demand
  // (see /api/admin/summary and /api/admin/orders) so it stays fast as the
  // order history grows.
  const [productsResult, settingsResult] = await Promise.all([
    pool.query('SELECT payload FROM products ORDER BY id'),
    pool.query('SELECT key, value FROM settings'),
  ]);
  const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value]));
  res.json({ products: productsResult.rows.map((row) => row.payload), settings });
}));

// --- Admin order data, in pages ---
const ORDER_PAGE_SIZE = 50;
const isOrderPacked = (order) => (order.items || []).length > 0 && order.items.every((item) => ['packed', 'shipped', 'delivered'].includes(item.fulfillmentStatus));

// Builds the WHERE clause shared by the order list, its count and CSV export.
function orderFilters({ status, q, has }) {
  const where = [];
  const values = [];
  const add = (sql, value) => { values.push(value); where.push(sql.replaceAll('$?', () => `$${values.length}`)); };
  if (status && status !== 'all') add(`payload->>'status' = $?`, status);
  if (has === 'request') where.push(`(payload->'returnRequest' IS NOT NULL OR payload->'refundRequest' IS NOT NULL)`);
  const text = String(q || '').trim();
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const digits = text.replace(/\D/g, '');
    values.push(like);
    const likeIndex = values.length;
    const clauses = [`id ILIKE $${likeIndex}`, `payload->'customer'->>'name' ILIKE $${likeIndex}`, `payload->'customer'->>'email' ILIKE $${likeIndex}`];
    if (digits.length >= 4) { values.push(`%${digits}%`); clauses.push(`regexp_replace(payload->'customer'->>'phone', '\\D', '', 'g') LIKE $${values.length}`); }
    where.push(`(${clauses.join(' OR ')})`);
  }
  return { where, values };
}

// Everything the Today page and the nav counts need, computed in the database.
app.get('/api/admin/summary', requireAdmin, asyncHandler(async (req, res) => {
  const since = req.query.since && !Number.isNaN(Date.parse(req.query.since)) ? new Date(req.query.since).toISOString() : null;
  const [byStatus, requests, messages, questions, toShip, recent, customers, unread] = await Promise.all([
    pool.query(`SELECT payload->>'status' AS status, COUNT(*)::int AS count FROM orders GROUP BY 1`),
    pool.query(`SELECT COUNT(*)::int AS count FROM orders WHERE payload->'returnRequest'->>'status' = 'pending' OR payload->'refundRequest'->>'status' = 'pending'`),
    pool.query(`SELECT COUNT(*)::int AS count FROM contact_messages WHERE status = 'new'`),
    pool.query(`SELECT COUNT(*)::int AS count FROM product_questions WHERE status = 'pending'`),
    pool.query(`SELECT payload FROM orders WHERE payload->>'status' = 'processing' ORDER BY created_at ASC LIMIT 1000`),
    pool.query(`SELECT created_at, (payload->>'total')::float AS total FROM orders WHERE payload->>'status' IN ('processing', 'shipped', 'delivered') AND created_at >= NOW() - INTERVAL '28 days'`),
    pool.query('SELECT COUNT(*)::int AS count FROM customers'),
    since ? pool.query('SELECT (SELECT COUNT(*) FROM orders WHERE created_at > $1) + (SELECT COUNT(*) FROM contact_messages WHERE created_at > $1) + (SELECT COUNT(*) FROM reviews WHERE created_at > $1) AS count', [since]) : null,
  ]);
  const statusCounts = Object.fromEntries(byStatus.rows.map((row) => [row.status, row.count]));
  const processing = toShip.rows.map((row) => row.payload);
  const toPack = processing.filter((order) => !isOrderPacked(order));
  res.json({
    counts: {
      byStatus: statusCounts,
      total: byStatus.rows.reduce((sum, row) => sum + row.count, 0),
      toShip: statusCounts.processing || 0,
      toPack: toPack.length,
      readyToShip: processing.length - toPack.length,
      pendingRequests: requests.rows[0].count,
      newMessages: messages.rows[0].count,
      pendingQuestions: questions.rows[0].count,
    },
    toPack: toPack.slice(0, 8),
    recentSales: recent.rows.map((row) => ({ createdAt: row.created_at, total: row.total })),
    registeredCustomers: customers.rows[0].count,
    unread: unread ? Number(unread.rows[0].count) : 0,
  });
}));

// Newest first, 50 at a time. `cursor` is the last row's "createdAt|id".
app.get('/api/admin/orders', requireAdmin, asyncHandler(async (req, res) => {
  const { where, values } = orderFilters(req.query);
  const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM orders${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`, values);
  const pageWhere = [...where];
  const pageValues = [...values];
  const [cursorAt, cursorId] = String(req.query.cursor || '').split('|');
  if (cursorAt && cursorId && !Number.isNaN(Date.parse(cursorAt))) {
    pageValues.push(cursorAt, cursorId);
    pageWhere.push(`(created_at, id) < ($${pageValues.length - 1}::timestamptz, $${pageValues.length})`);
  }
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || ORDER_PAGE_SIZE, 1), 200);
  pageValues.push(limit + 1);
  const result = await pool.query(`SELECT payload, created_at FROM orders${pageWhere.length ? ` WHERE ${pageWhere.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT $${pageValues.length}`, pageValues);
  const rows = result.rows.slice(0, limit);
  const last = rows[rows.length - 1];
  res.json({
    orders: rows.map((row) => row.payload),
    total: countResult.rows[0].count,
    nextCursor: result.rows.length > limit && last ? `${new Date(last.created_at).toISOString()}|${last.payload.id}` : null,
  });
}));

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const sendCsv = (res, filename, rows) => {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`);
};

// Every matching order, not just the page on screen.
app.get('/api/admin/orders.csv', requireAdmin, asyncHandler(async (req, res) => {
  const { where, values } = orderFilters(req.query);
  const result = await pool.query(`SELECT payload FROM orders${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`, values);
  const rows = [['Order ID', 'Date', 'Customer', 'Email', 'Phone', 'Address', 'Status', 'Payment', 'Invoice', 'Coupon', 'Total', 'Refunded']];
  for (const { payload: o } of result.rows) rows.push([o.id, new Date(o.createdAt).toISOString().slice(0, 10), o.customer?.name, o.customer?.email, o.customer?.phone, o.customer?.address, o.status, o.paymentId || o.paymentMethod, o.invoice?.seller ? o.invoice.number : '', o.couponCode, o.total, o.refundedTotal || 0]);
  sendCsv(res, `orders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}));

app.get('/api/admin/orders/:id', requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT payload FROM orders WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Order not found.' });
  res.json(result.rows[0].payload);
}));

app.get('/api/admin/messages', requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, name, email, message, status, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 200');
  res.json({ messages: result.rows });
}));

app.patch('/api/admin/messages/:id', requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('UPDATE contact_messages SET status = $1 WHERE id = $2', [req.body?.status || 'read', req.params.id]);
  res.status(204).end();
}));

app.get('/api/admin/audit-logs', requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, admin_email, action, ip_address, created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 500');
  res.json({ logs: result.rows });
}));

// Registered accounts and guest shoppers in one list, with order counts and
// lifetime value worked out in the database. Paged, searchable, and exportable.
function customerQuery({ q, type }) {
  const values = [];
  const where = [];
  const text = String(q || '').trim();
  if (text) {
    values.push(`%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const i = values.length;
    const digits = text.replace(/\D/g, '');
    const clauses = [`name ILIKE $${i}`, `email ILIKE $${i}`];
    if (digits.length >= 4) { values.push(`%${digits}%`); clauses.push(`regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE $${values.length}`); }
    where.push(`(${clauses.join(' OR ')})`);
  }
  if (type === 'registered') where.push('account_id IS NOT NULL');
  if (type === 'guest') where.push('account_id IS NULL');
  const base = `
    WITH order_stats AS (
      SELECT lower(payload->'customer'->>'email') AS email,
             (array_agg(payload->'customer'->>'name' ORDER BY created_at DESC))[1] AS name,
             (array_agg(payload->'customer'->>'phone' ORDER BY created_at DESC))[1] AS phone,
             COUNT(*)::int AS orders,
             COALESCE(SUM(CASE WHEN payload->>'status' NOT IN ('pending_payment', 'cancelled') THEN (payload->>'total')::numeric - COALESCE((payload->>'refundedTotal')::numeric, 0) ELSE 0 END), 0)::float AS lifetime_value,
             MAX(created_at) AS last_order_at
      FROM orders WHERE payload->'customer'->>'email' IS NOT NULL GROUP BY 1
    ), people AS (
      SELECT c.id AS account_id, COALESCE(lower(c.email), s.email) AS email, COALESCE(c.name, s.name) AS name, COALESCE(c.phone, s.phone) AS phone,
             c.created_at AS joined_at, COALESCE(s.orders, 0) AS orders, COALESCE(s.lifetime_value, 0) AS lifetime_value, s.last_order_at
      FROM customers c FULL OUTER JOIN order_stats s ON lower(c.email) = s.email
    )
    SELECT * FROM people${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
  return { base, values };
}

app.get('/api/admin/customers', requireAdmin, asyncHandler(async (req, res) => {
  const { base, values } = customerQuery(req.query);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  const [page, counts] = await Promise.all([
    pool.query(`${base} ORDER BY lifetime_value DESC, last_order_at DESC NULLS LAST, email LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset]),
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(account_id)::int AS registered FROM (${base}) AS matching`, values),
  ]);
  res.json({ customers: page.rows, total: counts.rows[0].total, registered: counts.rows[0].registered });
}));

app.get('/api/admin/customers.csv', requireAdmin, asyncHandler(async (req, res) => {
  const { base, values } = customerQuery(req.query);
  const result = await pool.query(`${base} ORDER BY lifetime_value DESC, email`, values);
  const rows = [['Name', 'Email', 'Phone', 'Type', 'Joined', 'Orders', 'Lifetime value', 'Last order']];
  for (const c of result.rows) rows.push([c.name, c.email, c.phone, c.account_id ? 'Registered' : 'Guest', c.joined_at ? new Date(c.joined_at).toISOString().slice(0, 10) : '', c.orders, c.lifetime_value, c.last_order_at ? new Date(c.last_order_at).toISOString().slice(0, 10) : '']);
  sendCsv(res, `customers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}));

// Header search: a few orders and customers matching the text.
app.get('/api/admin/search', requireAdmin, asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ orders: [], customers: [] });
  const orderWhere = orderFilters({ q });
  const people = customerQuery({ q });
  const [orders, customers] = await Promise.all([
    pool.query(`SELECT payload FROM orders WHERE ${orderWhere.where.join(' AND ')} ORDER BY created_at DESC LIMIT 5`, orderWhere.values),
    pool.query(`${people.base} ORDER BY last_order_at DESC NULLS LAST LIMIT 5`, people.values),
  ]);
  res.json({ orders: orders.rows.map((row) => row.payload), customers: customers.rows });
}));

// Forgot password, without email: the admin creates a temporary password and
// gives it to the person (phone/WhatsApp). It works once, for 24 hours, and
// they must pick a new password straight after signing in. Their existing
// sessions are signed out.
async function setTemporaryPassword(table, sessionTable, sessionColumn, id) {
  const temporaryPassword = generateTempPassword();
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const result = await pool.query(
    `UPDATE ${table} SET password_hash = $1, must_change_password = true, temp_password_expires_at = $2 WHERE id = $3 RETURNING email`,
    [await bcrypt.hash(temporaryPassword, 12), expiresAt, id]
  );
  if (!result.rowCount) return null;
  await pool.query(`DELETE FROM ${sessionTable} WHERE ${sessionColumn} = $1`, [id]);
  return { temporaryPassword, expiresAt, email: result.rows[0].email };
}

app.post('/api/admin/customers/:id/temp-password', requireAdmin, asyncHandler(async (req, res) => {
  const issued = await setTemporaryPassword('customers', 'customer_sessions', 'customer_id', req.params.id);
  if (!issued) return res.status(404).json({ error: 'Customer not found.' });
  await pool.query('INSERT INTO admin_audit_logs (admin_email, action, ip_address) VALUES ($1, $2, $3)', [req.admin.email, `customer_temp_password:${issued.email}`, req.ip]);
  res.json(issued);
}));

app.post('/api/admin/staff/:id/temp-password', requireAdmin, requireOwner, asyncHandler(async (req, res) => {
  const target = await pool.query('SELECT role FROM admins WHERE id = $1', [req.params.id]);
  if (!target.rowCount) return res.status(404).json({ error: 'Admin not found.' });
  if (target.rows[0].role === 'owner') return res.status(400).json({ error: 'Change your own password under My account.' });
  const issued = await setTemporaryPassword('admins', 'sessions', 'admin_id', req.params.id);
  await pool.query('INSERT INTO admin_audit_logs (admin_email, action, ip_address) VALUES ($1, $2, $3)', [req.admin.email, `staff_temp_password:${issued.email}`, req.ip]);
  res.json(issued);
}));

app.post('/api/admin/media', requireAdmin, mediaUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'This file type isn\'t supported. Upload a JPEG, PNG, WebP or GIF photo, or an MP4, WebM or MOV video.' });
  const extension = MEDIA_TYPE_EXTENSIONS[req.file.mimetype];
  const safeName = `${req.file.filename}${extension}`;
  fs.renameSync(req.file.path, path.join(mediaDirectory, safeName));
  res.status(201).json({ url: `/media/${safeName}`, mediaType: req.file.mimetype });
});

app.get('/api/catalog', asyncHandler(async (req, res) => {
  const [productsResult, settingsResult, ratingsResult] = await Promise.all([
    pool.query('SELECT payload FROM products ORDER BY id'),
    pool.query('SELECT key, value FROM settings'),
    pool.query('SELECT product_id, ROUND(AVG(rating)::numeric, 1)::float AS rating, COUNT(*)::int AS count FROM reviews GROUP BY product_id'),
  ]);
  const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value]));
  const categories = Array.isArray(settings.categories) ? settings.categories : [];
  // Ratings shown to shoppers (and to Google via structured data) come only
  // from real submitted reviews, never from numbers stored on the product.
  const ratings = new Map(ratingsResult.rows.map((row) => [Number(row.product_id), row]));
  const products = productsResult.rows.map(({ payload }) => {
    const real = ratings.get(Number(payload.id));
    return { ...payload, rating: real ? real.rating : 0, reviewCount: real ? real.count : 0 };
  });
  res.json({ products, categories, settings });
}));

// Dynamic sitemap — generated from live data (products, published blog posts,
// city pages) instead of a static file, so nothing goes stale as the catalog,
// blog, or location coverage grows. Vite's dev proxy forwards /sitemap.xml
// here too (see vite.config.js) so it works identically in dev and prod.
app.get('/sitemap.xml', asyncHandler(async (req, res) => {
  const [productsResult, postsResult] = await Promise.all([
    pool.query('SELECT slug, updated_at FROM products ORDER BY id'),
    pool.query(`SELECT slug, updated_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC`),
  ]);
  const base = SITE_CONFIG.siteUrl;
  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/shop', priority: '0.9', changefreq: 'weekly' },
    { loc: '/blog', priority: '0.7', changefreq: 'weekly' },
    { loc: '/shipping', priority: '0.6', changefreq: 'monthly' },
    { loc: '/about', priority: '0.5', changefreq: 'monthly' },
    { loc: '/faq', priority: '0.5', changefreq: 'monthly' },
    { loc: '/contact', priority: '0.4', changefreq: 'monthly' },
    ...productsResult.rows.map((p) => ({ loc: `/product/${p.slug}`, priority: '0.8', changefreq: 'weekly', lastmod: p.updated_at })),
    ...postsResult.rows.map((p) => ({ loc: `/blog/${p.slug}`, priority: '0.6', changefreq: 'monthly', lastmod: p.updated_at })),
    ...CITIES.map((c) => ({ loc: `/shipping/${c.slug}`, priority: '0.5', changefreq: 'monthly' })),
  ];
  const body = urls.map((u) => {
    const lastmod = u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : '';
    return `  <url><loc>${base}${u.loc}</loc>${lastmod}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`;
  }).join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
}));

app.post('/api/contact', asyncHandler(async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name?.trim() || !email?.trim() || !message?.trim()) return res.status(400).json({ error: 'Name, email and message are required.' });
  if (!contactLimiter.consume(req.ip)) return res.status(429).json({ error: 'Too many messages sent. Please try again shortly.' });
  await pool.query('INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)', [name.trim(), email.trim(), message.trim()]);
  sendMail({ to: SITE_CONFIG.email, subject: `New contact message from ${name.trim()}`, text: `${message.trim()}\n\nFrom: ${name.trim()} <${email.trim()}>` });
  res.status(201).json({ received: true });
}));

app.get('/api/products/:id/reviews', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, name, rating, comment, created_at FROM reviews WHERE product_id = $1 ORDER BY created_at DESC', [req.params.id]);
  res.json({ reviews: result.rows });
}));

app.post('/api/products/:id/reviews', asyncHandler(async (req, res) => {
  const { name, rating, comment } = req.body || {};
  const numericRating = Number(rating);
  if (!name?.trim() || !comment?.trim() || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: 'Name, a 1-5 star rating, and a comment are required.' });
  }
  if (!reviewLimiter.consume(req.ip)) return res.status(429).json({ error: 'Too many reviews submitted. Please try again shortly.' });
  const productId = Number(req.params.id);
  const productExists = await pool.query('SELECT 1 FROM products WHERE id = $1', [productId]);
  if (!productExists.rowCount) return res.status(404).json({ error: 'Product not found.' });
  const result = await pool.query(
    'INSERT INTO reviews (product_id, name, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id, name, rating, comment, created_at',
    [productId, name.trim(), numericRating, comment.trim()]
  );
  res.status(201).json(result.rows[0]);
}));

app.get('/api/admin/reviews', requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, product_id, name, rating, comment, created_at FROM reviews ORDER BY created_at DESC LIMIT 500');
  res.json({ reviews: result.rows });
}));

app.delete('/api/admin/reviews/:id', requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

app.get('/api/products/:id/questions', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, question, answer, asked_name, created_at, answered_at FROM product_questions WHERE product_id = $1 AND status = 'answered' ORDER BY answered_at DESC`,
    [req.params.id]
  );
  res.json({ questions: result.rows });
}));

app.post('/api/products/:id/questions', asyncHandler(async (req, res) => {
  const { question, askedName } = req.body || {};
  if (!question?.trim() || !askedName?.trim()) return res.status(400).json({ error: 'Your name and a question are required.' });
  if (!reviewLimiter.consume(req.ip)) return res.status(429).json({ error: 'Too many questions submitted. Please try again shortly.' });
  const productId = Number(req.params.id);
  const productExists = await pool.query('SELECT 1 FROM products WHERE id = $1', [productId]);
  if (!productExists.rowCount) return res.status(404).json({ error: 'Product not found.' });
  const result = await pool.query(
    'INSERT INTO product_questions (product_id, question, asked_name) VALUES ($1, $2, $3) RETURNING id',
    [productId, question.trim(), askedName.trim()]
  );
  res.status(201).json({ id: result.rows[0].id, received: true });
}));

app.get('/api/admin/questions', requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, product_id, question, answer, asked_name, status, created_at, answered_at FROM product_questions ORDER BY created_at DESC');
  res.json({ questions: result.rows });
}));

app.patch('/api/admin/questions/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { answer } = req.body || {};
  if (!answer?.trim()) return res.status(400).json({ error: 'An answer is required.' });
  const result = await pool.query(
    `UPDATE product_questions SET answer = $1, status = 'answered', answered_at = NOW() WHERE id = $2 RETURNING id, product_id, question, answer, asked_name, status, created_at, answered_at`,
    [answer.trim(), req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Question not found.' });
  res.json(result.rows[0]);
}));

app.delete('/api/admin/questions/:id', requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM product_questions WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

const BLOG_POST_COLUMNS = 'id, slug, title, excerpt, content, cover_image, seo_title, seo_description, status, published_at, created_at, updated_at';

app.get('/api/blog', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, slug, title, excerpt, cover_image, published_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 100`
  );
  res.json({ posts: result.rows });
}));

app.get('/api/blog/:slug', asyncHandler(async (req, res) => {
  const result = await pool.query(`SELECT ${BLOG_POST_COLUMNS} FROM blog_posts WHERE slug = $1 AND status = 'published'`, [req.params.slug]);
  if (!result.rowCount) return res.status(404).json({ error: 'Post not found.' });
  res.json(result.rows[0]);
}));

app.get('/api/admin/blog', requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query(`SELECT ${BLOG_POST_COLUMNS} FROM blog_posts ORDER BY updated_at DESC`);
  res.json({ posts: result.rows });
}));

app.post('/api/admin/blog', requireAdmin, asyncHandler(async (req, res) => {
  const { title, excerpt = '', content = '', coverImage, seoTitle, seoDescription, status = 'draft' } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
  const slug = req.body.slug || title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const publishedAt = status === 'published' ? new Date().toISOString() : null;
  const result = await pool.query(
    `INSERT INTO blog_posts (slug, title, excerpt, content, cover_image, seo_title, seo_description, status, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${BLOG_POST_COLUMNS}`,
    [slug, title.trim(), excerpt, content, coverImage || null, seoTitle || null, seoDescription || null, status, publishedAt]
  );
  res.status(201).json(result.rows[0]);
}));

app.put('/api/admin/blog/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await pool.query('SELECT status, published_at FROM blog_posts WHERE id = $1', [req.params.id]);
  if (!existing.rowCount) return res.status(404).json({ error: 'Post not found.' });
  const { title, excerpt = '', content = '', coverImage, seoTitle, seoDescription, status = 'draft', slug } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
  // Set published_at the first time a post goes live; keep the original date on later edits.
  const publishedAt = status === 'published' ? (existing.rows[0].published_at || new Date().toISOString()) : existing.rows[0].published_at;
  const result = await pool.query(
    `UPDATE blog_posts SET slug = $1, title = $2, excerpt = $3, content = $4, cover_image = $5, seo_title = $6, seo_description = $7, status = $8, published_at = $9, updated_at = NOW()
     WHERE id = $10 RETURNING ${BLOG_POST_COLUMNS}`,
    [slug, title.trim(), excerpt, content, coverImage || null, seoTitle || null, seoDescription || null, status, publishedAt, req.params.id]
  );
  res.json(result.rows[0]);
}));

app.delete('/api/admin/blog/:id', requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM blog_posts WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

app.put('/api/admin/products/:id', requireAdmin, asyncHandler(async (req, res) => {
  const product = { ...req.body, id: Number(req.params.id) };
  await pool.query('INSERT INTO products (id, slug, payload, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT(id) DO UPDATE SET slug = EXCLUDED.slug, payload = EXCLUDED.payload, updated_at = NOW()', [product.id, product.slug, product]);
  res.json(product);
}));

app.post('/api/admin/products', requireAdmin, asyncHandler(async (req, res) => {
  const id = Date.now();
  const product = { ...req.body, id, slug: req.body.slug || String(req.body.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') };
  await pool.query('INSERT INTO products (id, slug, payload) VALUES ($1, $2, $3)', [id, product.slug, product]);
  res.status(201).json(product);
}));

app.delete('/api/admin/products/:id', requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

const UNSHIPPED_STATUSES = new Set(['pending_payment', 'processing']);

app.post('/api/admin/orders/:id/refunds', requireAdmin, asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT payload FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found.' }); }
    const { amount, method, reference, note, restock } = req.body || {};
    const updated = await recordRefund(client, result.rows[0].payload, { amount, method, reference, note, restock: Boolean(restock), by: req.admin.email });
    await client.query('UPDATE orders SET payload = $1 WHERE id = $2', [updated, req.params.id]);
    const latest = updated.refunds[updated.refunds.length - 1];
    await client.query('INSERT INTO admin_audit_logs (admin_email, action, ip_address) VALUES ($1, $2, $3)', [req.admin.email, `refund_recorded:${updated.id}:${latest.amount}:${latest.method}${latest.creditNote ? `:${latest.creditNote.number}` : ''}`, req.ip]);
    await client.query('COMMIT');
    if (updated.customer?.email) sendMail({ to: updated.customer.email, subject: `Refund for order ${updated.id}`, text: `We've refunded ${formatMoney(latest.amount)} for order ${updated.id}${latest.method === 'razorpay' ? ' to your original payment method. It usually reaches your account in 5–7 working days' : ''}.${latest.creditNote ? ` Credit note: ${latest.creditNote.number}.` : ''}` });
    res.status(201).json(updated);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

function sendCreditNotePage(res, order, refundId) {
  const refund = (order.refunds || []).find((item) => item.id === refundId);
  res.set('Cache-Control', 'private, no-store');
  if (!refund?.creditNote) return res.status(404).type('text').send('Credit note not found.');
  res.type('html').send(renderCreditNoteHtml(refund.creditNote));
}

app.get('/api/admin/orders/:id/refunds/:refundId/credit-note', requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT payload FROM orders WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).type('text').send('Order not found.');
  sendCreditNotePage(res, result.rows[0].payload, req.params.refundId);
}));

app.get('/api/orders/:id/refunds/:refundId/credit-note', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT payload FROM orders WHERE id = $1', [req.params.id]);
  if (!result.rowCount || !canAccessOrder(req, result.rows[0].payload)) return res.status(404).type('text').send('Order not found.');
  sendCreditNotePage(res, result.rows[0].payload, req.params.refundId);
}));

app.patch('/api/admin/orders/:id', requireAdmin, asyncHandler(async (req, res) => {
  const client = await pool.connect();
  let previous;
  let order;
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT payload FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found.' }); }
    previous = result.rows[0].payload;
    // An issued invoice is a legal record and the access-token hash guards the
    // shopper's link: neither can be overwritten through a status update.
    // Refund records change only through the refunds route below.
    const { invoice: _invoice, accessTokenHash: _accessTokenHash, stockReleased: _stockReleased, refunds: _refunds, refundedTotal: _refundedTotal, paymentStatus: _paymentStatus, statusHistory: _statusHistory, ...changes } = req.body || {};
    order = { ...previous, ...changes };
    const wasCancelled = previous.status === 'cancelled';
    const isCancelled = order.status === 'cancelled';

    // Customer timeline: when the order ships or is delivered, move its items
    // along with it, and stamp every change so tracking can show dates.
    const now = new Date().toISOString();
    if (order.status !== previous.status) {
      const itemStatus = { shipped: 'shipped', delivered: 'delivered' }[order.status];
      if (itemStatus) order.items = (order.items || []).map((item) => (['returned', 'delivered', itemStatus].includes(item.fulfillmentStatus) ? item : { ...item, fulfillmentStatus: itemStatus }));
      if (order.status === 'delivered') order = addHistory(order, 'shipped', now);
      if (['shipped', 'delivered', 'cancelled'].includes(order.status)) order = addHistory(order, order.status, now);
    }
    const sameItem = (a, b) => a.id === b.id && (a.size || null) === (b.size || null);
    order.items = (order.items || []).map((item) => {
      const before = (previous.items || []).find((candidate) => sameItem(candidate, item));
      return before && (before.fulfillmentStatus || 'pending') !== (item.fulfillmentStatus || 'pending') ? { ...item, fulfillmentUpdatedAt: now } : item;
    });
    if (order.items.length && order.items.every((item) => ['packed', 'shipped', 'delivered'].includes(item.fulfillmentStatus))) order = addHistory(order, 'packed', now);

    // Cancelling before dispatch puts the stock back. (After dispatch the
    // goods are with the courier; the returns flow handles those.)
    if (!wasCancelled && isCancelled) {
      order.cancelledAt = new Date().toISOString();
      order.cancelReason = order.cancelReason || 'cancelled_by_admin';
      if (UNSHIPPED_STATUSES.has(previous.status) && !previous.stockReleased) {
        await restoreStock(client, previous.items);
        order.stockReleased = true;
      }
    }

    // Reopening a cancelled order: only if it was actually paid, and only if
    // its stock can be set aside again.
    if (wasCancelled && !isCancelled) {
      const wasPaid = Boolean(previous.paymentId) || previous.paymentMethod === 'demo';
      if (!wasPaid) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'This order was never paid, so it can’t be reopened. Ask the customer to place a new order.' });
      }
      if (previous.stockReleased || previous.cancelReason === 'payment_timeout') {
        await reserveStockAndPrice(client, (previous.items || []).map(({ id, qty, size }) => ({ id, qty, size })));
      }
      order.stockReleased = false;
      delete order.cancelReason;
      delete order.cancelledAt;
    }

    // Approving a customer's refund request: refund what's left through
    // Razorpay when the order was paid there; otherwise (or if Razorpay
    // refuses) flag it so the admin refunds by hand and records it.
    if (order.refundRequest?.status === 'approved' && previous.refundRequest?.status !== 'approved') {
      const remaining = roundMoney(Number(order.total) - (order.refundedTotal || 0));
      const viaRazorpay = order.paymentId && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && remaining > 0;
      if (viaRazorpay) {
        try {
          order = await recordRefund(client, order, { amount: remaining, method: 'razorpay', note: order.refundRequest.reason, by: req.admin.email });
        } catch (error) {
          if (error.statusCode !== 502) throw error;
          order.refundRequest = { ...order.refundRequest, refundState: 'manual_required' };
        }
      } else {
        order.refundRequest = { ...order.refundRequest, refundState: 'manual_required' };
      }
    }
    await client.query('UPDATE orders SET payload = $1 WHERE id = $2', [order, req.params.id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Notify the customer on the transitions they actually care about.
  if (order.customer?.email) {
    if (req.body.status === 'shipped' && previous.status !== 'shipped') {
      sendMail({ to: order.customer.email, subject: `Your order ${order.id} has shipped`, text: `Good news — your order is on the way.${order.trackingNumber ? ` Tracking (${order.carrier || 'courier'}): ${order.trackingNumber}${order.trackingUrl ? ` — ${order.trackingUrl}` : ''}` : ''}` });
    }
    if (req.body.returnRequest?.status && ['approved', 'rejected'].includes(req.body.returnRequest.status) && previous.returnRequest?.status !== req.body.returnRequest.status) {
      sendMail({ to: order.customer.email, subject: `Update on your return request — order ${order.id}`, text: `Your return request has been ${req.body.returnRequest.status}.` });
    }
    if (req.body.refundRequest?.status && ['approved', 'rejected'].includes(req.body.refundRequest.status) && previous.refundRequest?.status !== req.body.refundRequest.status) {
      sendMail({ to: order.customer.email, subject: `Update on your refund request — order ${order.id}`, text: `Your refund request has been ${req.body.refundRequest.status}.` });
    }
  }

  res.json(order);
}));

app.put('/api/admin/settings', requireAdmin, requireOwner, asyncHandler(async (req, res) => {
  // Settings that print on invoices or show to shoppers are checked here, so
  // a typo can't reach an invoice. Errors come back per field.
  const incoming = { ...(req.body || {}) };
  const fields = {};
  if ('business' in incoming) {
    const { business, errors } = validateBusinessSettings(incoming.business || {});
    incoming.business = business;
    for (const [key, message] of Object.entries(errors)) fields[`business.${key}`] = message;
  }
  if ('policies' in incoming) {
    const { policies, errors } = validatePolicySettings(incoming.policies || {});
    incoming.policies = policies;
    for (const [key, message] of Object.entries(errors)) fields[`policies.${key}`] = message;
  }
  if ('whatsapp' in incoming) {
    const raw = String(incoming.whatsapp || '').trim();
    incoming.whatsapp = raw ? normalizeWhatsAppNumber(raw) : '';
    if (raw && !incoming.whatsapp) fields.whatsapp = 'Enter a 10-digit mobile number, or include the country code (+65 …).';
  }
  if ('supportEmail' in incoming) {
    incoming.supportEmail = String(incoming.supportEmail || '').trim().toLowerCase();
    if (incoming.supportEmail && !EMAIL_PATTERN.test(incoming.supportEmail)) fields.supportEmail = 'Enter a valid email address.';
  }
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Some settings need fixing before they can be saved.', fields });
  // pg serializes a bare JS array as a Postgres array literal ("{a,b,c}"),
  // not JSON, which then fails against this jsonb column — explicitly
  // JSON.stringify + cast so both array and object setting values work.
  for (const [key, value] of Object.entries(incoming)) await pool.query('INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', [key, JSON.stringify(value)]);
  res.json(incoming);
}));

app.post('/api/coupons/validate', asyncHandler(async (req, res) => {
  const { code, subtotal } = req.body || {};
  const numericSubtotal = Number(subtotal);
  if (!Number.isFinite(numericSubtotal) || numericSubtotal < 0) return res.status(400).json({ error: 'A valid subtotal is required.' });
  try {
    const result = await resolveCoupon(pool, code, numericSubtotal);
    if (!result) return res.status(400).json({ error: 'Enter a coupon code.' });
    res.json({ valid: true, code: result.coupon.code, discountAmount: result.discountAmount });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.get('/api/admin/coupons', requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
  res.json({ coupons: result.rows });
}));

app.post('/api/admin/coupons', requireAdmin, asyncHandler(async (req, res) => {
  const { code, type, value, minSubtotal = 0, maxUses, expiresAt } = req.body || {};
  if (!code?.trim() || !['percent', 'fixed'].includes(type) || !(Number(value) > 0)) {
    return res.status(400).json({ error: 'Code, type (percent/fixed), and a positive value are required.' });
  }
  const result = await pool.query(
    'INSERT INTO coupons (code, type, value, min_subtotal, max_uses, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [code.trim().toUpperCase(), type, Number(value), Number(minSubtotal) || 0, maxUses ? Number(maxUses) : null, expiresAt || null]
  );
  res.status(201).json(result.rows[0]);
}));

app.patch('/api/admin/coupons/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { active } = req.body || {};
  const result = await pool.query('UPDATE coupons SET active = $1 WHERE id = $2 RETURNING *', [!!active, req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Coupon not found.' });
  res.json(result.rows[0]);
}));

app.delete('/api/admin/coupons/:id', requireAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM coupons WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

// --- Checkout ---
// Two-step flow so an order is persisted (as `pending_payment`) BEFORE the
// payment gateway opens: if the network drops or the tab closes mid-payment,
// the order still exists for the admin to see and reconcile instead of
// vanishing. Stock is reserved atomically at this step (row-locked) so two
// concurrent checkouts can never both sell the last unit; abandoned reservations
// are released by releaseExpiredPendingOrders() after 30 minutes.
// Optional — checkout works identically for a guest. If a customer session
// cookie is present and valid, the order gets linked to that account so it
// shows up in /account without changing anything about the guest flow.
async function resolveOptionalCustomerId(req) {
  const token = parseCookie(req.headers.cookie)[customerCookieName];
  if (!token) return null;
  const result = await pool.query('SELECT customer_id FROM customer_sessions WHERE token_hash = $1 AND expires_at > NOW()', [hashToken(token)]);
  return result.rows[0]?.customer_id || null;
}

app.post('/api/checkout/init', asyncHandler(async (req, res) => {
  const { items, customer, couponCode } = req.body || {};
  // Same rules the checkout form applies, enforced here so nothing bypasses them.
  const { address: shippingAddress, errors } = validateAddress(customer?.shippingAddress || {}, SHIP_COUNTRIES);
  const email = String(customer?.email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';
  if (Object.keys(errors).length) return res.status(400).json({ error: firstError(errors), fields: errors });
  const customerId = await resolveOptionalCustomerId(req);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const normalizedItems = await reserveStockAndPrice(client, items);
    const pricing = await getPricingSettings(client);
    const rawSubtotal = normalizedItems.reduce((sum, item) => sum + (Number(item.price) + Number(item.addonsTotal || 0)) * Number(item.qty), 0);
    let couponResult = null;
    if (couponCode) {
      try {
        // Locks the coupon row for the rest of this transaction so two
        // concurrent checkouts can't both slip in under a max_uses cap.
        couponResult = await resolveCoupon(client, couponCode, rawSubtotal, { lock: true });
      } catch (error) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: error.message });
      }
    }
    const totals = calculateOrderTotals({ items: normalizedItems, taxRatePercent: pricing.taxRatePercent, shippingFee: pricing.shippingFee, freeShippingThreshold: pricing.freeShippingThreshold, discountAmount: couponResult?.discountAmount || 0 });
    if (couponResult) await client.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = $1', [couponResult.coupon.id]);

    const newOrderId = generateOrderId();
    let gatewayOrder = null;
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const response = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Math.round(totals.total * 100), currency: process.env.RAZORPAY_CURRENCY || SITE_CONFIG.currency, receipt: newOrderId }) });
      if (!response.ok) { await client.query('ROLLBACK'); return res.status(502).json({ error: 'Payment provider could not create an order.' }); }
      gatewayOrder = await response.json();
    } else if (!allowDemoCheckout) {
      await client.query('ROLLBACK');
      return res.status(503).json({ error: 'Live payment gateway is not configured.' });
    }

    const accessToken = crypto.randomBytes(24).toString('hex');
    const status = gatewayOrder ? 'pending_payment' : 'processing';
    const order = {
      id: newOrderId,
      createdAt: new Date().toISOString(),
      status,
      paymentMethod: gatewayOrder ? 'razorpay' : 'demo',
      gatewayOrderId: gatewayOrder?.id || null,
      customerId,
      // `address` (formatted text) and `phone` stay top-level for the admin,
      // invoices and order lookup; `shippingAddress` keeps the parts.
      customer: { name: shippingAddress.name, email, phone: shippingAddress.phone, address: formatAddress(shippingAddress), shippingAddress },
      items: normalizedItems,
      subtotal: totals.subtotal,
      discount: totals.discount,
      couponCode: couponResult?.coupon.code || null,
      tax: totals.tax,
      taxRatePercent: pricing.taxRatePercent,
      shipping: totals.shipping,
      total: totals.total,
      accessTokenHash: hashToken(accessToken),
    };
    // Online payments get their invoice when payment is confirmed. Demo
    // checkout (local development only) has no payment step, so it's issued now.
    order.statusHistory = [{ status: 'placed', at: order.createdAt }];
    const storedOrder = status === 'processing' ? await issueInvoice(client, addHistory({ ...order, paidAt: order.createdAt }, 'paid', order.createdAt)) : order;
    await client.query('INSERT INTO orders (id, payload, created_at) VALUES ($1, $2, $3)', [order.id, storedOrder, order.createdAt]);
    await client.query('COMMIT');

    if (status === 'processing') sendMail(orderConfirmationEmail(storedOrder, accessToken));

    res.status(201).json({
      orderId: order.id,
      accessToken,
      status: order.status,
      requiresPayment: !!gatewayOrder,
      gatewayOrderId: gatewayOrder?.id,
      amount: gatewayOrder ? Math.round(totals.total * 100) : undefined,
      currency: process.env.RAZORPAY_CURRENCY || SITE_CONFIG.currency,
      total: totals.total,
      discount: totals.discount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

function verifyRazorpaySignature(gatewayOrderId, paymentId, signature) {
  if (!gatewayOrderId || !paymentId || !signature || !process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${gatewayOrderId}|${paymentId}`).digest('hex');
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

app.post('/api/checkout/:id/confirm', asyncHandler(async (req, res) => {
  const { paymentId, signature } = req.body || {};
  const accessToken = orderAccessToken(req);
  const result = await pool.query('SELECT payload FROM orders WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Order not found.' });
  const order = result.rows[0].payload;
  if (!accessToken || hashToken(accessToken) !== order.accessTokenHash) return res.status(403).json({ error: 'Order access token is required.' });
  if (order.status !== 'pending_payment') return res.status(409).json({ error: `Order is already ${order.status}.` });
  const { order: latest, confirmed } = await markOrderPaid(order.id, paymentId, signature);
  if (!confirmed) {
    if (latest?.status !== 'pending_payment') return res.status(409).json({ error: `Order is already ${latest?.status}.` });
    return res.status(402).json({ error: 'Payment could not be verified. The order was not confirmed.' });
  }
  sendMail(orderConfirmationEmail(latest, accessToken));
  res.json({ id: latest.id, status: latest.status, invoiceNumber: latest.invoice.number });
}));

// Target of Razorpay's hosted Checkout redirect (`redirect: true` +
// `callback_url` in CheckoutModal). Razorpay POSTs the payment result here as
// a full-page browser navigation — away from and back to the site — instead
// of the JS `handler` callback used by the in-page popup. We verify the
// signature the same way as /confirm, then 302 the browser to a page it can
// render; the order is left as `pending_payment` (not lost) if verification
// fails, exactly as an abandoned popup checkout would.
app.post('/api/checkout/:id/callback', asyncHandler(async (req, res) => {
  const accessToken = orderAccessToken(req);
  const frontendOrigin = process.env.PUBLIC_SITE_URL || SITE_CONFIG.siteUrl;
  const result = await pool.query('SELECT payload FROM orders WHERE id = $1', [req.params.id]);
  if (!result.rowCount || !accessToken || hashToken(accessToken) !== result.rows[0].payload.accessTokenHash) {
    return res.redirect(303, `${frontendOrigin}/order-success?order=${encodeURIComponent(req.params.id)}`);
  }
  const order = result.rows[0].payload;
  const { razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};

  if (order.status === 'pending_payment') {
    const { order: latest, confirmed } = await markOrderPaid(order.id, paymentId, signature);
    if (confirmed) sendMail(orderConfirmationEmail(latest, accessToken));
  }
  res.redirect(303, `${frontendOrigin}/order-success?order=${encodeURIComponent(order.id)}&access=${encodeURIComponent(accessToken)}`);
}));

app.get('/api/orders/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT payload FROM orders WHERE id = $1', [req.params.id]);
  if (!result.rowCount || !canAccessOrder(req, result.rows[0].payload)) return res.status(404).json({ error: 'Order not found.' });
  const order = result.rows[0].payload;
  const view = publicOrderView(order);
  res.json({ id: order.id, status: order.status, statusHistory: view.statusHistory, items: view.items, subtotal: order.subtotal, discount: order.discount, couponCode: order.couponCode, tax: order.tax, shipping: order.shipping, total: order.total, invoice: order.invoice, carrier: order.carrier, trackingNumber: order.trackingNumber, trackingUrl: order.trackingUrl, returnRequest: order.returnRequest, refundRequest: order.refundRequest });
}));

// Invoice page for the shopper, via the order's private access link.
app.get('/api/orders/:id/invoice', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT payload FROM orders WHERE id = $1', [req.params.id]);
  if (!result.rowCount || !canAccessOrder(req, result.rows[0].payload)) return res.status(404).type('text').send('Order not found.');
  sendInvoicePage(res, result.rows[0].payload);
}));

// Invoice page for a signed-in customer (their Account page), matched by email
// the same way /api/customer/orders is.
app.get('/api/customer/orders/:id/invoice', requireCustomer, asyncHandler(async (req, res) => {
  const result = await pool.query(`SELECT payload FROM orders WHERE id = $1 AND lower(payload->'customer'->>'email') = $2`, [req.params.id, req.customer.email.toLowerCase()]);
  if (!result.rowCount) return res.status(404).type('text').send('Order not found.');
  sendInvoicePage(res, result.rows[0].payload);
}));

app.get('/api/admin/orders/:id/invoice', requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT payload FROM orders WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).type('text').send('Order not found.');
  sendInvoicePage(res, result.rows[0].payload);
}));

// For orders paid before invoices were issued automatically: lets the admin
// issue one. Refuses orders that were never paid.
app.post('/api/admin/orders/:id/invoice', requireAdmin, asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT payload FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    const order = result.rows[0]?.payload;
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found.' }); }
    const paid = Boolean(order.paymentId) || (order.paymentMethod === 'demo' && order.status !== 'cancelled');
    if (!paid) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This order was never paid, so it can’t have an invoice.' }); }
    const invoiced = await issueInvoice(client, { ...order, paidAt: order.paidAt || order.createdAt });
    await client.query('UPDATE orders SET payload = $1 WHERE id = $2', [invoiced, order.id]);
    await client.query('INSERT INTO admin_audit_logs (admin_email, action, ip_address) VALUES ($1, $2, $3)', [req.admin.email, `invoice_issued:${invoiced.invoice.number}`, req.ip]);
    await client.query('COMMIT');
    res.json(invoiced);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/orders/lookup', asyncHandler(async (req, res) => {
  // Email plus proof it's really them: the mobile number (shows all their
  // orders), an order number, or the courier's tracking number (each shows
  // just that order). Email alone would let anyone who knows an address see
  // someone's home address and purchases.
  // `proof` is the single field on Track Order; it may be any of the three, so
  // every reading of it is tried. `phone` / `reference` are the older fields.
  const { email, phone, reference, proof } = req.body || {};
  const proofText = String(proof ?? '').trim();
  const phoneText = String(phone ?? proofText);
  const refText = String(reference ?? proofText).trim().toUpperCase();
  const hasPhone = phoneText.replace(/\D/g, '').length >= 8;
  // Couriers print AWBs with spaces or dashes; compare letters and digits only.
  const trackingRef = refText.replace(/[^A-Z0-9]/g, '');
  if (!email?.trim() || (!hasPhone && !refText)) return res.status(400).json({ error: 'Enter your email and your mobile number, order number or courier tracking number.' });
  if (!lookupLimiter.consume(`${req.ip}:${email.trim().toLowerCase()}`)) return res.status(429).json({ error: 'Too many lookup attempts. Try again later.' });
  const values = [email.trim().toLowerCase()];
  const matches = [];
  // The phone may be typed with or without +91 / a leading 0; match any reading of it.
  if (hasPhone) { values.push(phoneCandidates(phoneText)); matches.push(`regexp_replace(payload->'customer'->>'phone', '\\D', '', 'g') = ANY($${values.length}::text[])`); }
  if (refText) {
    values.push(refText.startsWith('ARC-') ? refText : `ARC-${refText}`);
    matches.push(`id = $${values.length}`);
  }
  if (trackingRef.length >= 6) {
    values.push(trackingRef);
    matches.push(`regexp_replace(upper(payload->>'trackingNumber'), '[^A-Z0-9]', '', 'g') = $${values.length}`);
  }
  const query = `SELECT payload FROM orders WHERE lower(payload->'customer'->>'email') = $1 AND (${matches.join(' OR ')}) ORDER BY created_at DESC LIMIT 50`;
  const result = await pool.query(query, values);
  // Each order carries a 2-hour pass for its invoice and return request.
  res.json({ orders: result.rows.map(({ payload }) => ({ ...publicOrderView(payload), trackToken: signTrackToken(payload.id) })) });
}));

app.post('/api/orders/:id/requests', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT payload FROM orders WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Order not found.' });
  const order = result.rows[0].payload;
  if (!canAccessOrder(req, order)) return res.status(403).json({ error: 'Find your order again on Track Order to make this request.' });
  const { type, reason } = req.body || {};
  if (!['return', 'refund'].includes(type) || !reason?.trim()) return res.status(400).json({ error: 'Choose a request type and tell us the reason.' });
  const paid = Boolean(order.paymentId) || order.paymentMethod === 'demo';
  if (type === 'return' && order.status !== 'delivered') return res.status(409).json({ error: 'A return can be requested once the order has been delivered.' });
  if (type === 'refund' && !paid) return res.status(409).json({ error: 'This order was not paid, so there is nothing to refund.' });
  const key = type === 'return' ? 'returnRequest' : 'refundRequest';
  if (order[key] && order[key].status !== 'rejected') return res.status(409).json({ error: `A ${type} request for this order is already ${order[key].status}.` });
  const request = { type, reason: reason.trim().slice(0, 1000), status: 'pending', requestedAt: new Date().toISOString() };
  const nextOrder = { ...order, [key]: request };
  await pool.query('UPDATE orders SET payload = $1 WHERE id = $2', [nextOrder, req.params.id]);
  res.status(201).json(request);
}));

app.post('/api/webhooks/courier', asyncHandler(async (req, res) => {
  const suppliedSecret = req.headers['x-courier-webhook-secret'];
  if (!process.env.COURIER_WEBHOOK_SECRET || suppliedSecret !== process.env.COURIER_WEBHOOK_SECRET) return res.status(401).json({ error: 'Invalid courier webhook signature.' });
  const { orderId, trackingNumber, trackingUrl, carrier, status } = req.body || {};
  if (!orderId || !status) return res.status(400).json({ error: 'orderId and status are required.' });
  const result = await pool.query('SELECT payload FROM orders WHERE id = $1', [orderId]);
  if (!result.rowCount) return res.status(404).json({ error: 'Order not found.' });
  const previous = result.rows[0].payload;
  const order = { ...previous, status, carrier: carrier || previous.carrier, trackingNumber: trackingNumber || previous.trackingNumber, trackingUrl: trackingUrl || previous.trackingUrl };
  await pool.query('UPDATE orders SET payload = $1 WHERE id = $2', [order, orderId]);
  if (order.customer?.email && status === 'shipped' && previous.status !== 'shipped') {
    sendMail({ to: order.customer.email, subject: `Your order ${order.id} has shipped`, text: `Good news — your order is on the way.${order.trackingNumber ? ` Tracking (${order.carrier || 'courier'}): ${order.trackingNumber}${order.trackingUrl ? ` — ${order.trackingUrl}` : ''}` : ''}` });
  }
  res.json({ id: orderId, status: order.status });
}));

// Single-host deploys: when `npm run build` has produced dist/, this server
// also serves the storefront, falling back to index.html for client routes.
// A static host (Netlify, Cloudflare Pages…) in front of the API also works —
// then dist/ is simply absent here.
const distDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(path.join(distDirectory, 'index.html'))) {
  app.use('/assets', express.static(path.join(distDirectory, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(distDirectory, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/|media\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDirectory, 'index.html'));
  });
}

// Postgres unique-constraint violations (code 23505) are the admin's input
// clashing with an existing row, not a server fault: say which field clashed.
const DUPLICATE_MESSAGES = {
  products_slug_key: 'Another product already uses this web address. Change the product name or its URL slug.',
  coupons_code_key: 'A coupon with this code already exists.',
  blog_posts_slug_key: 'Another blog post already uses this URL slug.',
};

app.use((error, req, res, next) => {
  if (error.code === '23505') return res.status(409).json({ error: DUPLICATE_MESSAGES[error.constraint] || 'This already exists.' });
  console.error(error);
  res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Internal server error.' });
});

initDatabase().then(() => {
  const server = app.listen(port, () => console.log(`Barani's Couture PostgreSQL API listening on http://localhost:${port}`));
  // Node's default 5-minute request timeout would cut off a large video
  // upload on a slow connection; give uploads up to 30 minutes.
  server.requestTimeout = 30 * 60 * 1000;
  releaseExpiredPendingOrders().catch((error) => console.error('Startup cleanup of expired orders failed:', error.message));
  setInterval(() => releaseExpiredPendingOrders().catch((error) => console.error('Cleanup of expired orders failed:', error.message)), 10 * 60 * 1000).unref?.();
  setInterval(() => pool.query('DELETE FROM sessions WHERE expires_at < NOW()').catch(() => {}), 60 * 60 * 1000).unref?.();
}).catch((error) => {
  console.error('Database initialization failed:', error.message);
  process.exitCode = 1;
});
