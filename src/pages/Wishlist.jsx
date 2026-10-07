import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCatalog } from '../context/CatalogContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import Seo from '../components/Seo.jsx';
import { breadcrumbJsonLd } from '../lib/jsonld.js';

export default function Wishlist() {
  const { theme } = useTheme();
  const { products } = useCatalog();
  const { wishlist } = useCart();
  const saved = products.filter((product) => wishlist.includes(product.id));

  return (
    <>
      <Seo
        path="/wishlist"
        title="Your Wishlist"
        description="Pieces you've saved from the Barani's Couture collection."
        noindex
        jsonLd={[breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Wishlist', path: '/wishlist' }])]}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="mb-12">
          <h1 className={`text-4xl md:text-5xl font-bold mb-4 tracking-tight ${theme.fontHeading}`}>Your Wishlist</h1>
          <p className="opacity-60 text-lg font-light max-w-2xl">
            {saved.length > 0 ? `${saved.length} piece${saved.length === 1 ? '' : 's'} saved for later.` : 'Save pieces you love and find them here anytime.'}
          </p>
        </div>

        {saved.length === 0 ? (
          <div className="py-24 text-center">
            <Heart size={40} className="mx-auto mb-6 opacity-30" />
            <p className="opacity-60 text-lg mb-8">Nothing saved yet — tap the heart on any piece to add it here.</p>
            <Link
              to="/shop"
              className="inline-flex px-8 py-4 text-white text-xs font-bold uppercase tracking-widest"
              style={{ backgroundColor: theme.accentColor }}
            >
              Browse the Shop
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {saved.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
