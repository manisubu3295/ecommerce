import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ChevronRight, Truck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCatalog } from '../context/CatalogContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import Seo from '../components/Seo.jsx';
import { breadcrumbJsonLd, localBusinessJsonLd } from '../lib/jsonld.js';
import { CITIES, REGION_CONTENT } from '../data/locations.js';

export default function LocationPage() {
  const { citySlug } = useParams();
  const { theme } = useTheme();
  const { products } = useCatalog();
  const location = CITIES.find((c) => c.slug === citySlug);

  if (!location) return <Navigate to="/404" replace />;

  const regionNote = REGION_CONTENT[location.region];
  const featured = products.filter((p) => p.category === 'Traditional Wear').slice(0, 6);
  const shown = featured.length ? featured : products.slice(0, 6);
  const [minDays, maxDays] = location.deliveryDays;

  return (
    <>
      <Seo
        path={`/shipping/${location.slug}`}
        title={`Buy Sarees & Traditional Wear Online in ${location.city}`}
        description={`Barani's Couture ships Kanjeevaram sarees, pattu half-sarees and cinema-inspired fashion to ${location.city}, ${location.region}. Delivery in ${minDays}-${maxDays} business days from our ${location.hubCity} dispatch hub.`}
        jsonLd={[
          breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Shipping', path: '/shipping' }, { name: location.city, path: `/shipping/${location.slug}` }]),
          localBusinessJsonLd(location),
        ]}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-50 mb-10">
          <Link to="/" className="hover:opacity-100">Home</Link>
          <ChevronRight size={12} />
          <Link to="/shipping" className="hover:opacity-100">Shipping</Link>
          <ChevronRight size={12} />
          <span className="opacity-100">{location.city}</span>
        </nav>

        <p className="text-xs uppercase tracking-widest opacity-50 mb-4">{location.region}, {location.country}</p>
        <h1 className={`text-4xl md:text-5xl font-bold mb-6 tracking-tight ${theme.fontHeading}`}>
          Barani's Couture in {location.city}
        </h1>

        <div className="flex items-start gap-3 mb-10 max-w-2xl text-sm opacity-70">
          <Truck size={18} className="shrink-0 mt-0.5" />
          <p>Delivery to {location.city} in {minDays}-{maxDays} business days, dispatched from our {location.hubCity} hub.</p>
        </div>

        {regionNote && (
          <p className="opacity-70 leading-relaxed max-w-2xl mb-16">{regionNote}</p>
        )}

        <h2 className={`text-2xl md:text-3xl font-bold mb-8 tracking-tight ${theme.fontHeading}`}>
          Shop the collection
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16 mb-16">
          {shown.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>

        <Link to="/shop" className="text-sm font-bold tracking-widest uppercase underline underline-offset-4">
          View the full collection
        </Link>
      </main>
    </>
  );
}
