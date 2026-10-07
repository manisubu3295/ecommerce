import React from 'react';
import { Link } from 'react-router-dom';
import { Globe2, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext.jsx';
import { SITE_CONFIG, formatCurrency } from '../data/siteConfig.js';
import { policySettings, shippingPromise } from '../lib/policies.js';

// The shop's promises, stated plainly and linked to the policy behind each —
// built from Store settings so it never promises more than the policies do.
export default function TrustBar({ compact = false }) {
  const { settings } = useCatalog();
  const policy = policySettings(settings);
  const items = [
    { icon: ShieldCheck, title: 'Secure payment', detail: 'UPI, cards and net banking via Razorpay', to: '/policies/terms' },
    { icon: Truck, title: shippingPromise(settings?.pricing, formatCurrency), detail: `Dispatched in ${policy.dispatchDays} business days`, to: '/policies/shipping' },
    policy.returnDays
      ? { icon: RotateCcw, title: `${policy.returnDays}-day returns`, detail: 'Unused, with tags attached', to: '/policies/returns' }
      : { icon: RotateCcw, title: 'Damaged or wrong item?', detail: 'Replaced or refunded in full', to: '/policies/returns' },
    { icon: Globe2, title: 'Ships across India', detail: `and to ${SITE_CONFIG.shipsTo.filter((r) => r.code !== 'IN').map((r) => r.name).join(' and ')}`, to: '/policies/shipping' },
  ];

  return (
    <section aria-label="Shopping with us" className={compact ? '' : 'border-b border-current/10'}>
      <ul className={`grid grid-cols-2 lg:grid-cols-4 ${compact ? 'gap-4' : 'max-w-7xl mx-auto divide-current/10 lg:divide-x'}`}>
        {items.map(({ icon: Icon, title, detail, to }) => (
          <li key={title}>
            <Link to={to} className={`flex items-start gap-3 hover:opacity-80 transition-opacity ${compact ? '' : 'px-4 sm:px-6 lg:px-8 py-6'}`}>
              <Icon size={20} className="shrink-0 mt-0.5 opacity-70" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs opacity-60 mt-0.5">{detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
