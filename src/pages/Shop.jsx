import React, { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCatalog } from '../context/CatalogContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import Pagination from '../components/Pagination.jsx';
import Seo from '../components/Seo.jsx';
import { breadcrumbJsonLd, itemListJsonLd } from '../lib/jsonld.js';
import { catalogFacets, filterProducts, paginate } from '../lib/catalogFilter.js';

const listParam = (value) => (value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []);
const numberParam = (value) => (value === null || value === '' || Number.isNaN(Number(value)) ? null : Number(value));

// Every filter lives in the URL, so a filtered view can be shared or bookmarked
// and the back button restores it.
export default function Shop() {
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const { products: catalog, categories: catalogCategories } = useCatalog();

  const category = searchParams.get('category') || 'All';
  const search = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'relevance';
  const minPrice = searchParams.get('min') || '';
  const maxPrice = searchParams.get('max') || '';
  const sizes = listParam(searchParams.get('size'));
  const colors = listParam(searchParams.get('color'));
  const inStockOnly = searchParams.get('stock') === '1';
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1);

  const categories = ['All', ...new Set([...catalogCategories, ...catalog.map((p) => p.category)].filter(Boolean))];
  const facets = useMemo(() => catalogFacets(catalog), [catalog]);

  // Any filter change starts again from the first page.
  const update = (changes) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value == null || (Array.isArray(value) && !value.length)) params.delete(key);
      else params.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    if (!('page' in changes)) params.delete('page');
    setSearchParams(params, { replace: true });
  };
  const toggle = (key, list, value) => update({ [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] });

  const filtered = useMemo(() => filterProducts(catalog, {
    category, query: search, sizes, colors, min: numberParam(minPrice), max: numberParam(maxPrice), inStockOnly, sort,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [catalog, category, search, sort, minPrice, maxPrice, inStockOnly, sizes.join(','), colors.join(',')]);
  const pageView = paginate(filtered, page);
  const visible = pageView.items;
  const hrefFor = (target) => {
    const params = new URLSearchParams(searchParams);
    if (target > 1) params.set('page', String(target)); else params.delete('page');
    const query = params.toString();
    return `/shop${query ? `?${query}` : ''}`;
  };
  // Changing page swaps the whole grid, so bring its top into view.
  const gridTopRef = useRef(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pageView.page]);
  const activeFilters = [
    category !== 'All' && { label: category, clear: { category: '' } },
    ...sizes.map((size) => ({ label: `Size ${size}`, clear: { size: sizes.filter((s) => s !== size) } })),
    ...colors.map((color) => ({ label: color, clear: { color: colors.filter((c) => c !== color) } })),
    (minPrice || maxPrice) && { label: `₹${minPrice || 0} – ${maxPrice ? `₹${maxPrice}` : 'any'}`, clear: { min: '', max: '' } },
    inStockOnly && { label: 'In stock', clear: { stock: '' } },
    search && { label: `“${search}”`, clear: { q: '' } },
  ].filter(Boolean);

  const chip = (active) => `px-3 py-1.5 border text-xs font-bold uppercase tracking-widest transition-colors ${active ? 'text-white border-transparent' : 'border-current/20 hover:border-current'}`;

  return (
    <>
      <Seo
        path={pageView.page > 1 ? `/shop?page=${pageView.page}` : '/shop'}
        title={pageView.page > 1 ? `Shop All Collections — Page ${pageView.page}` : 'Shop All Collections'}
        description="Browse the full Barani's Couture collection: 90s-cinema-inspired plaid sets, slip dresses, trench coats and tops. Filter by category, worldwide shipping."
        jsonLd={[
          breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }]),
          itemListJsonLd(visible, '/shop'),
        ]}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="mb-12">
          <h1 className={`text-4xl md:text-5xl font-bold mb-4 tracking-tight ${theme.fontHeading}`}>Shop All</h1>
          <p className="opacity-60 text-lg font-light max-w-2xl">
            Every piece in the archive, in one place. Filter by category to find your era.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(event) => update({ q: event.target.value })}
              placeholder="Search by name, movie or colour..."
              aria-label="Search products"
              className="w-full pl-11 pr-4 py-3 bg-transparent border border-current/20 focus:border-current outline-none text-sm"
            />
          </div>
          <div>
            <label htmlFor="category-filter" className="sr-only">Filter by category</label>
            <select id="category-filter" value={category} onChange={(event) => update({ category: event.target.value === 'All' ? '' : event.target.value })} className="w-full sm:w-56 px-4 py-3 border border-current/20 focus:border-current outline-none text-xs font-bold tracking-widest uppercase" style={{ backgroundColor: theme.bgColor, color: theme.textColor }}>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sort-filter" className="sr-only">Sort by</label>
            <select id="sort-filter" value={sort} onChange={(event) => update({ sort: event.target.value === 'relevance' ? '' : event.target.value })} className="w-full sm:w-56 px-4 py-3 border border-current/20 focus:border-current outline-none text-xs font-bold tracking-widest uppercase" style={{ backgroundColor: theme.bgColor, color: theme.textColor }}>
              <option value="relevance">Sort: Relevance</option>
              <option value="newest">Sort: Newest</option>
              <option value="price-asc">Sort: Price, Low to High</option>
              <option value="price-desc">Sort: Price, High to Low</option>
              <option value="rating">Sort: Top Rated</option>
            </select>
          </div>
        </div>

        <div className="border-y border-current/10 py-5 mb-8 space-y-4">
          {facets.sizes.length > 0 && <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">Size</legend>
            <span className="text-xs font-bold uppercase tracking-widest opacity-60 w-16" aria-hidden="true">Size</span>
            {facets.sizes.map((size) => <button key={size} type="button" aria-pressed={sizes.includes(size)} onClick={() => toggle('size', sizes, size)} className={chip(sizes.includes(size))} style={sizes.includes(size) ? { backgroundColor: theme.accentColor } : undefined}>{size}</button>)}
          </fieldset>}
          {facets.colors.length > 0 && <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">Colour</legend>
            <span className="text-xs font-bold uppercase tracking-widest opacity-60 w-16" aria-hidden="true">Colour</span>
            {facets.colors.map((color) => { const on = colors.some((c) => c.toLowerCase() === color.toLowerCase()); return <button key={color} type="button" aria-pressed={on} onClick={() => toggle('color', colors, color)} className={chip(on)} style={on ? { backgroundColor: theme.accentColor } : undefined}>{color}</button>; })}
          </fieldset>}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-xs font-bold uppercase tracking-widest opacity-60 w-16">Price</span>
            <input type="number" min="0" value={minPrice} onChange={(event) => update({ min: event.target.value })} placeholder="Min" aria-label="Minimum price" className="w-24 px-3 py-2 bg-transparent border border-current/20 focus:border-current outline-none" />
            <span className="opacity-40" aria-hidden="true">–</span>
            <input type="number" min="0" value={maxPrice} onChange={(event) => update({ max: event.target.value })} placeholder={facets.maxPrice ? `Max ${Math.ceil(facets.maxPrice)}` : 'Max'} aria-label="Maximum price" className="w-28 px-3 py-2 bg-transparent border border-current/20 focus:border-current outline-none" />
            <label className="inline-flex items-center gap-2 ml-2 cursor-pointer"><input type="checkbox" checked={inStockOnly} onChange={(event) => update({ stock: event.target.checked ? '1' : '' })} /> <span className="text-xs font-bold uppercase tracking-widest">In stock only</span></label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-10">
          <p className="text-sm opacity-60" aria-live="polite">{filtered.length === catalog.length ? `${catalog.length} pieces` : `${filtered.length} of ${catalog.length} pieces`}</p>
          {activeFilters.length > 0 && <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((filter) => <button key={filter.label} type="button" onClick={() => update(filter.clear)} className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-current/20 text-xs hover:border-current" aria-label={`Remove filter ${filter.label}`}>{filter.label} <X size={12} aria-hidden="true" /></button>)}
            <button type="button" onClick={() => setSearchParams(sort !== 'relevance' ? { sort } : {}, { replace: true })} className="text-xs font-bold uppercase tracking-widest underline underline-offset-4 opacity-60 hover:opacity-100">Clear all</button>
          </div>}
        </div>

        {filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="opacity-60 text-lg">No pieces match these filters.</p>
            {activeFilters.length > 0 && <button type="button" onClick={() => setSearchParams({}, { replace: true })} className="mt-4 text-xs font-bold uppercase tracking-widest underline underline-offset-4">Clear filters</button>}
          </div>
        ) : (
          <>
            <div ref={gridTopRef} className="scroll-mt-28" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
              {visible.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
            <div className="mt-16 flex flex-col items-center gap-4">
              <Pagination page={pageView.page} totalPages={pageView.totalPages} hrefFor={hrefFor} accentColor={theme.accentColor} label="Collection pages" />
              <p className="text-sm opacity-60">Showing {pageView.start + 1}–{pageView.end} of {filtered.length}</p>
            </div>
          </>
        )}
      </main>
    </>
  );
}
