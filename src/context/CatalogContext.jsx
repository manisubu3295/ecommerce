import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCatalog } from '../data/products.js';

const CatalogContext = createContext(null);
const DEFAULT_CATEGORIES = ['Dresses', 'Sets', 'Outerwear', 'Tops', 'Traditional Wear'];

export function CatalogProvider({ children }) {
  const [products, setProducts] = useState(getCatalog);
  const [categories, setCategories] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('archive-categories') || 'null');
      return Array.isArray(stored) && stored.length ? stored : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });
  // Store-wide settings an admin configures once (announcement bar copy,
  // support email, active theme) and every visitor should see — sourced from
  // the server so they aren't stuck in the admin's own browser storage.
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('archive-settings') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    fetch('/api/catalog')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.products)) {
          setProducts(data.products);
          localStorage.setItem('archive-products', JSON.stringify(data.products));
        }
        if (Array.isArray(data.categories) && data.categories.length) {
          setCategories(data.categories);
          localStorage.setItem('archive-categories', JSON.stringify(data.categories));
        }
        if (data.settings && typeof data.settings === 'object') {
          setSettings(data.settings);
          localStorage.setItem('archive-settings', JSON.stringify(data.settings));
        }
      })
      .catch(() => {
        // The local catalog remains available when the API is offline.
      });
  }, []);

  return <CatalogContext.Provider value={{ products, categories, settings }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('useCatalog must be used within CatalogProvider');
  return context;
}
