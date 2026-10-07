import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogFacets, filterProducts, isAvailable, pageNumbers, paginate } from './catalogFilter.js';

const products = [
  { id: 1, name: 'Plaid Set', category: 'Sets', price: 245, sizes: ['S', 'M', 'L'], colors: ['Yellow'], inStock: true },
  { id: 2, name: 'Temple Saree', category: 'Traditional Wear', price: 320, sizes: ['Free'], colors: ['Maroon', 'Gold'], inStock: true, stockQty: 0 },
  { id: 3, name: 'Halter Dress', category: 'Dresses', price: 180, sizes: ['XS', 'M'], colors: ['white'], inStock: true, sizeStock: { XS: 0, M: 2 } },
  { id: 4, name: 'Trench Coat', category: 'Outerwear', price: 450, sizes: ['M', 'XL'], inStock: false },
];

test('availability respects stock counts, per-size stock and the hide switch', () => {
  assert.equal(isAvailable(products[0]), true);
  assert.equal(isAvailable(products[1]), false);
  assert.equal(isAvailable(products[2], 'XS'), false);
  assert.equal(isAvailable(products[2], 'M'), true);
  assert.equal(isAvailable(products[3]), false);
});

test('facets list sizes in wearing order and colours without duplicates', () => {
  const facets = catalogFacets([...products, { id: 5, sizes: ['S'], colors: ['yellow'], price: 10 }]);
  assert.deepEqual(facets.sizes, ['XS', 'S', 'M', 'L', 'XL', 'Free']);
  assert.deepEqual(facets.colors, ['Gold', 'Maroon', 'white', 'Yellow']);
  assert.equal(facets.maxPrice, 450);
});

test('filters combine: category, size, colour, price, stock, search', () => {
  const ids = (options) => filterProducts(products, options).map((p) => p.id).sort();
  assert.deepEqual(ids({ sizes: ['M'] }), [1, 3, 4]);
  assert.deepEqual(ids({ sizes: ['M'], inStockOnly: true }), [1, 3]);
  assert.deepEqual(ids({ sizes: ['XS'], inStockOnly: true }), []);
  assert.deepEqual(ids({ colors: ['WHITE', 'gold'] }), [2, 3]);
  assert.deepEqual(ids({ min: 200, max: 400 }), [1, 2]);
  assert.deepEqual(ids({ query: 'saree' }), [2]);
  assert.deepEqual(ids({ query: 'maroon' }), [2]);
  assert.deepEqual(ids({ category: 'Dresses', sizes: ['M'] }), [3]);
});

test('relevance puts sold-out pieces last; price sort works', () => {
  assert.deepEqual(filterProducts(products).map((p) => p.id), [1, 3, 2, 4]);
  assert.deepEqual(filterProducts(products, { sort: 'price-asc' }).map((p) => p.id), [3, 1, 2, 4]);
});

test('paginate slices one page and clamps out-of-range pages', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);
  assert.deepEqual(paginate(items, 1, 12), { items: items.slice(0, 12), page: 1, totalPages: 3, start: 0, end: 12 });
  assert.deepEqual(paginate(items, 3, 12).items, [25]);
  assert.equal(paginate(items, 9, 12).page, 3);
  assert.equal(paginate(items, 'abc', 12).page, 1);
  assert.deepEqual(paginate([], 2, 12), { items: [], page: 1, totalPages: 1, start: 0, end: 0 });
});

test('pageNumbers keeps first, last and neighbours with gaps between', () => {
  assert.deepEqual(pageNumbers(1, 3), [1, 2, 3]);
  assert.deepEqual(pageNumbers(5, 10), [1, null, 4, 5, 6, null, 10]);
  assert.deepEqual(pageNumbers(1, 10), [1, 2, null, 10]);
});
