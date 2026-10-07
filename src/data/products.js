// Product catalog. `slug` drives the /product/:slug route and canonical URLs.
// Descriptions are written as direct, factual sentences (fabric, fit, era) so
// both search snippets and generative/AI answer engines can quote them accurately.
// `stockQty` is optional: set it (via the admin catalog editor) to have the
// server track and decrement real unit counts at checkout. Leave it unset to
// keep using the simple `inStock` boolean toggle.
export const PRODUCTS = [
  {
    id: 1,
    slug: 'clueless-plaid-set',
    name: 'The "Clueless" Plaid Set',
    movie: 'Clueless (1995)',
    price: 245.0,
    category: 'Sets',
    image: 'https://images.unsplash.com/photo-1705921345737-7545608c8a1f?auto=format&fit=crop&q=80&w=800',
    gallery: [
      'https://images.unsplash.com/photo-1705921345737-7545608c8a1f?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&q=80&w=1200',
    ],
    description:
      'A two-piece yellow plaid blazer and skirt set inspired by Cher Horowitz\'s wardrobe in Clueless. Structured shoulders, a cropped blazer, and a matching mini skirt in brushed wool-blend twill.',
    sizes: ['XS', 'S', 'M', 'L'],
    sku: 'ARC-CLU-001',
    rating: 0,
    reviewCount: 0,
    inStock: true,
  },
  {
    id: 2,
    slug: 'basic-instinct-white-halter',
    name: 'Basic Instinct White Halter',
    movie: 'Basic Instinct (1992)',
    price: 180.0,
    category: 'Dresses',
    image: 'https://images.unsplash.com/photo-1705921290229-413fc5a975b5?auto=format&fit=crop&q=80&w=800',
    gallery: [
      'https://images.unsplash.com/photo-1705921290229-413fc5a975b5?auto=format&fit=crop&q=80&w=1200',
    ],
    description:
      'A fitted white halter dress in stretch crepe, referencing the iconic 90s thriller silhouette. Falls just above the knee with a concealed back zip.',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    sku: 'ARC-BAS-002',
    rating: 0,
    reviewCount: 0,
    inStock: true,
  },
  {
    id: 3,
    slug: 'matrix-trench-coat',
    name: 'Matrix Trench Coat',
    movie: 'The Matrix (1999)',
    price: 450.0,
    category: 'Outerwear',
    image: 'https://images.unsplash.com/photo-1603124552830-30ee98dfe342?auto=format&fit=crop&q=80&w=800',
    gallery: [
      'https://images.unsplash.com/photo-1603124552830-30ee98dfe342?auto=format&fit=crop&q=80&w=1200',
    ],
    description:
      'A full-length black faux-leather trench with a stand collar and belted waist, modeled on the cyberpunk outerwear of The Matrix. Water-resistant finish, satin lining.',
    sizes: ['S', 'M', 'L', 'XL'],
    sku: 'ARC-MAT-003',
    rating: 0,
    reviewCount: 0,
    inStock: true,
    bestSeller: true,
  },
  {
    id: 4,
    slug: 'pretty-woman-polka-dots',
    name: 'Pretty Woman Polka Dots',
    movie: 'Pretty Woman (1990)',
    price: 195.0,
    category: 'Dresses',
    image: 'https://images.unsplash.com/photo-1597983073750-16f5ded1321f?auto=format&fit=crop&q=80&w=800',
    gallery: [
      'https://images.unsplash.com/photo-1597983073750-16f5ded1321f?auto=format&fit=crop&q=80&w=1200',
    ],
    description:
      'A white polka-dot day dress with a fitted bodice and A-line skirt, in cotton poplin. A softer, daywear nod to Pretty Woman\'s 90s wardrobe.',
    sizes: ['XS', 'S', 'M', 'L'],
    sku: 'ARC-PRE-004',
    rating: 0,
    reviewCount: 0,
    inStock: true,
  },
  {
    id: 5,
    slug: 'mia-wallace-crisp-shirt',
    name: 'Mia Wallace Crisp Shirt',
    movie: 'Pulp Fiction (1994)',
    price: 120.0,
    category: 'Tops',
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800',
    gallery: [
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1200',
    ],
    description:
      'A crisp white cotton poplin button-down with a relaxed collar, styled after Mia Wallace\'s look in Pulp Fiction. Pairs with tailored trousers or denim.',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    sku: 'ARC-MIA-005',
    rating: 0,
    reviewCount: 0,
    inStock: true,
  },
  {
    id: 6,
    slug: '10-things-prom-slip',
    name: '10 Things Prom Slip',
    movie: '10 Things I Hate About You (1999)',
    price: 210.0,
    category: 'Dresses',
    image: 'https://images.unsplash.com/photo-1614881064213-180b1c28f743?auto=format&fit=crop&q=80&w=800',
    gallery: [
      'https://images.unsplash.com/photo-1614881064213-180b1c28f743?auto=format&fit=crop&q=80&w=1200',
    ],
    description:
      'A bias-cut satin slip dress with adjustable straps, evoking the late-90s prom scene aesthetic. Available in midi length with a subtle side slit.',
    sizes: ['XS', 'S', 'M', 'L'],
    sku: 'ARC-TEN-006',
    rating: 0,
    reviewCount: 0,
    inStock: true,
  },
  {
    id: 7,
    slug: 'kanjeevaram-temple-border-saree',
    name: 'Kanjeevaram Temple Border Saree',
    movie: 'South Indian Cinema, 1990s',
    price: 320.0,
    category: 'Traditional Wear',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
    gallery: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1641699862936-be9f49b1c38d?auto=format&fit=crop&q=80&w=1200',
    ],
    description:
      'A pure mulberry silk saree woven in Kanchipuram, with a contrast temple-motif border and a heavy zari pallu, in the deep maroon-and-gold palette worn by leading ladies of 90s Tamil cinema. Comes with an unstitched matching blouse piece.',
    sizes: ['Free Size'],
    sku: 'ARC-KAN-007',
    rating: 0,
    reviewCount: 0,
    inStock: true,
    bestSeller: true,
  },
  {
    id: 8,
    slug: 'pattu-half-saree-jasmine-gold',
    name: 'Pattu Half-Saree, Jasmine & Gold',
    movie: 'South Indian Cinema, 1990s',
    price: 260.0,
    category: 'Traditional Wear',
    image: 'https://images.unsplash.com/photo-1618901185975-d59f7091bcfe?auto=format&fit=crop&q=80&w=800',
    gallery: [
      'https://images.unsplash.com/photo-1618901185975-d59f7091bcfe?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1676696706907-0e04665b80bd?auto=format&fit=crop&q=80&w=1200',
    ],
    description:
      'A three-piece pattu langa-voni set — a silk-cotton skirt, a gold-bordered dupatta, and a matching blouse — styled after the festive half-saree look of 90s Tamil Nadu screen heroines. Traditionally paired with jasmine gajra and temple jewellery.',
    sizes: ['XS', 'S', 'M', 'L'],
    sku: 'ARC-PAT-008',
    rating: 0,
    reviewCount: 0,
    inStock: true,
  },
];

export function getCatalog() {
  try {
    const storedProducts = JSON.parse(localStorage.getItem('archive-products') || 'null');
    const inventory = JSON.parse(localStorage.getItem('archive-inventory') || '{}');
    const catalog = Array.isArray(storedProducts) ? storedProducts : PRODUCTS;
    return catalog.map((product) => ({ ...product, inStock: inventory[product.id] ?? product.inStock }));
  } catch {
    return PRODUCTS;
  }
}

export function getProductBySlug(slug) {
  return getCatalog().find((p) => p.slug === slug);
}

export function getRelatedProducts(product, count = 3, catalog = getCatalog()) {
  return catalog.filter((p) => p.id !== product.id && p.category === product.category)
    .concat(catalog.filter((p) => p.id !== product.id && p.category !== product.category))
    .slice(0, count);
}
