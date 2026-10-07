import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { THEME_PRESETS, DEFAULT_THEME_ID } from '../data/themePresets.js';
import { useCatalog } from './CatalogContext.jsx';

const ThemeContext = createContext(null);

function isValidTheme(candidate) {
  return candidate && typeof candidate === 'object' && typeof candidate.accentColor === 'string' && typeof candidate.bgColor === 'string';
}

// WCAG relative luminance — used instead of a hardcoded list of "known light
// bgColors" so any new theme preset (or an admin's custom color override)
// gets correct light/dark component styling automatically.
function isDarkColor(hex) {
  const value = (hex || '').replace('#', '');
  if (value.length !== 3 && value.length !== 6) return false;
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance < 0.5;
}

export function ThemeProvider({ children }) {
  const { settings } = useCatalog();
  const [theme, setThemeState] = useState(THEME_PRESETS[DEFAULT_THEME_ID]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const hasLoadedServerTheme = useRef(false);
  const persistTimeoutRef = useRef(null);

  // Apply the store-wide theme an admin saved, once, when it first arrives
  // from CatalogProvider's /api/catalog fetch — so every visitor (not just
  // the admin's own browser) sees the configured look.
  useEffect(() => {
    if (hasLoadedServerTheme.current) return;
    if (isValidTheme(settings?.theme)) {
      setThemeState(settings.theme);
      hasLoadedServerTheme.current = true;
    }
  }, [settings]);

  const persistTheme = (nextTheme) => {
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: nextTheme }),
      }).catch(() => {
        // The admin's session may have expired; the local preview still applies.
      });
    }, 500);
  };

  const setTheme = (next) => {
    setThemeState(next);
    persistTheme(next);
  };
  const setThemeById = (id) => THEME_PRESETS[id] && setTheme(THEME_PRESETS[id]);

  useEffect(() => {
    document.body.style.backgroundColor = theme.bgColor;
    document.body.style.color = theme.textColor;
    document.documentElement.style.setProperty('--color-accent', theme.accentColor);
  }, [theme]);

  const isDark = isDarkColor(theme.bgColor);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, setThemeById, isAdminOpen, setIsAdminOpen, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
