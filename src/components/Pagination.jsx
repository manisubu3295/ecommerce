import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageNumbers } from '../lib/catalogFilter.js';

// Numbered pager. Pass `hrefFor(page)` for real links (crawlable, bookmarkable)
// or `onSelect(page)` for in-page state such as Track Order results.
export default function Pagination({ page, totalPages, hrefFor, onSelect, accentColor, label = 'Pagination' }) {
  if (totalPages <= 1) return null;
  const base = 'min-w-10 h-10 px-3 inline-flex items-center justify-center border text-sm font-semibold transition-colors';
  const idle = `${base} border-current/20 hover:border-current`;
  const disabled = `${base} border-current/10 opacity-30 cursor-not-allowed`;

  const control = (target, content, { ariaLabel, current = false } = {}) => {
    if (target < 1 || target > totalPages) return <span className={disabled} aria-hidden="true">{content}</span>;
    const props = {
      className: current ? `${base} text-white border-transparent` : idle,
      style: current ? { backgroundColor: accentColor } : undefined,
      'aria-label': ariaLabel,
      'aria-current': current ? 'page' : undefined,
    };
    return hrefFor
      ? <Link to={hrefFor(target)} {...props}>{content}</Link>
      : <button type="button" onClick={() => onSelect(target)} {...props}>{content}</button>;
  };

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-2">
      {control(page - 1, <ChevronLeft size={16} />, { ariaLabel: 'Previous page' })}
      {pageNumbers(page, totalPages).map((n, index) => (n === null
        ? <span key={`gap-${index}`} className="px-1 opacity-50" aria-hidden="true">…</span>
        : <React.Fragment key={n}>{control(n, n, { ariaLabel: `Page ${n}`, current: n === page })}</React.Fragment>))}
      {control(page + 1, <ChevronRight size={16} />, { ariaLabel: 'Next page' })}
    </nav>
  );
}
