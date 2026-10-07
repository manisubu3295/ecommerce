import React, { useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, ExternalLink, FileText, Package, Search, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import { formatCurrency } from '../data/siteConfig.js';
import Seo from '../components/Seo.jsx';
import OrderStatusTimeline from '../components/OrderStatusTimeline.jsx';
import Pagination from '../components/Pagination.jsx';
import { paginate } from '../lib/catalogFilter.js';

const ORDERS_PER_PAGE = 5;

const labelClass = 'block text-xs font-bold uppercase tracking-widest opacity-60 mb-2';
const inputClass = 'w-full border border-current/20 bg-transparent px-4 py-3 outline-none focus:border-current';

const ORDER_STATUS = {
  pending_payment: 'Payment not completed',
  processing: 'Being prepared',
  shipped: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Per-item wording for the admin's packing statuses.
const ITEM_STATUS = {
  pending: 'Being prepared',
  packed: 'Packed, ready to ship',
  shipped: 'Shipped',
  delivered: 'Delivered',
  returned: 'Returned',
};

const longDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function orderHeadline(order) {
  if (order.status === 'processing' && order.statusHistory?.some((event) => event.status === 'packed')) return 'Packed, ready to ship';
  return ORDER_STATUS[order.status] || order.status;
}

function itemSummary(order) {
  const [first, ...rest] = order.items || [];
  if (!first) return 'No items';
  return `${first.name}${rest.length ? ` and ${rest.length} more item${rest.length === 1 ? '' : 's'}` : ''}`;
}

export default function TrackOrder() {
  const { theme } = useTheme();
  // One field for the second check: mobile number, order number (ARC-…) or
  // the courier's tracking number. The server tries every reading of it.
  const [form, setForm] = useState({ email: '', proof: '' });
  const [orders, setOrders] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [listPage, setListPage] = useState(1);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const topRef = useRef(null);

  const lookup = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/orders/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email, proof: form.proof }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'We couldn’t look up your orders. Please try again.');
      setOrders(result.orders || []);
      setSelectedId(null);
      setListPage(1);
      if (!result.orders?.length) setMessage('No orders match. Use the email you entered at checkout with your mobile number, order number or courier tracking number. A tracking number works once the order has shipped.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const open = (id) => {
    setSelectedId(id);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const replaceOrder = (updated) => setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
  const selected = orders?.find((order) => order.id === selectedId);
  const orderPage = paginate(orders || [], listPage, ORDERS_PER_PAGE);
  const listRef = useRef(null);
  const goToPage = (target) => {
    setListPage(target);
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return <>
    <Seo path="/track-order" title="Track Your Order" noindex />
    <main ref={topRef} className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full scroll-mt-24">
      {selected ? <OrderDetail order={selected} theme={theme} onBack={() => setSelectedId(null)} onUpdated={replaceOrder} /> : <>
        <div className="max-w-xl mb-10"><p className="text-xs uppercase tracking-[0.25em] opacity-50 mb-3">Customer care</p><h1 className={`text-4xl md:text-5xl font-bold tracking-tight ${theme.fontHeading}`}>Track your order</h1><p className="opacity-60 text-lg mt-4">No account needed. Enter the email you used at checkout, plus your mobile number to see all your orders, or an order number or courier tracking number to see just that one.</p></div>
        <form onSubmit={lookup} className="border border-current/10 p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className="block"><span className={labelClass}>Email address</span><input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} /></label>
          <label className="block"><span className={labelClass}>Mobile, order or tracking number</span><input required autoComplete="tel" value={form.proof} onChange={(event) => setForm({ ...form, proof: event.target.value })} placeholder="98765 43210, ARC-1A2B3C… or AWB" aria-describedby="track-proof-hint" className={inputClass} /></label>
          <p id="track-proof-hint" className="sm:col-span-2 text-xs opacity-60">Your order number (starting ARC-) is on the confirmation page; the courier tracking number is in your shipping email. We ask for one of these as well as your email so nobody else can see your orders or address.</p>
          {message && <p className="sm:col-span-2 text-sm text-red-700" role="alert">{message}</p>}
          <div className="sm:col-span-2"><button disabled={loading} className="inline-flex items-center gap-2 px-6 py-3 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50" style={{ backgroundColor: theme.accentColor }}><Search size={15} /> {loading ? 'Finding your orders…' : 'Find my orders'}</button></div>
        </form>

        {orders?.length > 0 && <section ref={listRef} className="mt-12 scroll-mt-28" aria-labelledby="your-orders">
          <h2 id="your-orders" className={`text-2xl font-bold mb-5 ${theme.fontHeading}`}>Your orders <span className="text-base font-normal opacity-50">({orders.length})</span></h2>
          <ul className="space-y-3">{orderPage.items.map((order) => <li key={order.id}>
            <button type="button" onClick={() => open(order.id)} className="w-full text-left border border-current/10 p-4 sm:p-5 flex items-center gap-4 hover:border-current/40 transition-colors">
              <div className="flex -space-x-3 shrink-0">{(order.items || []).slice(0, 3).map((item, i) => item.image ? <img key={i} src={item.image} alt="" className="w-12 h-16 object-cover border-2 border-white" /> : <span key={i} className="w-12 h-16 bg-current/10 border-2 border-white" />)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{itemSummary(order)}</p>
                <p className="text-xs opacity-60 mt-1">{order.id}, placed {longDate(order.createdAt)}</p>
                <p className="text-sm mt-2 font-medium" style={{ color: order.status === 'cancelled' || order.status === 'pending_payment' ? undefined : theme.accentColor }}>{orderHeadline(order)}</p>
              </div>
              <div className="text-right shrink-0"><p className="font-bold">{formatCurrency(order.total)}</p><ChevronRight size={18} className="ml-auto mt-2 opacity-50" aria-hidden="true" /></div>
            </button>
          </li>)}</ul>
          {orderPage.totalPages > 1 && <div className="mt-8 flex flex-col items-center gap-3">
            <Pagination page={orderPage.page} totalPages={orderPage.totalPages} onSelect={goToPage} accentColor={theme.accentColor} label="Order pages" />
            <p className="text-sm opacity-60">Showing {orderPage.start + 1}–{orderPage.end} of {orders.length}</p>
          </div>}
        </section>}
      </>}
    </main>
  </>;
}

function OrderDetail({ order, theme, onBack, onUpdated }) {
  const [request, setRequest] = useState({ open: false, type: 'return', reason: '' });
  const [requestState, setRequestState] = useState({ sending: false, error: '' });
  const shipped = order.status === 'shipped' || order.status === 'delivered';
  const canReturn = order.status === 'delivered' && (!order.returnRequest || order.returnRequest.status === 'rejected');
  const invoiceHref = order.invoiceNumber ? `/api/orders/${encodeURIComponent(order.id)}/invoice?track=${encodeURIComponent(order.trackToken)}` : null;

  const sendRequest = async (event) => {
    event.preventDefault();
    setRequestState({ sending: true, error: '' });
    const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Track-Token': order.trackToken }, body: JSON.stringify({ type: request.type, reason: request.reason }) }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) {
      setRequestState({ sending: false, error: body.error || 'Your request could not be sent. Please try again.' });
      return;
    }
    onUpdated({ ...order, [request.type === 'return' ? 'returnRequest' : 'refundRequest']: body });
    setRequest({ open: false, type: 'return', reason: '' });
    setRequestState({ sending: false, error: '' });
  };

  return <article aria-labelledby="order-title">
    <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold mb-8 opacity-70 hover:opacity-100"><ArrowLeft size={16} /> All your orders</button>
    <p className="text-xs uppercase tracking-[0.25em] opacity-50 mb-2">Order {order.id}</p>
    <h1 id="order-title" className={`text-3xl md:text-4xl font-bold tracking-tight ${theme.fontHeading}`}>{orderHeadline(order)}</h1>
    <p className="opacity-60 mt-2">Placed {longDate(order.createdAt)}</p>

    {order.status === 'pending_payment' && <p className="mt-6 border border-amber-300 bg-amber-50 text-amber-900 p-4 text-sm">We haven’t received the payment for this order, so it hasn’t been sent. If money left your account, <Link to="/contact" className="underline underline-offset-4 font-semibold">contact us</Link> with order number {order.id} and we’ll sort it out.</p>}
    {order.status === 'cancelled' && order.cancelReason === 'payment_timeout' && <p className="mt-6 text-sm opacity-70">This order was cancelled because payment wasn’t completed.</p>}

    <section className="mt-10 border border-current/10 p-5 sm:p-6" aria-label="Order progress">
      <OrderStatusTimeline status={order.status} history={order.statusHistory} />
    </section>

    <section className="mt-6 border border-current/10 p-5 sm:p-6" aria-labelledby="shipping-title">
      <h2 id="shipping-title" className="flex items-center gap-2 font-bold"><Truck size={18} /> Delivery</h2>
      {order.trackingNumber
        ? <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm opacity-60">{order.carrier || 'Courier'} tracking number</p><p className="font-mono text-lg mt-1">{order.trackingNumber}</p></div>
          {order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-3 text-white text-xs font-bold uppercase tracking-widest" style={{ backgroundColor: theme.accentColor }}>Track with {order.carrier || 'courier'} <ExternalLink size={14} /></a>}
        </div>
        : <p className="mt-3 text-sm opacity-70">{shipped ? 'Your order has been handed to the courier. The tracking number will appear here shortly.' : order.status === 'cancelled' || order.status === 'pending_payment' ? 'This order won’t be shipped.' : 'We’ll add the courier and tracking number here as soon as your order ships.'}</p>}
      {order.shipTo?.address && <div className="mt-5 pt-5 border-t border-current/10 text-sm"><p className="opacity-60 mb-1">Delivering to</p><p className="font-semibold">{order.shipTo.name}</p><p className="whitespace-pre-line opacity-80">{order.shipTo.address}</p></div>}
    </section>

    <section className="mt-6 border border-current/10 p-5 sm:p-6" aria-labelledby="items-title">
      <h2 id="items-title" className="flex items-center gap-2 font-bold"><Package size={18} /> Items in this order</h2>
      <ul className="mt-4 divide-y divide-current/10">{(order.items || []).map((item) => <li key={`${item.id}-${item.size ?? ''}`} className="py-4 flex gap-4">
        {item.image ? <img src={item.image} alt="" className="w-16 h-20 object-cover shrink-0" /> : <span className="w-16 h-20 bg-current/10 shrink-0" />}
        <div className="flex-1 min-w-0">
          {item.slug ? <Link to={`/product/${item.slug}`} className="font-semibold hover:underline underline-offset-4">{item.name}</Link> : <p className="font-semibold">{item.name}</p>}
          <p className="text-sm opacity-60 mt-0.5">{item.size ? `Size ${item.size}, ` : ''}Qty {item.qty}</p>
          {order.status !== 'cancelled' && order.status !== 'pending_payment' && <p className="text-sm mt-2 font-medium" style={{ color: item.fulfillmentStatus === 'returned' ? undefined : theme.accentColor }}>{ITEM_STATUS[item.fulfillmentStatus] || item.fulfillmentStatus}{item.fulfillmentUpdatedAt ? <span className="font-normal opacity-60">, {shortDate(item.fulfillmentUpdatedAt)}</span> : null}</p>}
        </div>
        <p className="font-semibold shrink-0">{formatCurrency(item.price * item.qty)}</p>
      </li>)}</ul>
      <dl className="mt-2 pt-4 border-t border-current/10 grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
        <dt className="opacity-70">Subtotal</dt><dd className="text-right">{formatCurrency(order.subtotal)}</dd>
        {order.discount > 0 && <><dt className="opacity-70">Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt><dd className="text-right">−{formatCurrency(order.discount)}</dd></>}
        <dt className="opacity-70">Shipping</dt><dd className="text-right">{order.shipping ? formatCurrency(order.shipping) : 'Free'}</dd>
        {order.tax > 0 && <><dt className="opacity-70">GST</dt><dd className="text-right">{formatCurrency(order.tax)}</dd></>}
        <dt className="font-bold pt-1">Total</dt><dd className="text-right font-bold pt-1">{formatCurrency(order.total)}</dd>
      </dl>
      {invoiceHref && <a href={invoiceHref} target="_blank" rel="noopener" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"><FileText size={15} /> Download invoice {order.invoiceNumber}</a>}
    </section>

    {order.refunds?.length > 0 && <section className="mt-6 border border-current/10 p-5 sm:p-6" aria-labelledby="refunds-title">
      <h2 id="refunds-title" className="font-bold">Refunds</h2>
      <p className="text-sm opacity-70 mt-1">{formatCurrency(order.refundedTotal)} refunded{order.refundedTotal >= order.total ? ' in full' : ` of ${formatCurrency(order.total)}`}.</p>
      <ul className="mt-3 space-y-2 text-sm">{order.refunds.map((refund) => <li key={refund.id} className="flex flex-wrap justify-between gap-2">
        <span>{formatCurrency(refund.amount)} on {shortDate(refund.at)}{refund.method === 'razorpay' ? ' to your original payment method (5–7 working days to show up)' : ''}</span>
        {refund.creditNoteNumber && <a href={`/api/orders/${encodeURIComponent(order.id)}/refunds/${refund.id}/credit-note?track=${encodeURIComponent(order.trackToken)}`} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">Credit note {refund.creditNoteNumber}</a>}
      </li>)}</ul>
    </section>}

    {(order.returnRequest || order.refundRequest || canReturn) && <section className="mt-6 border border-current/10 p-5 sm:p-6" aria-labelledby="help-title">
      <h2 id="help-title" className="font-bold">Returns</h2>
      {[order.returnRequest && ['Return', order.returnRequest], order.refundRequest && ['Refund', order.refundRequest]].filter(Boolean).map(([label, value]) => <p key={label} className="mt-3 text-sm">{label} request sent {shortDate(value.requestedAt)}: <strong>{value.status === 'pending' ? 'we’re reviewing it' : value.status}</strong></p>)}
      {canReturn && !request.open && <button type="button" onClick={() => setRequest({ ...request, open: true })} className="mt-4 px-5 py-3 border border-current text-xs font-bold uppercase tracking-widest">Request a return</button>}
      {request.open && <form onSubmit={sendRequest} className="mt-4 space-y-4">
        <label className="block"><span className={labelClass}>What went wrong?</span><textarea required rows="3" maxLength={1000} value={request.reason} onChange={(event) => setRequest({ ...request, reason: event.target.value })} placeholder="e.g. The size is too small" className={`${inputClass} resize-y`} /></label>
        {requestState.error && <p className="text-sm text-red-700" role="alert">{requestState.error}</p>}
        <div className="flex gap-3"><button disabled={requestState.sending || !request.reason.trim()} className="px-5 py-3 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50" style={{ backgroundColor: theme.accentColor }}>{requestState.sending ? 'Sending…' : 'Send return request'}</button><button type="button" onClick={() => setRequest({ open: false, type: 'return', reason: '' })} className="text-xs uppercase tracking-widest opacity-60">Cancel</button></div>
      </form>}
    </section>}
  </article>;
}
