import { SITE_CONFIG } from '../data/siteConfig.js';

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_CONFIG.legalName,
    alternateName: SITE_CONFIG.name,
    url: SITE_CONFIG.siteUrl,
    logo: `${SITE_CONFIG.siteUrl}${SITE_CONFIG.defaultImage}`,
    email: SITE_CONFIG.email,
    sameAs: Object.values(SITE_CONFIG.social),
    areaServed: SITE_CONFIG.shipsTo.map((r) => r.name),
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_CONFIG.siteUrl}/shop?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(items) {
  // items: [{ name, path }]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_CONFIG.siteUrl}${item.path}`,
    })),
  };
}

export function productJsonLd(product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: product.gallery?.length ? product.gallery : [product.image],
    category: product.category,
    brand: { '@type': 'Brand', name: SITE_CONFIG.name },
    aggregateRating: product.reviewCount
      ? {
          '@type': 'AggregateRating',
          ratingValue: product.rating,
          reviewCount: product.reviewCount,
        }
      : undefined,
    offers: {
      '@type': 'Offer',
      url: `${SITE_CONFIG.siteUrl}/product/${product.slug}`,
      priceCurrency: SITE_CONFIG.currency,
      price: product.price.toFixed(2),
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      eligibleRegion: SITE_CONFIG.shipsTo.map((r) => ({ '@type': 'Country', name: r.name })),
    },
  };
}

export function itemListJsonLd(products, path = '/shop') {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_CONFIG.siteUrl}/product/${p.slug}`,
      name: p.name,
    })),
    url: `${SITE_CONFIG.siteUrl}${path}`,
  };
}

export function articleJsonLd(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.cover_image ? [post.cover_image] : undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: { '@type': 'Organization', name: SITE_CONFIG.name },
    publisher: { '@type': 'Organization', name: SITE_CONFIG.name, logo: { '@type': 'ImageObject', url: `${SITE_CONFIG.siteUrl}${SITE_CONFIG.defaultImage}` } },
    mainEntityOfPage: `${SITE_CONFIG.siteUrl}/blog/${post.slug}`,
  };
}

export function localBusinessJsonLd(location) {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: `${SITE_CONFIG.name} — ${location.city}`,
    url: `${SITE_CONFIG.siteUrl}/shipping/${location.slug}`,
    areaServed: { '@type': 'City', name: location.city, containedInPlace: { '@type': location.country === 'Singapore' ? 'Country' : 'State', name: location.region } },
    parentOrganization: { '@type': 'Organization', name: SITE_CONFIG.name, url: SITE_CONFIG.siteUrl },
  };
}

export function faqJsonLd(faqs) {
  // faqs: [{ question, answer }]
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}
