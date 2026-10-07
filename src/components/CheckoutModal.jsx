import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, CheckCircle, ShieldCheck, Smartphone, User, X } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import { SITE_CONFIG, formatCurrency } from '../data/siteConfig.js';
import { useModalBehavior } from '../hooks/useModalBehavior.js';
import { COUNTRIES, formatAddress, validateAddress } from '../lib/address.js';
import AddressFields, { SHIP_COUNTRIES, emptyShippingAddress } from './AddressFields.jsx';

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FIELD_ORDER = ['email', 'country', 'name', 'phone', 'line1', 'city', 'state', 'postalCode'];

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// A saved address row (snake_case from the API) → the checkout form's shape.
const fromSaved = (saved) => ({ name: saved.name || '', phone: saved.phone || '', line1: saved.line1 || '', line2: saved.line2 || '', city: saved.city || '', state: saved.state || '', postalCode: saved.postal_code || '', country: SHIP_COUNTRIES.includes(saved.country) ? saved.country : SHIP_COUNTRIES[0] });

const inputClass = 'w-full px-3.5 py-3 bg-white border border-gray-300 rounded outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 text-[15px]';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

export default function CheckoutModal() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const location = useLocation();
  const { customer: account, accountsEnabled } = useCustomerAuth();
  // Signed-out shoppers first choose: sign in, or carry on as a guest.
  const [guest, setGuest] = useState(false);
  const { cartTotals, isCheckoutOpen, setIsCheckoutOpen, paymentStatus, setPaymentStatus, startCheckout, finalizeOrder } = useCart();
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState(emptyShippingAddress);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [saveToAccount, setSaveToAccount] = useState(false);
  const [gatewayError, setGatewayError] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const formRef = useRef(null);
  const hasLiveGateway = Boolean(import.meta.env.VITE_RAZORPAY_KEY_ID);

  const canClose = paymentStatus === 'idle';
  useModalBehavior(isCheckoutOpen, () => setIsCheckoutOpen(false), canClose);

  useEffect(() => {
    if (!isCheckoutOpen) {
      setAddress(emptyShippingAddress());
      setEmail('');
      setErrors({});
      setSubmitted(false);
      setGatewayError('');
      setSaveToAccount(false);
      setGuest(false);
      return;
    }
    // Signed-in shoppers: prefill from their account and default address.
    if (!account) return;
    setEmail((current) => current || account.email || '');
    fetch('/api/customer/addresses', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const list = (data?.addresses || []).filter((saved) => SHIP_COUNTRIES.includes(saved.country));
        setSavedAddresses(list);
        if (list.length) setAddress(fromSaved(list[0]));
        else setAddress((current) => ({ ...current, name: current.name || account.name || '' }));
      })
      .catch(() => {});
  }, [isCheckoutOpen, account]);

  if (!isCheckoutOpen) return null;

  // While accounts are off (no email set up yet) checkout is guest-only.
  const choosing = paymentStatus === 'idle' && accountsEnabled && !account && !guest;
  // Sign-in (with its emailed code) happens on /login, which comes back here
  // (?next=checkout) and reopens checkout.
  const accountLink = (path) => ({ pathname: path, search: '?next=checkout' });
  const accountState = { from: `${location.pathname}${location.search}` };

  const validate = (nextEmail = email, nextAddress = address) => {
    const result = validateAddress(nextAddress, SHIP_COUNTRIES);
    const nextErrors = { ...result.errors };
    if (!EMAIL_PATTERN.test(nextEmail.trim())) nextErrors.email = 'Enter a valid email address, e.g. name@example.com.';
    return { nextErrors, normalized: result.address };
  };

  // After the first submit, re-check as the shopper fixes things.
  const updateAddress = (next) => {
    setAddress(next);
    if (submitted) setErrors(validate(email, next).nextErrors);
  };
  const updateEmail = (next) => {
    setEmail(next);
    if (submitted) setErrors(validate(next, address).nextErrors);
  };

  const focusFirstError = (fieldErrors) => {
    const first = FIELD_ORDER.find((key) => fieldErrors[key]);
    if (first) formRef.current?.querySelector(`#checkout-${first}`)?.focus();
  };

  const goToSuccess = (orderId, accessToken, total) => {
    finalizeOrder({ orderId, accessToken, total });
    setPaymentStatus('success');
    setTimeout(() => {
      setIsCheckoutOpen(false);
      setPaymentStatus('idle');
      navigate(`/order-success?order=${orderId}&access=${accessToken}`);
    }, 1200);
  };

  const processPayment = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setGatewayError('');
    const { nextErrors, normalized } = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { focusFirstError(nextErrors); return; }

    setPaymentStatus('processing');
    let init;
    try {
      init = await startCheckout({ email: email.trim(), shippingAddress: normalized });
    } catch (error) {
      setPaymentStatus('idle');
      if (error.fields) { setErrors(error.fields); focusFirstError(error.fields); }
      setGatewayError(error.message);
      return;
    }

    if (account && saveToAccount) {
      fetch('/api/customer/addresses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ...normalized, label: 'Checkout', isDefault: savedAddresses.length === 0 }) }).catch(() => {});
    }

    if (!init.requiresPayment) {
      // Demo mode (no live gateway configured): the server already marked
      // the order `processing`, nothing left to confirm.
      setIsDemo(true);
      goToSuccess(init.orderId, init.accessToken, init.total);
      return;
    }

    const razorpayLoaded = await loadRazorpay().catch(() => false);
    if (!razorpayLoaded || !hasLiveGateway) {
      setPaymentStatus('idle');
      setGatewayError('Could not load the secure payment form. Your order is saved — please try again in a moment.');
      return;
    }

    try {
      // Full-page redirect to Razorpay's hosted Checkout — Razorpay owns the
      // entire payment UI from here, including method selection and retries.
      // It posts the result back to our server callback (which verifies the
      // signature and 302s to /order-success), not to a JS handler here.
      const callbackUrl = `${window.location.origin}/api/checkout/${init.orderId}/callback?access=${encodeURIComponent(init.accessToken)}`;
      const razorpay = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        order_id: init.gatewayOrderId,
        amount: init.amount,
        currency: init.currency || SITE_CONFIG.currency,
        name: SITE_CONFIG.name,
        description: `${SITE_CONFIG.name} order`,
        // Prefilled so Razorpay never re-asks for details already collected above.
        prefill: { name: normalized.name, email: email.trim(), contact: `+${COUNTRIES[normalized.country].dialCode}${normalized.phone}` },
        notes: { shipping_address: formatAddress(normalized) },
        method: { card: true, upi: true, netbanking: true, wallet: true },
        redirect: true,
        callback_url: callbackUrl,
      });
      razorpay.open();
    } catch {
      setPaymentStatus('idle');
      setGatewayError('The secure payment window could not be opened. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => canClose && setIsCheckoutOpen(false)} />

      <div role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="relative w-full sm:max-w-xl max-h-[100dvh] sm:max-h-[92vh] flex flex-col bg-white text-gray-900 shadow-2xl sm:rounded-lg overflow-hidden">
        <div className="shrink-0 px-6 py-5 flex justify-between items-center gap-4 border-b border-gray-200">
          <div>
            <p className="text-sm text-gray-500">{SITE_CONFIG.name}</p>
            <h2 id="checkout-title" className="text-xl font-semibold">Checkout</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">To pay</p>
              <p className="font-bold text-xl">{formatCurrency(cartTotals.total)}</p>
            </div>
            {canClose && <button type="button" onClick={() => setIsCheckoutOpen(false)} className="p-2 -mr-2 text-gray-500 hover:text-gray-900" aria-label="Close checkout"><X size={20} /></button>}
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-6">
          {choosing && (
            <div className="space-y-6">
              <section aria-labelledby="checkout-signin-title" className="space-y-4">
                <div>
                  <h3 id="checkout-signin-title" className="font-semibold flex items-center gap-2"><User size={17} /> Sign in for faster checkout</h3>
                  <p className="text-sm text-gray-500 mt-1">Use your saved addresses and see this order under My orders. We’ll email you a code to confirm it’s you.</p>
                </div>
                <Link to={accountLink('/login')} state={accountState} onClick={() => setIsCheckoutOpen(false)} className="block w-full py-3 rounded text-white text-center font-semibold" style={{ backgroundColor: theme.accentColor }}>Sign in</Link>
                <p className="text-sm text-gray-500">New here? <Link to={accountLink('/signup')} state={accountState} onClick={() => setIsCheckoutOpen(false)} className="font-semibold text-gray-900 underline underline-offset-4">Create an account</Link></p>
              </section>

              <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-gray-400" aria-hidden="true"><span className="h-px flex-1 bg-gray-200" />or<span className="h-px flex-1 bg-gray-200" /></div>

              <section className="space-y-3">
                <button type="button" onClick={() => setGuest(true)} className="w-full py-3 rounded border border-gray-900 font-semibold hover:bg-gray-50">Continue as guest</button>
                <p className="text-xs text-gray-500 text-center">No account needed. Track your order any time with your email and mobile number.</p>
              </section>
            </div>
          )}

          {paymentStatus === 'idle' && !choosing && (
            <form ref={formRef} onSubmit={processPayment} noValidate className="space-y-6">
              {gatewayError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2" role="alert">{gatewayError}</p>}

              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Contact</h3>
                  {account
                    ? <p className="text-xs text-gray-500">Signed in as {account.email}</p>
                    : accountsEnabled && <button type="button" onClick={() => setGuest(false)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 underline underline-offset-4"><ArrowLeft size={13} /> Guest checkout · Sign in instead</button>}
                </div>
                <div>
                  <label htmlFor="checkout-email" className={labelClass}>Email</label>
                  <input id="checkout-email" type="email" required value={email} onChange={(event) => updateEmail(event.target.value)} autoComplete="email" aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? 'checkout-email-error' : 'checkout-email-hint'} className={inputClass + (errors.email ? ' border-red-500' : '')} />
                  {errors.email ? <p id="checkout-email-error" className="mt-1 text-xs text-red-600">{errors.email}</p> : <p id="checkout-email-hint" className="mt-1 text-xs text-gray-500">Order confirmation and invoice are sent here.</p>}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Delivery address</h3>
                  {savedAddresses.length > 0 && <select aria-label="Use a saved address" onChange={(event) => { const saved = savedAddresses.find((a) => String(a.id) === event.target.value); if (saved) updateAddress(fromSaved(saved)); }} defaultValue={savedAddresses[0].id} className="text-sm border border-gray-300 rounded px-2 py-1.5 max-w-[55%]">
                    {savedAddresses.map((saved) => <option key={saved.id} value={saved.id}>{saved.label || saved.name}: {saved.city}</option>)}
                  </select>}
                </div>
                <AddressFields value={address} onChange={updateAddress} errors={errors} idPrefix="checkout" inputClassName={inputClass} labelClassName={labelClass} />
                {account && <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={saveToAccount} onChange={(event) => setSaveToAccount(event.target.checked)} /> Save this address to my account</label>}
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600" aria-label="Accepted payment methods">
                  <span className="inline-flex items-center gap-1.5 border border-gray-200 rounded px-2.5 py-1.5"><CreditCard size={14} /> Cards</span>
                  <span className="inline-flex items-center gap-1.5 border border-gray-200 rounded px-2.5 py-1.5"><Smartphone size={14} /> UPI</span>
                  <span className="inline-flex items-center gap-1.5 border border-gray-200 rounded px-2.5 py-1.5">Net banking and wallets</span>
                </div>
                <p className="flex gap-2 text-xs text-gray-500"><ShieldCheck size={15} className="shrink-0" />{hasLiveGateway ? `Payment opens securely in Razorpay. ${SITE_CONFIG.name} never sees your card number or UPI PIN.` : 'Demo mode: no payment is taken. Add Razorpay keys to accept real payments.'}</p>
              </section>

              <p className="text-xs text-gray-500">By paying you agree to our <a href="/policies/terms" target="_blank" rel="noopener" className="underline underline-offset-2">Terms</a> and <a href="/policies/returns" target="_blank" rel="noopener" className="underline underline-offset-2">Returns &amp; Refunds</a> policy.</p>
              <button type="submit" className="w-full py-4 text-white font-semibold rounded transition-opacity hover:opacity-90" style={{ backgroundColor: theme.accentColor }}>
                {hasLiveGateway ? `Pay ${formatCurrency(cartTotals.total)}` : 'Place demo order'}
              </button>
            </form>
          )}

          {paymentStatus === 'processing' && (
            <div className="py-16 flex flex-col items-center justify-center text-center" role="status">
              <div className="w-12 h-12 border-4 border-gray-100 border-t-gray-900 rounded-full animate-spin mb-6" />
              <h3 className="text-lg font-semibold">Saving your order…</h3>
              <p className="text-gray-500 text-sm mt-2">{hasLiveGateway ? 'Opening secure payment next. Please don’t close this page.' : 'One moment.'}</p>
            </div>
          )}

          {paymentStatus === 'success' && (
            <div className="py-16 flex flex-col items-center justify-center text-center" role="status">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <h3 className="text-2xl font-semibold">{isDemo ? 'Order placed' : 'Payment successful'}</h3>
              <p className="text-gray-500 mt-3 max-w-xs">Taking you to your order details…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
