import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, ShoppingBag, Menu, Paintbrush, User, X, LayoutDashboard } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { SITE_CONFIG } from '../data/siteConfig.js';

const NAV_LINKS = [
  { to: '/shop', label: 'Collections' },
  { to: '/blog', label: 'Journal' },
  { to: '/about', label: 'Our Story' },
  { to: '/faq', label: 'FAQ' },
  // No sign-in needed: email + mobile number finds a guest's orders.
  { to: '/track-order', label: 'Track Order' },
];

export default function Nav() {
  const { theme, setIsAdminOpen } = useTheme();
  const { admin } = useAdminAuth();
  const { customer, accountsEnabled } = useCustomerAuth();
  const { cartCount, setIsCartOpen, wishlist } = useCart();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${theme.navStyle}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => setIsMenuOpen((open) => !open)} className="lg:hidden p-2 -ml-2" aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMenuOpen}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Link to="/" className={`text-2xl font-bold tracking-tighter ${theme.fontHeading}`}>
            {SITE_CONFIG.name.toUpperCase()}<span style={{ color: theme.accentColor }}>.</span>
          </Link>
        </div>

        <nav className="hidden lg:flex gap-10 text-sm font-medium tracking-wide" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`hover:opacity-60 transition-opacity ${location.pathname === link.to ? 'underline underline-offset-4' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-6">
          {/* Admin tools only for a signed-in admin. Shoppers never see them;
              staff sign in by going to /admin directly. */}
          {admin && (
            <>
              <button onClick={() => setIsAdminOpen(true)} className="hidden md:flex items-center gap-2 text-xs font-semibold tracking-widest uppercase hover:opacity-60 transition-opacity">
                <Paintbrush size={16} /> Theme
              </button>
              <Link to="/admin" className="hidden md:flex items-center gap-2 text-xs font-semibold tracking-widest uppercase hover:opacity-60 transition-opacity">
                <LayoutDashboard size={16} /> Admin
              </Link>
            </>
          )}
          {customer || accountsEnabled ? (
            <Link
              to={customer ? '/account' : '/login'}
              className="p-2 hover:opacity-60 transition-opacity"
              aria-label={customer ? `Your account, signed in as ${customer.name}` : 'Sign in'}
            >
              <User size={24} />
            </Link>
          ) : (
            // Greyed out until the store's email is set up (sign-in uses emailed codes).
            <span className="p-2 opacity-30 cursor-not-allowed" title="Customer accounts coming soon" aria-label="Customer accounts coming soon" role="img">
              <User size={24} />
            </span>
          )}
          <Link
            to="/wishlist"
            className="relative p-2 hover:opacity-60 transition-opacity"
            aria-label={`Open wishlist, ${wishlist.length} items`}
          >
            <Heart size={24} />
            {wishlist.length > 0 && (
              <span
                className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center text-[10px] text-white rounded-full font-bold shadow-sm"
                style={{ backgroundColor: theme.accentColor }}
              >
                {wishlist.length}
              </span>
            )}
          </Link>
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 hover:opacity-60 transition-opacity"
            aria-label={`Open cart, ${cartCount} items`}
          >
            <ShoppingBag size={24} />
            {cartCount > 0 && (
              <span
                className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center text-[10px] text-white rounded-full font-bold shadow-sm"
                style={{ backgroundColor: theme.accentColor }}
              >
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
      {isMenuOpen && (
        <nav className="lg:hidden border-t border-current/10 px-4 py-5 space-y-4 bg-inherit" aria-label="Mobile navigation">
          {NAV_LINKS.map((link) => <Link key={link.to} to={link.to} onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium tracking-wide">{link.label}</Link>)}
          {admin && <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 text-sm font-medium tracking-wide"><LayoutDashboard size={16} /> Admin workspace</Link>}
        </nav>
      )}
    </header>
  );
}
