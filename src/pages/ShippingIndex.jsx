import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import Seo from '../components/Seo.jsx';
import { breadcrumbJsonLd } from '../lib/jsonld.js';
import { CITIES } from '../data/locations.js';

export default function ShippingIndex() {
  const { theme } = useTheme();

  // Country -> region -> cities, so a huge flat list of 200+ towns reads as
  // a real directory instead of a wall of links.
  const grouped = useMemo(() => {
    const byCountry = new Map();
    for (const city of CITIES) {
      if (!byCountry.has(city.country)) byCountry.set(city.country, new Map());
      const byRegion = byCountry.get(city.country);
      if (!byRegion.has(city.region)) byRegion.set(city.region, []);
      byRegion.get(city.region).push(city);
    }
    return byCountry;
  }, []);

  return (
    <>
      <Seo
        path="/shipping"
        title="Where We Ship"
        description={`Barani's Couture ships across ${CITIES.length}+ cities in India, Singapore, and Malaysia. Find delivery times for your city.`}
        jsonLd={[breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Shipping', path: '/shipping' }])]}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="mb-16">
          <h1 className={`text-4xl md:text-5xl font-bold mb-4 tracking-tight ${theme.fontHeading}`}>Where We Ship</h1>
          <p className="opacity-60 text-lg font-light max-w-2xl">Barani's Couture ships to {CITIES.length}+ cities across India, Singapore, and Malaysia. Find your city below.</p>
        </div>

        <div className="space-y-16">
          {[...grouped.entries()].map(([country, regions]) => (
            <div key={country}>
              <h2 className={`text-2xl md:text-3xl font-bold mb-8 tracking-tight ${theme.fontHeading}`}>{country}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
                {[...regions.entries()].map(([region, cities]) => (
                  <div key={region}>
                    <p className="text-xs uppercase tracking-widest opacity-50 mb-3">{region}</p>
                    <ul className="space-y-2 text-sm">
                      {cities.map((city) => (
                        <li key={city.slug}>
                          <Link to={`/shipping/${city.slug}`} className="underline decoration-current/20 underline-offset-4 hover:decoration-current">
                            {city.city}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
