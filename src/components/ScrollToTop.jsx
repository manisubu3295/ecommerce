import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Router doesn't reset scroll position between route changes by default.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
