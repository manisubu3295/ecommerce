const STORAGE_KEY = 'archive-recently-viewed';
const MAX_ITEMS = 8;

export function getRecentlyViewed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentlyViewed(productId) {
  try {
    const current = getRecentlyViewed().filter((id) => id !== productId);
    const next = [productId, ...current].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — recently-viewed just won't persist
  }
}
