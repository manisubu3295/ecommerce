import React from 'react';
import { Check, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

const STEPS = [
  { key: 'placed', label: 'Ordered' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// `history` is the order's statusHistory ([{ status, at }]); when present,
// each completed step shows the date it happened.
export default function OrderStatusTimeline({ status, history = [] }) {
  const { theme } = useTheme();
  const when = Object.fromEntries(history.map((event) => [event.status, event.at]));

  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-3 text-red-600">
        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
          <X size={16} />
        </div>
        <p className="font-semibold text-sm">This order was cancelled{when.cancelled ? ` on ${shortDate(when.cancelled)}` : ''}.</p>
      </div>
    );
  }

  // Ordered is always done; after that the furthest step reached wins.
  let currentIndex = 0;
  if (when.packed) currentIndex = 1;
  if (status === 'shipped' || when.shipped) currentIndex = 2;
  if (status === 'delivered') currentIndex = 3;

  return (
    <ol className="flex items-start" aria-label="Order progress">
      {STEPS.map((step, i) => {
        const complete = i <= currentIndex;
        const isLast = i === STEPS.length - 1;
        const date = complete && when[step.key];
        return (
          <li key={step.key} className={`flex items-center ${isLast ? '' : 'flex-1'}`} aria-current={i === currentIndex ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white transition-colors"
                style={{ backgroundColor: complete ? theme.accentColor : undefined }}
              >
                {complete ? <Check size={16} aria-hidden="true" /> : <span className="w-2 h-2 rounded-full bg-current opacity-30" />}
              </div>
              <p className={`text-[10px] uppercase tracking-widest mt-2 text-center ${complete ? 'font-bold' : 'opacity-50'}`}>{step.label}<span className="sr-only">{complete ? ', done' : ', not yet'}</span></p>
              {date && <p className="text-[11px] opacity-60 mt-0.5 whitespace-nowrap">{shortDate(date)}</p>}
            </div>
            {!isLast && (
              <div
                className={`flex-grow h-0.5 mx-2 mb-5 ${i < currentIndex ? '' : 'bg-current opacity-10'}`}
                style={i < currentIndex ? { backgroundColor: theme.accentColor } : undefined}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
