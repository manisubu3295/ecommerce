import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, RotateCcw, XCircle } from 'lucide-react';
import Seo from '../components/Seo.jsx';
import OrderStatusTimeline from '../components/OrderStatusTimeline.jsx';
import { formatCurrency } from '../data/siteConfig.js';
import { useCart } from '../context/CartContext.jsx';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const orderId = searchParams.get('order') || 'N/A';
  const accessToken = searchParams.get('access') || '';
  const [requestType, setRequestType] = useState('');
  const [reason, setReason] = useState('');
  const [requestStatus, setRequestStatus] = useState('');
  const [orderStatus, setOrderStatus] = useState(null);

  useEffect(() => {
    if (!accessToken || orderId === 'N/A') return;
    fetch(`/api/orders/${orderId}?access=${encodeURIComponent(accessToken)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        setOrderStatus(data);
        // Razorpay's redirect flow lands here directly (no in-page success
        // callback ever ran), so the cart is only cleared once the server
        // confirms the payment actually went through.
        if (data?.status && data.status !== 'pending_payment') clearCart();
      })
      .catch(() => {});
  }, [accessToken, orderId]);

  // The server leaves the order as `pending_payment` — instead of losing it —
  // when the Razorpay redirect comes back unpaid or unverified.
  const paymentIncomplete = orderStatus?.status === 'pending_payment';

  const submitRequest = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`/api/orders/${orderId}/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Order-Token': accessToken }, body: JSON.stringify({ type: requestType, reason }) });
      setRequestStatus(response.ok ? 'Your request was submitted for review.' : 'We could not submit the request. Please contact support.');
      if (response.ok) { setRequestType(''); setReason(''); }
    } catch {
      setRequestStatus('We could not submit the request. Please check your connection and contact support if it persists.');
    }
  };

  return (
    <>
      <Seo path="/order-success" title="Order Confirmed" noindex />
      <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-32 w-full text-center">
        {paymentIncomplete ? (
          <>
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <XCircle size={40} className="text-red-500" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Payment Not Completed</h1>
            <p className="opacity-60 mb-2">Order reference:</p>
            <p className="font-mono text-lg mb-8">{orderId}</p>
            <p className="opacity-60 mb-10">Your payment was cancelled or could not be verified, so this order hasn't been placed. Your cart is untouched — you can try checkout again.</p>
            <Link to="/shop" className="underline underline-offset-4 font-bold uppercase text-sm tracking-widest">
              Return to Shop
            </Link>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 mx-auto">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Order Confirmed</h1>
            <p className="opacity-60 mb-2">Order reference:</p>
            <p className="font-mono text-lg mb-8">{orderId}</p>
            <p className="opacity-60 mb-10">Your order is being prepared for dispatch. Keep this order reference for support and tracking.</p>
            {orderStatus && (
              <div className="mb-10 border border-current/10 p-5 text-left">
                <p className="text-xs uppercase tracking-widest opacity-50 mb-5">Fulfillment status</p>
                <OrderStatusTimeline status={orderStatus.status} history={orderStatus.statusHistory} />
                {orderStatus.invoice?.seller && <a href={`/api/orders/${encodeURIComponent(orderId)}/invoice?access=${encodeURIComponent(accessToken)}`} target="_blank" rel="noopener" className="inline-block mt-6 text-sm font-semibold underline underline-offset-4">Download invoice {orderStatus.invoice.number}</a>}
                {orderStatus.trackingNumber && <p className="mt-6 text-sm">{orderStatus.carrier || 'Courier'}: {orderStatus.trackingUrl ? <a className="underline" href={orderStatus.trackingUrl} target="_blank" rel="noreferrer">{orderStatus.trackingNumber}</a> : orderStatus.trackingNumber}</p>}
                {Array.isArray(orderStatus.items) && orderStatus.items.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-current/10 space-y-2">
                    {orderStatus.items.map((item) => (
                      <div key={`${item.id}-${item.size ?? ''}`} className="flex justify-between text-sm">
                        <span>{item.name}{item.size ? ` · Size ${item.size}` : ''} × {item.qty}</span>
                        <span>{formatCurrency(item.price * item.qty)}</span>
                      </div>
                    ))}
                    {orderStatus.discount > 0 && (
                      <div className="flex justify-between text-sm text-emerald-600">
                        <span>Discount {orderStatus.couponCode ? `(${orderStatus.couponCode})` : ''}</span>
                        <span>-{formatCurrency(orderStatus.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-current/10">
                      <span>Total</span>
                      <span>{formatCurrency(orderStatus.total)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="border border-current/10 p-5 text-left mb-10">
              <div className="flex items-center gap-2 mb-3"><RotateCcw size={16} /><h2 className="text-sm font-bold uppercase tracking-widest">Returns & refunds</h2></div>
              <p className="text-sm opacity-60 mb-4">Need help with this order? Submit a request for admin review.</p>
              {requestStatus ? <p className="text-sm text-emerald-700" role="status">{requestStatus}</p> : <form onSubmit={submitRequest} className="space-y-3"><div className="flex gap-2"><button type="button" onClick={() => setRequestType('return')} className={`flex-1 border px-3 py-2 text-xs uppercase tracking-widest ${requestType === 'return' ? 'bg-black text-white' : ''}`}>Return</button><button type="button" onClick={() => setRequestType('refund')} className={`flex-1 border px-3 py-2 text-xs uppercase tracking-widest ${requestType === 'refund' ? 'bg-black text-white' : ''}`}>Refund</button></div>{requestType && <><textarea required value={reason} onChange={(event) => setReason(event.target.value)} rows="3" placeholder="Tell us what happened" className="w-full border border-current/20 bg-transparent px-3 py-2 text-sm outline-none" /><button type="submit" className="w-full bg-black px-3 py-3 text-xs font-bold uppercase tracking-widest text-white">Submit for review</button></>}</form>}
            </div>
            <Link to="/shop" className="underline underline-offset-4 font-bold uppercase text-sm tracking-widest">
              Continue Shopping
            </Link>
          </>
        )}
      </main>
    </>
  );
}
