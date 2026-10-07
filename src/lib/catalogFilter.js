// Shop filtering, sorting and facets — pure functions so the rules are tested
// and the Shop page stays a thin view over them.

export const PAGE_SIZE = 12;

// One page of `items`. Out-of-range pages clamp to the nearest real page so a
// stale ?page=9 link after products are removed still shows something.
export function paginate(items, page, size = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Number.parseInt(page, 10) || 1), totalPages);
  const start = (current - 1) * size;
  return { items: items.slice(start, start + size), page: current, totalPages, start, end: Math.min(start + size, items.length) };
}

// Page buttons to show: first, last, and a window around the current page,
// with null where a run of pages is skipped (rendered as "…").
export function pageNumbers(current, totalPages, around = 1) {
  const pages = [];
  for (let n = 1; n <= totalPages; n += 1) {
    if (n === 1 || n === totalPages || Math.abs(n - current) <= around) pages.push(n);
    else if (pages[pages.length - 1] !== null) pages.push(null);
  }
  return pages;
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free', 'Free Size'];
const sizeRank = (size) => {
  const index = SIZE_ORDER.indexOf(size);
  if (index >= 0) return index;
  const number = Number.parseFloat(size);
  return Number.isFinite(number) ? 100 + number : 1000;
};

// Can this product (optionally in this size) be bought right now?
export function isAvailable(product, size = null) {
  if (!product.inStock) return false;
  if (product.sizeStock && typeof product.sizeStock === 'object') {
    return size ? (Number(product.sizeStock[size]) || 0) > 0 : Object.values(product.sizeStock).some((qty) => Number(qty) > 0);
  }
  return !Number.isFinite(product.stockQty) || product.stockQty > 0;
}

const normalizeColor = (color) => String(color || '').trim().toLowerCase();

export function productColors(product) {
  return (Array.isArray(product.colors) ? product.colors : []).map((color) => String(color).trim()).filter(Boolean);
}

// Options to offer in the filter bar, from the whole catalog.
export function catalogFacets(products) {
  const sizes = new Set();
  const colors = new Map();
  let maxPrice = 0;
  for (const product of products) {
    (product.sizes || []).forEach((size) => sizes.add(size));
    productColors(product).forEach((color) => { if (!colors.has(normalizeColor(color))) colors.set(normalizeColor(color), color); });
    maxPrice = Math.max(maxPrice, Number(product.price) || 0);
  }
  return {
    sizes: [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b) || String(a).localeCompare(String(b))),
    colors: [...colors.values()].sort((a, b) => a.localeCompare(b)),
    maxPrice,
  };
}

export function filterProducts(products, { category = 'All', query = '', sizes = [], colors = [], min = null, max = null, inStockOnly = false, sort = 'relevance' } = {}) {
  const q = query.trim().toLowerCase();
  const wantedColors = colors.map(normalizeColor);
  const result = products.filter((p) => {
    if (category !== 'All' && p.category !== category) return false;
    if (q && ![p.name, p.movie, p.description, p.category, p.sku, ...productColors(p)].some((field) => String(field || '').toLowerCase().includes(q))) return false;
    if (min != null && Number(p.price) < min) return false;
    if (max != null && Number(p.price) > max) return false;
    if (sizes.length && !sizes.some((size) => (p.sizes || []).includes(size) && (!inStockOnly || isAvailable(p, size)))) return false;
    if (wantedColors.length && !productColors(p).some((color) => wantedColors.includes(normalizeColor(color)))) return false;
    if (inStockOnly && !isAvailable(p)) return false;
    return true;
  });
  const sorted = [...result];
  if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  else if (sort === 'newest') sorted.sort((a, b) => b.id - a.id);
  else if (sort === 'rating') sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));
  // "Relevance": in-stock pieces before sold-out ones, otherwise catalog order.
  else sorted.sort((a, b) => Number(isAvailable(b)) - Number(isAvailable(a)));
  return sorted;
}
