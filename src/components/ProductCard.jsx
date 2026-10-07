import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { formatCurrency } from '../data/siteConfig.js';

export default function ProductCard({ product, featured = false }) {
  const { theme } = useTheme();
  const { addToCart, toggleWishlist, isWishlisted } = useCart();
  const available = product.inStock && (!Number.isFinite(product.stockQty) || product.stockQty > 0);
  const wishlisted = isWishlisted(product.id);

  return (
    <div className={`group ${featured ? 'lg:row-span-2' : ''}`}>
      <Link to={`/product/${product.slug}`} className="block">
        <div className={`relative overflow-hidden bg-gray-100 mb-6 ${featured ? 'aspect-[3/5] lg:h-full' : 'aspect-[3/4]'}`}>
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
          />
          {product.movie && <div className="absolute top-4 left-4 px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-white backdrop-blur-md bg-black/40 border border-white/20">
            {product.movie}
          </div>}
          {!available ? (
            <div className="absolute top-4 right-4 px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-white bg-black/70">
              Sold out
            </div>
          ) : product.bestSeller ? (
            <div className="absolute top-4 right-4 px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-white" style={{ backgroundColor: theme.accentColor }}>
              Best Seller
            </div>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            aria-pressed={wishlisted}
            className="absolute bottom-4 right-4 z-10 p-2 rounded-full bg-white/90 backdrop-blur-md shadow-sm hover:scale-110 transition-transform"
          >
            <Heart size={16} className={wishlisted ? 'text-red-500' : 'text-gray-700'} fill={wishlisted ? 'currentColor' : 'none'} />
          </button>
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-8">
            {available ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  addToCart(product, product.sizes?.[0] ?? null);
                }}
                className="translate-y-4 group-hover:translate-y-0 px-8 py-3 bg-white text-black text-sm font-bold tracking-widest uppercase transition-all duration-300 hover:bg-black hover:text-white"
              >
                Add to Bag
              </button>
            ) : (
              <span className="translate-y-4 group-hover:translate-y-0 px-8 py-3 bg-white/80 text-black/60 text-sm font-bold tracking-widest uppercase">
                Sold Out
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col">
          <p className="text-xs uppercase tracking-widest opacity-50 mb-2">{product.category}</p>
          <div className="flex justify-between items-start gap-4">
            <h4 className={`text-lg font-medium leading-snug ${theme.fontHeading}`}>{product.name}</h4>
            <span className="text-lg font-light tracking-wide whitespace-nowrap">{formatCurrency(product.price)}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
