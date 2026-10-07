import React from 'react';
import { SITE_CONFIG } from '../data/siteConfig.js';

// Pre-launch label on every storefront page: a ribbon across the top-left
// corner on desktop, and a small pill bottom-left on phones (where the corner
// holds the menu button). Turn it off on launch day with
// SITE_CONFIG.launchingSoon (build with VITE_LAUNCHING_SOON=false).
export default function LaunchingSoon({ color }) {
  if (!SITE_CONFIG.launchingSoon) return null;
  const label = `${SITE_CONFIG.name} is launching soon`;
  return (
    <>
      <div className="hidden lg:block pointer-events-none fixed top-0 left-0 z-[55] w-[170px] h-[170px] overflow-hidden" role="status" aria-label={label}>
        {/* A 240px band centred at (62, 62), i.e. squarely across the corner. */}
        <div
          className="absolute top-[48px] -left-[58px] w-[240px] -rotate-45 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.25em] text-white shadow-lg ring-1 ring-white/40"
          style={{ backgroundColor: color }}
        >
          Launching soon
        </div>
      </div>
      <div
        className="lg:hidden pointer-events-none fixed bottom-5 left-4 z-[55] rounded-full px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-lg ring-1 ring-white/40"
        style={{ backgroundColor: color }}
        role="status"
        aria-label={label}
      >
        Launching soon
      </div>
    </>
  );
}
