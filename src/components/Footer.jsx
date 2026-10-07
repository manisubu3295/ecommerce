import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCatalog } from '../context/CatalogContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import { SITE_CONFIG } from '../data/siteConfig.js';
import { POLICY_PAGES } from '../pages/Policy.jsx';

const linkClass = 'hover:opacity-100 transition-opacity';

export default function Footer() {
  const { theme, isDark } = useTheme();
  const { settings } = useCatalog();
  const { customer, accountsEnabled } = useCustomerAuth();
  const business = settings?.business || {};
  const legalName = business.legalName || SITE_CONFIG.legalName;

  return (
    <footer className={`pt-20 pb-10 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-5 gap-12">
        <div className="col-span-2">
          <p className={`text-3xl font-bold tracking-tighter mb-6 ${theme.fontHeading}`}>
            {SITE_CONFIG.name.toUpperCase()}<span style={{ color: theme.accentColor }}>.</span>
          </p>
          <p className="opacity-60 max-w-sm mb-4 font-light">{SITE_CONFIG.tagline}</p>
          <Link to="/shipping" className="opacity-50 text-xs uppercase tracking-widest hover:opacity-80 transition-opacity">
            Shipping to {SITE_CONFIG.shipsTo.map((r) => r.name).join(', ')}
          </Link>
        </div>
        <nav aria-label="Shop">
          <h2 className="font-bold tracking-widest uppercase text-sm mb-6">Shop</h2>
          <ul className="space-y-4 opacity-60 text-sm">
            <li><Link to="/shop" className={linkClass}>All Collections</Link></li>
            <li><Link to="/shop?sort=newest" className={linkClass}>New Arrivals</Link></li>
            <li><Link to="/wishlist" className={linkClass}>Wishlist</Link></li>
            <li><Link to="/blog" className={linkClass}>Journal</Link></li>
            <li><Link to="/about" className={linkClass}>Our Story</Link></li>
          </ul>
        </nav>
        <nav aria-label="Help">
          <h2 className="font-bold tracking-widest uppercase text-sm mb-6">Help</h2>
          <ul className="space-y-4 opacity-60 text-sm">
            <li><Link to="/track-order" className={linkClass}>Track Order</Link></li>
            <li><Link to="/faq" className={linkClass}>FAQ</Link></li>
            <li><Link to="/contact" className={linkClass}>Contact Us</Link></li>
            <li>{customer || accountsEnabled
              ? <Link to="/account" className={linkClass}>My Account</Link>
              : <span className="opacity-50 cursor-not-allowed" title="Customer accounts coming soon">My Account <span className="text-xs">(coming soon)</span></span>}</li>
          </ul>
        </nav>
        <nav aria-label="Policies">
          <h2 className="font-bold tracking-widest uppercase text-sm mb-6">Policies</h2>
          <ul className="space-y-4 opacity-60 text-sm">
            {POLICY_PAGES.map((page) => <li key={page.slug}><Link to={`/policies/${page.slug}`} className={linkClass}>{page.title}</Link></li>)}
            <li><Link to="/policies/terms#grievance" className={linkClass}>Grievance Officer</Link></li>
          </ul>
        </nav>
      </div>
      {/* Seller details, which Indian e-commerce rules require on the site. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-6 border-t border-current/10 text-xs opacity-50 leading-relaxed flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <p>© {new Date().getFullYear()} {legalName}{business.address ? `, ${business.address.replace(/\s*\n\s*/g, ', ')}` : ''}{business.gstin ? `. GSTIN ${business.gstin}` : ''}. Secure payments by Razorpay.</p>
        <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p>Designed by <a href="https://aadhiraiinnovations.com/" target="_blank" rel="noopener" className="font-semibold underline underline-offset-4 hover:opacity-100">Aadhirai Innovations</a></p>
          {/* Staff sign-in. The admin itself is protected by its own login. */}
          <Link to="/admin" rel="nofollow" className="underline underline-offset-4 hover:opacity-100">Admin login</Link>
        </div>
      </div>
    </footer>
  );
}
