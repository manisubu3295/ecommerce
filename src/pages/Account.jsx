import React, { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import { formatCurrency } from '../data/siteConfig.js';
import Seo from '../components/Seo.jsx';
import OrderStatusTimeline from '../components/OrderStatusTimeline.jsx';
import AddressFields, { SHIP_COUNTRIES, emptyShippingAddress } from '../components/AddressFields.jsx';
import { formatAddress, formatPhone, validateAddress } from '../lib/address.js';
import ChangePasswordForm from '../components/ChangePasswordForm.jsx';

const newAddress = () => ({ ...emptyShippingAddress(), label: '', isDefault: false });
const inputClass = 'w-full px-3 py-2.5 bg-transparent border border-current/20 outline-none text-sm focus:border-current';
const labelClass = 'block text-xs font-bold uppercase tracking-widest opacity-60 mb-2';

export default function Account() {
  const { theme } = useTheme();
  const { customer, loading, logout, changePassword } = useCustomerAuth();
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [addingAddress, setAddingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState(newAddress);
  const [addressErrors, setAddressErrors] = useState({});
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    if (!customer || customer.mustChangePassword) return;
    fetch('/api/customer/orders', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.orders)) setOrders(data.orders); })
      .catch(() => {});
    fetch('/api/customer/addresses', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.addresses)) setAddresses(data.addresses); })
      .catch(() => {});
  }, [customer]);

  if (loading) return <main className="max-w-xl mx-auto px-4 py-32 text-center"><p className="text-xs uppercase tracking-widest opacity-50">Loading...</p></main>;
  if (!customer) return <Navigate to="/login" replace />;

  // Signed in with a temporary password from the shop: set a real one first.
  if (customer.mustChangePassword) {
    return <>
      <Seo path="/account" title="Choose a new password" noindex />
      <main className="max-w-xl mx-auto px-4 py-20 w-full">
        <p className="text-xs uppercase tracking-[0.25em] opacity-50 mb-3">Your account</p>
        <h1 className={`text-3xl font-bold tracking-tight ${theme.fontHeading}`}>Choose a new password</h1>
        <p className="opacity-60 mt-3 mb-8">You signed in with a temporary password. Pick a new one that only you know to continue.</p>
        <ChangePasswordForm changePassword={changePassword} theme={theme} temporary />
        <button onClick={logout} className="mt-8 text-xs font-bold uppercase tracking-widest underline underline-offset-4 opacity-70">Sign out</button>
      </main>
    </>;
  }

  const saveAddress = async (event) => {
    event.preventDefault();
    setAddressError('');
    const { errors } = validateAddress(addressForm, SHIP_COUNTRIES);
    setAddressErrors(errors);
    if (Object.keys(errors).length) return;
    const response = await fetch('/api/customer/addresses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(addressForm) }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) {
      setAddressErrors(body.fields || {});
      setAddressError(body.error || 'The address could not be saved. Please try again.');
      return;
    }
    setAddresses((prev) => [body, ...(addressForm.isDefault ? prev.map((a) => ({ ...a, is_default: false })) : prev)]);
    setAddressForm(newAddress());
    setAddingAddress(false);
  };

  const deleteAddress = async (id) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    fetch(`/api/customer/addresses/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
  };

  return (
    <>
      <Seo path="/account" title="Your Account" noindex />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-16">
          <div><p className="text-xs uppercase tracking-[0.25em] opacity-50 mb-3">Your account</p><h1 className={`text-4xl font-bold tracking-tight ${theme.fontHeading}`}>Hi, {customer.name}</h1></div>
          <button onClick={logout} className="text-xs font-bold uppercase tracking-widest underline underline-offset-4">Sign out</button>
        </div>

        <section className="mb-16">
          <h2 className={`text-2xl font-bold mb-6 ${theme.fontHeading}`}>Order history</h2>
          {orders.length === 0 ? (
            <p className="opacity-60">No orders yet. <Link to="/shop" className="underline underline-offset-4">Start shopping</Link>.</p>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="border border-current/10 p-5">
                  <div className="flex flex-wrap justify-between gap-4 mb-6"><div><p className="font-mono text-xs">{order.id}</p><p className="text-xs opacity-50 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p></div><p className="font-bold">{formatCurrency(order.total)}</p></div>
                  <OrderStatusTimeline status={order.status} history={order.statusHistory} />
                  {order.invoiceNumber && <a href={`/api/customer/orders/${encodeURIComponent(order.id)}/invoice`} target="_blank" rel="noopener" className="inline-block mt-5 text-sm font-semibold underline underline-offset-4">Download invoice {order.invoiceNumber}</a>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-6"><h2 className={`text-2xl font-bold ${theme.fontHeading}`}>Saved addresses</h2><button onClick={() => setAddingAddress(true)} className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-bold uppercase tracking-widest" style={{ backgroundColor: theme.accentColor }}><Plus size={14} /> Add address</button></div>

          {addingAddress && (
            <form onSubmit={saveAddress} noValidate className="border border-current/10 p-6 mb-6 space-y-4">
              <div className="max-w-xs"><label htmlFor="account-label" className={labelClass}>Label <span className="font-normal normal-case opacity-70">(e.g. Home, Office)</span></label><input id="account-label" value={addressForm.label} onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })} className={inputClass} /></div>
              <AddressFields value={addressForm} onChange={(next) => { setAddressForm(next); if (addressErrors && Object.keys(addressErrors).length) setAddressErrors(validateAddress(next, SHIP_COUNTRIES).errors); }} errors={addressErrors} idPrefix="account" inputClassName={inputClass} labelClassName={labelClass} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addressForm.isDefault} onChange={(event) => setAddressForm({ ...addressForm, isDefault: event.target.checked })} /> Set as default address</label>
              {addressError && <p className="text-sm text-red-600" role="alert">{addressError}</p>}
              <div className="flex gap-3">
                <button type="submit" className="px-6 py-3 text-white text-xs font-bold uppercase tracking-widest" style={{ backgroundColor: theme.accentColor }}>Save address</button>
                <button type="button" onClick={() => { setAddingAddress(false); setAddressForm(newAddress()); setAddressErrors({}); setAddressError(''); }} className="text-xs uppercase tracking-widest opacity-60">Cancel</button>
              </div>
            </form>
          )}

          {addresses.length === 0 ? (
            <p className="opacity-60">No saved addresses yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((address) => (
                <div key={address.id} className="border border-current/10 p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><MapPin size={14} /> {address.label || 'Address'}{address.is_default && <span className="opacity-50">· Default</span>}</p>
                    <button onClick={() => deleteAddress(address.id)} className="opacity-40 hover:opacity-100 hover:text-red-500" aria-label="Delete address"><Trash2 size={15} /></button>
                  </div>
                  <p className="text-sm">{address.name}</p>
                  <p className="text-sm opacity-70 whitespace-pre-line">{formatAddress({ line1: address.line1, line2: address.line2, city: address.city, state: address.state, postalCode: address.postal_code, country: address.country })}</p>
                  <p className="text-sm opacity-70">{formatPhone(address.phone, address.country)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="mt-16" aria-labelledby="password-title">
          <h2 id="password-title" className={`text-2xl font-bold mb-6 ${theme.fontHeading}`}>Password</h2>
          <ChangePasswordForm changePassword={changePassword} theme={theme} />
        </section>
      </main>
    </>
  );
}
