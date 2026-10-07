import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ChevronRight, Heart, HelpCircle, Ruler, ShieldCheck, Star, X, ZoomIn } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { getProductBySlug, getRelatedProducts } from '../data/products.js';
import { SITE_CONFIG, formatCurrency } from '../data/siteConfig.js';
import ProductCard from '../components/ProductCard.jsx';
import Seo from '../components/Seo.jsx';
import SizeGuideModal from '../components/SizeGuideModal.jsx';
import TrustBar from '../components/TrustBar.jsx';
import { breadcrumbJsonLd, productJsonLd } from '../lib/jsonld.js';
import { useCatalog } from '../context/CatalogContext.jsx';
import { useModalBehavior } from '../hooks/useModalBehavior.js';
import { addRecentlyViewed, getRecentlyViewed } from '../lib/recentlyViewed.js';

// The cover photo (the one shoppers clicked on the shop grid) always comes
// first, followed by the extra gallery photos, without duplicates.
function productPhotos(product) {
  const photos = [product.image, ...(product.gallery || [])].filter(Boolean);
  return photos.length ? [...new Set(photos)] : [product.image];
}

// Products saved before multiple videos were supported have a single `video`.
function productVideos(product) {
  return [...new Set([...(product.videos || []), product.video].filter(Boolean))];
}

