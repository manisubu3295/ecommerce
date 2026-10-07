import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
import { SITE_CONFIG } from '../data/siteConfig.js';
import Seo from '../components/Seo.jsx';
import { breadcrumbJsonLd } from '../lib/jsonld.js';

export default function About() {
  const { theme } = useTheme();

  return (
    <>
      <Seo
        path="/about"
        title="Our Story"
        description="Barani's Couture restyles iconic 90s movie wardrobes into wearable, modern pieces. Learn about our sourcing, construction and sustainability approach."
        jsonLd={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Our Story', path: '/about' }])}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <h1 className={`text-5xl font-bold mb-8 tracking-tight ${theme.fontHeading}`}>Our Story</h1>
        <p className="opacity-70 text-lg leading-relaxed mb-6">
          {SITE_CONFIG.name} began as a love letter to the wardrobe department of 90s cinema — the plaid of
          Beverly Hills, the slip dresses of a suburban prom, the leather of a dystopian future. We research
          each silhouette against the film it references, then reconstruct it in modern, durable fabrics sized
          for today's bodies.
        </p>
        <p className="opacity-70 text-lg leading-relaxed mb-6">
          Every piece ships from our studio to {SITE_CONFIG.shipsTo.map((r) => r.name).join(', ')}, with
          worldwide shipping available on request. We keep runs small and seasonal, so the current collection
          will retire when the next one premieres.
        </p>
        <p className="opacity-70 text-lg leading-relaxed">
          Have a question about fit, fabric or a specific film reference? Visit our{' '}
          <a href="/faq" className="underline underline-offset-4">FAQ</a> or{' '}
          <a href="/contact" className="underline underline-offset-4">get in touch</a>.
        </p>
      </main>
    </>
  );
}
