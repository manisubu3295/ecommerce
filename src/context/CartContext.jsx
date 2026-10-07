import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SITE_CONFIG } from '../data/siteConfig.js';
import { calculateOrderTotals } from '../lib/pricing.js';
import { useCatalog } from './CatalogContext.jsx';

const CartContext = createContext(null);
const STORAGE_KEY = 'archive-cart';
const WISHLIST_KEY = 'archive-wishlist';
const ORDERS_KEY = 'archive-orders'; // the shopper's own local order history, not admin data

function readInitialCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // Back-compat: older carts saved before size-aware keys didn't set `size`.
    return Array.isArray(parsed) ? parsed.map((item) => ({ ...item, size: item.size ?? null })) : [];
  } catch {
    return [];
  }
}

function readInitialWishlist() {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // Wishlist stores just product ids — the catalog is always the source of
    // truth for name/price/image, so a saved item never goes stale.
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readInitialCart);
  const [wishlist, setWishlist] = useState(readInitialWishlist);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle | processing | success
  const [coupon, setCoupon] = useState(null); // { code, discountAmount } | null

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // storage unavailable (private mode, quota) — cart just won't persist
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
    } catch {
      // storage unavailable — wishlist just won't persist
    }
  }, [wishlist]);

  const toggleWishlist = (productId) => {
    setWishlist((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
  };

  const isWishlisted = (productId) => wishlist.includes(productId);

  // Cart lines are keyed on product id + size, so the same product in two
  // sizes is two lines, and the size a shopper picked actually reaches the order.
  const addToCart = (product, size = null, openDrawer = true) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id && item.size === size);
      if (existing) {
        return prev.map((item) => (item === existing ? { ...item, qty: item.qty + 1 } : item));
      }
      return [...prev, { ...product, size, qty: 1 }];
    });
    if (openDrawer) setIsCartOpen(true);
  };

  const removeFromCart = (productId, size = null) => setCart((prev) => prev.filter((item) => !(item.id === productId && item.size === size)));

  const updateQty = (productId, size, qty) => {
    if (qty < 1) return removeFromCart(productId, size);
    setCart((prev) => prev.map((item) => (item.id === productId && item.size === size ? { ...item, qty } : item)));
  };

  const clearCart = () => setCart([]);

  // Admin-configured pricing (Settings tab) overrides the SITE_CONFIG
  // defaults, same fallback logic as the server's getPricingSettings() so
  // the cart preview and the actual checkout charge never disagree.
  const pricingSettings = useCatalog().settings?.pricing;
  const taxRatePercent = Number.isFinite(pricingSettings?.taxRatePercent) ? pricingSettings.taxRatePercent : SITE_CONFIG.tax.ratePercent;
  const shippingFee = Number.isFinite(pricingSettings?.shippingFee) ? pricingSettings.shippingFee : SITE_CONFIG.shippingFee;
  const freeShippingThreshold = pricingSettings?.freeShippingThreshold ?? SITE_CONFIG.freeShippingThreshold;

  const cartTotals = useMemo(() => calculateOrderTotals({
    items: cart,
    taxRatePercent,
    shippingFee,
    freeShippingThreshold,
    discountAmount: coupon?.discountAmount || 0,
  }), [cart, taxRatePercent, shippingFee, freeShippingThreshold, coupon]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);

  // Coupon amount is only ever taken from the server's own validation — the
  // client never invents its own discount number, same principle as pricing.
  const applyCoupon = async (code) => {
    const rawSubtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
    const response = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal: rawSubtotal }),
    });
    const result = await readJson(response);
    if (!response.ok) throw new Error(result.error || 'Could not apply that coupon.');
    setCoupon({ code: result.code, discountAmount: result.discountAmount });
    return result;
  };

  const removeCoupon = () => setCoupon(null);

  const handleCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
    setPaymentStatus('idle');
  };

  // Step 1: persist the order server-side (status `pending_payment` or,
  // without a live gateway, `processing` in demo mode) and reserve stock
  // BEFORE any payment UI opens. Returns what's needed to open Razorpay.
  const startCheckout = async (customer) => {
    const response = await fetch('/api/checkout/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart.map(({ id, qty, size }) => ({ id, qty, size })), customer, couponCode: coupon?.code }),
    });
    const result = await readJson(response);
    if (!response.ok) {
      // `fields` (field → message) lets the form highlight exactly what the server rejected.
      throw Object.assign(new Error(result.error || 'Unable to start checkout. Please try again.'), { fields: result.fields });
    }
    return result; // { orderId, accessToken, status, requiresPayment, gatewayOrderId, amount, currency, total, discount }
  };

  const finalizeOrder = ({ orderId, accessToken, total }) => {
    const record = { id: orderId, accessToken, createdAt: new Date().toISOString(), total, items: cart };
    try { localStorage.setItem(ORDERS_KEY, JSON.stringify([record, ...readOrders()])); } catch { /* cache is optional */ }
    setCart([]);
    setCoupon(null);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        wishlist,
        toggleWishlist,
        isWishlisted,
        startCheckout,
        finalizeOrder,
        cartTotals,
        cartCount,
        freeShippingThreshold,
        coupon,
        applyCoupon,
        removeCoupon,
        isCartOpen,
        setIsCartOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        paymentStatus,
        setPaymentStatus,
        handleCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
