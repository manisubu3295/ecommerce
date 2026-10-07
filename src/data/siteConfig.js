// Central site facts reused by every page's SEO tags, JSON-LD and the footer.
export const SITE_CONFIG = {
  name: "Barani's Couture",
  legalName: "Barani's Couture",
  domain: 'baraniscouture.com',
  tagline: 'Cinematic and traditional fashion, reconstructed for today.',
  // Pre-launch "Launching soon" ribbon. On launch day build with
  // VITE_LAUNCHING_SOON=false (or set this to false) to remove it.
  launchingSoon: !(typeof import.meta !== 'undefined' && import.meta.env?.VITE_LAUNCHING_SOON === 'false'),
  // VITE_SITE_URL (build time) or PUBLIC_SITE_URL (API server) can override this,
  // e.g. for a staging deploy; production falls back to the real domain.
  siteUrl: ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL)
    || (typeof process !== 'undefined' && process.env?.PUBLIC_SITE_URL)
    || 'https://baraniscouture.com').replace(/\/+$/, ''),
  defaultDescription:
    "Barani's Couture sells curated fashion inspired by iconic film wardrobes and South Indian tradition — plaid sets and trench coats alongside Kanjeevaram sarees and pattu half-sarees, restyled for the modern wardrobe. Ships across India and worldwide.",
  defaultImage: '/og-image.jpg?v=2',
  // Leave empty until the brand's X/Twitter account exists.
  twitterHandle: '',
  email: 'hello@baraniscouture.com',
  currency: 'INR',
  // Order math shared by the client (display) and server (source of truth) via
  // src/lib/pricing.js. Both default to 0 so totals are unchanged until an
  // admin/operator sets real tax and shipping figures for the business.
  tax: { ratePercent: 0, label: 'GST' },
  shippingFee: 0,
  freeShippingThreshold: null,
  // Geo-targeting: regions the store currently ships to, surfaced in structured
  // data and on-page copy so both search engines and AI answer engines can
  // answer "does Barani's Couture ship to X" correctly.
  shipsTo: [
    { code: 'IN', name: 'India' },
    { code: 'SG', name: 'Singapore' },
    { code: 'MY', name: 'Malaysia' },
  ],
  // Official profile URLs, emitted as schema.org `sameAs`. Add each one only
  // once the account is live, e.g. instagram: 'https://instagram.com/<handle>'.
  social: {},
};

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: SITE_CONFIG.currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
}
