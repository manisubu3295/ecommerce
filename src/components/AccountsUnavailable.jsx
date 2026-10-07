import React from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';

// Shown on the sign-in pages while customer accounts are switched off
// (they need the store's email set up to send verification codes).
export default function AccountsUnavailable() {
  return (
    <div className="mb-8 border border-current/15 bg-current/5 p-4 text-sm flex gap-3" role="status">
      <Info size={18} className="shrink-0 mt-0.5 opacity-70" />
      <p className="opacity-80">
        Customer accounts are coming soon. You can check out as a guest now, and follow your order on{' '}
        <Link to="/track-order" className="underline underline-offset-4 font-semibold">Track Order</Link> with your email and mobile number.
      </p>
    </div>
  );
}
