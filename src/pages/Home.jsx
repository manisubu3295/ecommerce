import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCatalog } from '../context/CatalogContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import TrustBar from '../components/TrustBar.jsx';
import Seo from '../components/Seo.jsx';
import { organizationJsonLd, websiteJsonLd, itemListJsonLd } from '../lib/jsonld.js';

export default function Home() {
  const { theme } = useTheme();
  const { products, categories } = useCatalog();
  const featured = products.slice(0, 6);

  return (
    <>
      <Seo
        path="/"
        title="Cinematic & Traditional Fashion"
        description="Barani's Couture sells curated fashion inspired by iconic film wardrobes and South Indian tradition — plaid sets and trench coats alongside Kanjeevaram sarees and pattu half-sarees, restyled for the modern wardrobe. Ships across India and worldwide."
        jsonLd={[organizationJsonLd(), websiteJsonLd(), itemListJsonLd(featured, '/')]}
      />

      <section className="relative h-[85vh] w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={theme.heroImg}
            alt={`${theme.title} — Barani's Couture collection`}
            className="w-full h-full object-cover scale-105 animate-[pulse_20s_ease-in-out_infinite_alternate]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto flex flex-col items-center mt-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest text-white uppercase mb-6 backdrop-blur-md bg-white/10 border border-white/20">
            <Sparkles size={14} /> New Arrivals
          </div>
          <h1 className={`text-6xl md:text-8xl font-black text-white mb-6 leading-[0.9] tracking-tight drop-shadow-2xl ${theme.fontHeading}`}>
            {theme.title}
          </h1>
          <p className="text-lg md:text-xl text-gray-200 mb-10 max-w-2xl mx-auto drop-shadow-md font-light">
            {theme.subtitle}
          </p>
          <Link
            to="/shop"
            className="group relative px-8 py-4 bg-white text-black font-semibold rounded-none tracking-widest uppercase overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2 group-hover:text-white transition-colors duration-300">
              Explore Collection <ArrowRight size={18} />
            </span>
            <div
              className="absolute inset-0 w-full h-full translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0"
              style={{ backgroundColor: theme.accentColor }}
            />
          </Link>
        </div>
      </section>

      <TrustBar />

      <section className="border-b border-current/10" aria-label="Barani's Couture collection notes">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-current/10">
          <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-50 mb-4">Studio note / 001</p>
            <p className={`text-2xl md:text-3xl leading-tight ${theme.fontHeading}`}>
              Wardrobe as a <em>scene</em>, not a season.
            </p>
          </div>
          <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-50 mb-4">Shop by silhouette</p>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
              {categories.map((category) => <Link key={category} to={`/shop?category=${category}`} className="underline decoration-current/20 underline-offset-4 hover:decoration-current">{category}</Link>)}
            </div>
          </div>
          <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-50 mb-4">The Barani standard</p>
            <p className="text-sm leading-relaxed opacity-65">Original reconstructions, considered fabrics, and pieces made to outlast the moment.</p>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <h2 className={`text-4xl md:text-5xl font-bold mb-4 tracking-tight ${theme.fontHeading}`}>Curated Pieces</h2>
            <p className="opacity-60 text-lg font-light">
              Meticulously selected garments inspired by cinematic history and South Indian tradition. Reconstructed for modern wearability.
            </p>
          </div>
          <Link
            to="/shop"
            className="text-sm font-bold tracking-widest uppercase flex items-center gap-2 group pb-1 border-b-2 border-transparent hover:border-current transition-all"
            style={{ borderColor: theme.accentColor }}
          >
            View Collection <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16 lg:auto-rows-[1fr]">
          {featured.map((product, idx) => (
            <ProductCard key={product.id} product={product} featured={idx % 3 === 0} />
          ))}
        </div>
      </main>

      <section className="bg-[#111827] text-white py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-12 items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/45 mb-5">From the atelier</p>
            <h2 className={`text-4xl md:text-6xl leading-[0.95] ${theme.fontHeading}`}>The look is in the details.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 border-t border-white/15 pt-6">
            <div><p className="text-3xl font-semibold">{String(products.length).padStart(2, '0')}</p><p className="text-xs uppercase tracking-widest text-white/45 mt-2">Archive pieces</p></div>
            <div><p className="text-3xl font-semibold">01</p><p className="text-xs uppercase tracking-widest text-white/45 mt-2">Point of view</p></div>
            <div><p className="text-3xl font-semibold">∞</p><p className="text-xs uppercase tracking-widest text-white/45 mt-2">Ways to wear it</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
