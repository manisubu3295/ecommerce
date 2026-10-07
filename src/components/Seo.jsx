import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_CONFIG } from '../data/siteConfig.js';

/**
 * Per-page SEO: title/description/canonical, Open Graph + Twitter cards, and
 * any number of JSON-LD structured-data blocks (Product, BreadcrumbList, FAQPage, ...).
 */
export default function Seo({ title, description, path = '/', image, jsonLd = [], noindex = false }) {
  const fullTitle = title ? `${title} | ${SITE_CONFIG.name}` : `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`;
  const desc = description || SITE_CONFIG.defaultDescription;
  const url = `${SITE_CONFIG.siteUrl}${path}`;
  const img = image ? (image.startsWith('http') ? image : `${SITE_CONFIG.siteUrl}${image}`) : `${SITE_CONFIG.siteUrl}${SITE_CONFIG.defaultImage}`;
  const structuredData = Array.isArray(jsonLd) ? jsonLd : [jsonLd];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={path.startsWith('/product/') ? 'product' : 'website'} />
      <meta property="og:site_name" content={SITE_CONFIG.name} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      {SITE_CONFIG.twitterHandle && <meta name="twitter:site" content={SITE_CONFIG.twitterHandle} />}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />

      {structuredData.map((data, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
}
