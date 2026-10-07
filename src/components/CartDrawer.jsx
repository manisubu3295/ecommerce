import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, X, Lock, Minus, Plus, Tag } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { formatCurrency } from '../data/siteConfig.js';
import { useModalBehavior } from '../hooks/useModalBehavior.js';

export default function CartDrawer() {
  const { theme, isDark } = useTheme();
  const { cart, removeFromCart, updateQty, cartTotals, freeShippingThreshold, coupon, applyCoupon, removeCoupon, isCartOpen, setIsCartOpen, handleCheckout } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const [couponStatus, setCouponStatus] = useState('idle'); // idle | applying | error
  const [couponError, setCouponError] = useState('');

  useModalBehavior(isCartOpen, () => setIsCartOpen(false));

  if (!isCartOpen) return null;

  const submitCoupon = async (event) => {
    event.preventDefault();
    setCouponStatus('applying');
    setCouponError('');
    try {
      await applyCoupon(couponInput);
      setCouponInput('');
      setCouponStatus('idle');
    } catch (error) {
      setCouponError(error.message);
      setCouponStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)} />
      <div role="dialog" aria-modal="true" aria-label="Shopping bag" className={`relative w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ${isDark ? 'bg-slate-900 text-white border-l border-slate-800' : 'bg-white text-gray-900'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
          <h2 className={`text-2xl font-bold tracking-tight ${theme.fontHeading}`}>Shopping Bag</h2>
          <button onClick={() => setIsCartOpen(false)} className="p-2 hover:opacity-50 transition-opacity" aria-label="Close cart">
            <X size={24} />
          </button>
        </div>

        {cart.length > 0 && freeShippingThreshold != null && (
          <div className={`px-6 pt-5 pb-1 border-b ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
            {cartTotals.subtotal >= freeShippingThreshold ? (
              <p className="text-xs font-semibold text-emerald-600 mb-2">You've unlocked free shipping!</p>
            ) : (
              <p className="text-xs opacity-70 mb-2">Add {formatCurrency(freeShippingThreshold - cartTotals.subtotal)} more for free shipping</p>
            )}
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-current/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (cartTotals.subtotal / freeShippingThreshold) * 100)}%`, backgroundColor: theme.accentColor }}
              />
            </div>
          </div>
        )}

        <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-6">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50 gap-6">
              <ShoppingBag size={48} strokeWidth={1} />
              <p className="text-lg font-light tracking-wide">Your bag is empty.</p>
              <Link
                to="/shop"
                onClick={() => setIsCartOpen(false)}
                className="text-xs font-bold tracking-widest uppercase underline underline-offset-4"
              >
                Continue shopping
              </Link>
            </div>
          ) : (
            cart.map((item) => (
              <div key={`${item.id}-${item.size ?? ''}`} className="flex gap-6 items-center group">
                <img src={item.image} alt={item.name} className="w-24 h-32 object-cover" />
                <div className="flex-grow">
                  {item.movie && <p className="text-xs uppercase tracking-widest opacity-50 mb-1">{item.movie}</p>}
                  <h4 className={`font-medium mb-1 ${theme.fontHeading}`}>{item.name}</h4>
                  {item.size && <p className="text-xs opacity-60 mb-2">Size {item.size}</p>}
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => updateQty(item.id, item.size, item.qty - 1)}
                      className="p-1 border border-current opacity-60 hover:opacity-100"
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm w-4 text-center">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.id, item.size, item.qty + 1)}
                      className="p-1 border border-current opacity-60 hover:opacity-100"
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <p className="font-bold tracking-wide">{formatCurrency(item.price * item.qty)}</p>
                </div>
                <button
                  onClick={() => removeFromCart(item.id, item.size)}
                  className="p-2 opacity-40 hover:opacity-100 hover:text-red-500 transition-colors"
                  aria-label={`Remove ${item.name} from cart`}
                >
                  <X size={20} />
                </button>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className={`p-6 border-t ${isDark ? 'border-slate-800 bg-slate-900' : 'border-gray-100 bg-gray-50'}`}>
            {coupon ? (
              <div className="flex items-center justify-between mb-4 px-3 py-2 border border-current/15 text-sm">
                <span className="flex items-center gap-2"><Tag size={14} /> {coupon.code} applied</span>
                <button type="button" onClick={removeCoupon} className="text-xs font-bold uppercase tracking-widest underline underline-offset-4 opacity-70 hover:opacity-100">Remove</button>
              </div>
            ) : (
              <form onSubmit={submitCoupon} className="flex gap-2 mb-4">
                <input
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value)}
                  placeholder="Coupon code"
                  aria-label="Coupon code"
                  className="flex-grow min-w-0 px-3 py-2 bg-transparent border border-current/20 focus:border-current outline-none text-sm uppercase"
                />
                <button
                  type="submit"
                  disabled={!couponInput.trim() || couponStatus === 'applying'}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-current disabled:opacity-40"
                >
                  {couponStatus === 'applying' ? '...' : 'Apply'}
                </button>
              </form>
            )}
            {couponError && <p className="text-xs text-red-600 mb-4" role="alert">{couponError}</p>}
            <div className="space-y-2 mb-6 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-light opacity-70">Subtotal</span>
                <span>{formatCurrency(cartTotals.subtotal)}</span>
              </div>
              {cartTotals.discount > 0 && (
                <div className="flex justify-between items-center text-emerald-600">
                  <span className="font-light">Discount</span>
                  <span>-{formatCurrency(cartTotals.discount)}</span>
                </div>
              )}
              {cartTotals.shipping > 0 && (
                <div className="flex justify-between items-center">
                  <span className="font-light opacity-70">Shipping</span>
                  <span>{formatCurrency(cartTotals.shipping)}</span>
                </div>
              )}
              {cartTotals.tax > 0 && (
                <div className="flex justify-between items-center">
                  <span className="font-light opacity-70">Tax</span>
                  <span>{formatCurrency(cartTotals.tax)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-lg pt-2 border-t border-current/10">
                <span className="font-light">Total</span>
                <span className="font-bold">{formatCurrency(cartTotals.total)}</span>
              </div>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full py-4 text-white font-bold tracking-widest uppercase transition-opacity hover:opacity-90 flex items-center justify-center gap-3"
              style={{ backgroundColor: theme.accentColor }}
            >
              <Lock size={16} />
              Secure Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