export default function ProductDetail() {
  const { slug } = useParams();
  const { theme } = useTheme();
  const { addToCart, toggleWishlist, isWishlisted } = useCart();
  const { products } = useCatalog();
  const product = products.find((item) => item.slug === slug) || getProductBySlug(slug);
  const [size, setSize] = useState(product?.sizes?.[0]);
  const [added, setAdded] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 5, comment: '' });
  const [reviewStatus, setReviewStatus] = useState('idle');
  const [reviewError, setReviewError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [questionForm, setQuestionForm] = useState({ askedName: '', question: '' });
  const [questionStatus, setQuestionStatus] = useState('idle');
  const [questionError, setQuestionError] = useState('');

  useEffect(() => {
    if (!product) return;
    // React Router doesn't remount this component between two /product/:slug
    // navigations, so state carried over from the previous product must be
    // reset explicitly here — size selection included.
    if (product.sizeStock) {
      const firstInStock = product.sizes?.find((s) => (Number(product.sizeStock[s]) || 0) > 0);
      setSize(firstInStock || product.sizes?.[0]);
    } else {
      setSize(product.sizes?.[0]);
    }
    setReviews([]);
    setActiveImage(0);
    fetch(`/api/products/${product.id}/reviews`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.reviews)) setReviews(data.reviews); })
      .catch(() => {});
    setQuestions([]);
    fetch(`/api/products/${product.id}/questions`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.questions)) setQuestions(data.questions); })
      .catch(() => {});
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    // Snapshot the list BEFORE adding this product, so "recently viewed"
    // never just shows the page you're already on.
    setRecentlyViewedIds(getRecentlyViewed().filter((id) => id !== product.id));
    addRecentlyViewed(product.id);
  }, [product?.id]);

  useModalBehavior(isLightboxOpen, () => setIsLightboxOpen(false));

  // Only genuine submitted reviews count — made-up ratings mislead shoppers
  // and break consumer-protection and Google review rules.
  const ratingSummary = useMemo(() => {
    const count = reviews.length;
    const average = count ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;
    return { average, count };
  }, [reviews]);

  if (!product) return <Navigate to="/404" replace />;

  const hasSizeStock = product.sizeStock && typeof product.sizeStock === 'object';
  const selectedSizeStock = hasSizeStock ? Number(product.sizeStock[size]) || 0 : null;
  const available = hasSizeStock
    ? selectedSizeStock > 0
    : product.inStock && (!Number.isFinite(product.stockQty) || product.stockQty > 0);
  const lowStock = hasSizeStock
    ? selectedSizeStock > 0 && selectedSizeStock <= 5
    : Number.isFinite(product.stockQty) && product.stockQty > 0 && product.stockQty <= 5;
  const lowStockCount = hasSizeStock ? selectedSizeStock : product.stockQty;
  const related = getRelatedProducts(product, 3, products);
  const recentlyViewed = recentlyViewedIds.map((id) => products.find((p) => p.id === id)).filter(Boolean);

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewError('');
    setReviewStatus('submitting');
    try {
      const response = await fetch(`/api/products/${product.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not submit your review.');
      setReviews((prev) => [result, ...prev]);
      setReviewForm({ name: '', rating: 5, comment: '' });
      setReviewStatus('done');
    } catch (error) {
      setReviewError(error.message);
      setReviewStatus('idle');
    }
  };

  const submitQuestion = async (event) => {
    event.preventDefault();
    setQuestionError('');
    setQuestionStatus('submitting');
    try {
      const response = await fetch(`/api/products/${product.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not submit your question.');
      setQuestionForm({ askedName: '', question: '' });
      setQuestionStatus('done');
    } catch (error) {
      setQuestionError(error.message);
      setQuestionStatus('idle');
    }
  };

  return (
    <>
      <Seo
        path={`/product/${product.slug}`}
        title={product.name}
        description={`${product.description} From ${SITE_CONFIG.name}${product.movie ? `, inspired by ${product.movie}` : ''}. ${formatCurrency(product.price)}, ships to ${SITE_CONFIG.shipsTo.length}+ regions.`}
        image={product.image}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Shop', path: '/shop' },
            { name: product.name, path: `/product/${product.slug}` },
          ]),
          productJsonLd(product),
        ]}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-50 mb-10">
          <Link to="/" className="hover:opacity-100">Home</Link>
          <ChevronRight size={12} />
          <Link to="/shop" className="hover:opacity-100">Shop</Link>
          <ChevronRight size={12} />
          <span className="opacity-100">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            {(() => {
              const gallery = productPhotos(product);
              return (
                <>
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(true)}
                    className="group relative block w-full aspect-[3/4] overflow-hidden bg-gray-100 mb-4"
                    aria-label={`Zoom in on ${product.name}, view ${activeImage + 1}`}
                  >
                    <img src={gallery[activeImage]} alt={`${product.name}, view ${activeImage + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-4 right-4 p-2 rounded-full bg-white/90 backdrop-blur-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn size={16} className="text-gray-700" />
                    </span>
                  </button>
                  {gallery.length > 1 && (
                    <div className="grid grid-cols-5 gap-3 mb-4">
                      {gallery.map((src, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveImage(i)}
                          className={`aspect-[3/4] overflow-hidden bg-gray-100 border-2 transition-colors ${i === activeImage ? 'border-current' : 'border-transparent opacity-60 hover:opacity-100'}`}
                          style={i === activeImage ? { borderColor: theme.accentColor } : undefined}
                          aria-label={`View image ${i + 1}`}
                          aria-pressed={i === activeImage}
                        >
                          <img src={src} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            {productVideos(product).map((src, index, all) => (
              <div key={src} className="mt-4 overflow-hidden bg-black">
                {/* object-contain so upright phone videos aren't cropped to a strip. */}
                <video src={src} controls playsInline preload="metadata" className="block w-full max-h-[80vh] object-contain" aria-label={`${product.name} product video${all.length > 1 ? ` ${index + 1}` : ''}`} />
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest opacity-50 mb-2">{product.category}{product.movie ? ` · Inspired by ${product.movie}` : ''}</p>
            <h1 className={`text-4xl md:text-5xl font-bold mb-4 tracking-tight ${theme.fontHeading}`}>{product.name}</h1>

            <div className="flex items-center gap-2 mb-6">
              {ratingSummary.count > 0 && <div className="flex text-yellow-500" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} fill={i < Math.round(ratingSummary.average) ? 'currentColor' : 'none'} />
                ))}
              </div>}
              <span className="text-sm opacity-60">{ratingSummary.count ? `${ratingSummary.average.toFixed(1)} (${ratingSummary.count} review${ratingSummary.count === 1 ? '' : 's'})` : 'No reviews yet'}</span>
            </div>

            <p className={`text-3xl font-light ${lowStock ? 'mb-2' : 'mb-8'}`}>{formatCurrency(product.price)}</p>
            {lowStock && (
              <p className="text-sm font-semibold mb-8" style={{ color: theme.accentColor }}>Only {lowStockCount} left{hasSizeStock ? ` in size ${size}` : ' in stock'}</p>
            )}

            <p className="opacity-70 mb-10 leading-relaxed max-w-lg">{product.description}</p>

            <div className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-bold uppercase tracking-widest opacity-60">Size</label>
                <button type="button" onClick={() => setIsSizeGuideOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold underline underline-offset-4 opacity-70 hover:opacity-100">
                  <Ruler size={13} /> Size Guide
                </button>
              </div>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select size">
                {product.sizes.map((s) => {
                  const sizeAvailable = !hasSizeStock || (Number(product.sizeStock[s]) || 0) > 0;
                  return (
                    <button
                      key={s}
                      role="radio"
                      aria-checked={size === s}
                      disabled={!sizeAvailable}
                      onClick={() => setSize(s)}
                      className={`w-12 h-12 border text-sm font-medium transition-colors relative ${
                        !sizeAvailable ? 'opacity-30 line-through cursor-not-allowed' : size === s ? 'text-white border-transparent' : 'border-current opacity-60 hover:opacity-100'
                      }`}
                      style={sizeAvailable && size === s ? { backgroundColor: theme.accentColor } : undefined}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  addToCart(product, size);
                  setAdded(true);
                }}
                disabled={!available}
                className="flex-1 md:flex-none md:px-12 py-4 text-white font-bold tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: theme.accentColor }}
              >
                {available ? 'Add to Bag' : 'Out of Stock'}
              </button>
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label={isWishlisted(product.id) ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                aria-pressed={isWishlisted(product.id)}
                className="w-14 h-14 shrink-0 flex items-center justify-center border border-current hover:bg-current/5 transition-colors"
              >
                <Heart size={20} className={isWishlisted(product.id) ? 'text-red-500' : ''} fill={isWishlisted(product.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
            {added && <p className="text-sm mt-3 opacity-70">Added to bag — size {size}.</p>}

            <div className="mt-10 pt-8 border-t border-current/10">
              <TrustBar compact />
            </div>
            {product.sku && <p className="mt-6 text-xs opacity-50">SKU {product.sku}</p>}
          </div>
        </div>

        <section className="mt-32 max-w-3xl">
          <h2 className={`text-3xl font-bold mb-10 tracking-tight ${theme.fontHeading}`}>Reviews</h2>

          <form onSubmit={submitReview} className="border border-current/10 p-6 md:p-8 mb-10 space-y-4">
            <h3 className="font-bold text-lg">Write a review</h3>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
              {Array.from({ length: 5 }).map((_, i) => {
                const value = i + 1;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={reviewForm.rating === value}
                    aria-label={`${value} star${value === 1 ? '' : 's'}`}
                    onClick={() => setReviewForm({ ...reviewForm, rating: value })}
                    className="p-1 text-yellow-500"
                  >
                    <Star size={22} fill={value <= reviewForm.rating ? 'currentColor' : 'none'} />
                  </button>
                );
              })}
            </div>
            <input
              required
              value={reviewForm.name}
              onChange={(event) => setReviewForm({ ...reviewForm, name: event.target.value })}
              placeholder="Your name"
              className="w-full px-4 py-3 bg-transparent border border-current/20 focus:border-current outline-none text-sm"
            />
            <textarea
              required
              rows="3"
              value={reviewForm.comment}
              onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })}
              placeholder="Share your experience with this piece"
              className="w-full px-4 py-3 bg-transparent border border-current/20 focus:border-current outline-none text-sm resize-y"
            />
            {reviewError && <p className="text-sm text-red-600" role="alert">{reviewError}</p>}
            {reviewStatus === 'done' && <p className="text-sm text-emerald-700" role="status">Thank you — your review is live.</p>}
            <button
              type="submit"
              disabled={reviewStatus === 'submitting'}
              className="px-6 py-3 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50"
              style={{ backgroundColor: theme.accentColor }}
            >
              {reviewStatus === 'submitting' ? 'Submitting...' : 'Submit review'}
            </button>
          </form>

          {reviews.length > 0 && (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="border-t border-current/10 pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex text-yellow-500" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={13} fill={i < review.rating ? 'currentColor' : 'none'} />
                      ))}
                    </div>
                    <span className="text-sm font-semibold">{review.name}</span>
                    <span className="text-xs opacity-50">{new Date(review.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="opacity-70 text-sm leading-relaxed">{review.comment}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-32 max-w-3xl">
          <h2 className={`text-3xl font-bold mb-10 tracking-tight ${theme.fontHeading}`}>Questions &amp; Answers</h2>

          <form onSubmit={submitQuestion} className="border border-current/10 p-6 md:p-8 mb-10 space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2"><HelpCircle size={18} /> Ask a question</h3>
            <input
              required
              value={questionForm.askedName}
              onChange={(event) => setQuestionForm({ ...questionForm, askedName: event.target.value })}
              placeholder="Your name"
              className="w-full px-4 py-3 bg-transparent border border-current/20 focus:border-current outline-none text-sm"
            />
            <textarea
              required
              rows="2"
              value={questionForm.question}
              onChange={(event) => setQuestionForm({ ...questionForm, question: event.target.value })}
              placeholder="Does this run true to size? Is the blouse stitched?"
              className="w-full px-4 py-3 bg-transparent border border-current/20 focus:border-current outline-none text-sm resize-y"
            />
            {questionError && <p className="text-sm text-red-600" role="alert">{questionError}</p>}
            {questionStatus === 'done' && <p className="text-sm text-emerald-700" role="status">Thanks — we'll answer here soon.</p>}
            <button
              type="submit"
              disabled={questionStatus === 'submitting'}
              className="px-6 py-3 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50"
              style={{ backgroundColor: theme.accentColor }}
            >
              {questionStatus === 'submitting' ? 'Submitting...' : 'Submit question'}
            </button>
          </form>

          {questions.length > 0 && (
            <div className="space-y-6">
              {questions.map((q) => (
                <div key={q.id} className="border-t border-current/10 pt-6">
                  <p className="font-semibold text-sm mb-1">Q: {q.question}</p>
                  <p className="opacity-70 text-sm leading-relaxed">A: {q.answer}</p>
                  <p className="text-xs opacity-50 mt-2">Asked by {q.asked_name}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {related.length > 0 && (
          <section className="mt-32">
            <h2 className={`text-3xl font-bold mb-10 tracking-tight ${theme.fontHeading}`}>You May Also Like</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {recentlyViewed.length > 0 && (
          <section className="mt-32">
            <h2 className={`text-3xl font-bold mb-10 tracking-tight ${theme.fontHeading}`}>Recently Viewed</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
              {recentlyViewed.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>
      <SizeGuideModal isOpen={isSizeGuideOpen} onClose={() => setIsSizeGuideOpen(false)} />

      {isLightboxOpen && (() => {
        const gallery = productPhotos(product);
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90" role="dialog" aria-modal="true" aria-label={`${product.name} image viewer`}>
            <button type="button" onClick={() => setIsLightboxOpen(false)} className="absolute top-6 right-6 p-2 text-white hover:opacity-70 transition-opacity" aria-label="Close image viewer">
              <X size={28} />
            </button>
            <img src={gallery[activeImage]} alt={`${product.name}, view ${activeImage + 1}`} className="max-w-full max-h-[85vh] object-contain" />
            {gallery.length > 1 && (
              <div className="absolute bottom-6 flex gap-2">
                {gallery.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`View image ${i + 1}`}
                    aria-pressed={i === activeImage}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${i === activeImage ? 'bg-white' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </>
  );
}
