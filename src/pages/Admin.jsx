import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Check, Download, ExternalLink, FileText, HelpCircle, ImagePlus, KeyRound, Mail, Menu, Package, Pencil, Printer, Reply, RotateCcw, Save, Search, Settings, Star, Sun, Tag, Trash2, Truck, UserCircle, Users, Video, X, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCatalog } from '../data/products.js';
import { SITE_CONFIG, formatCurrency } from '../data/siteConfig.js';
import Seo from '../components/Seo.jsx';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { INDIAN_STATES, missingBusinessDetails } from '../lib/address.js';
import { normalizeWhatsAppNumber, whatsAppLink } from '../lib/whatsapp.js';
import { policySettings } from '../lib/policies.js';

// Orders carry customer PII (name, email, phone, address) and are never
// cached to localStorage here — they're re-fetched from the authenticated
// server session each time, so nothing sensitive sits on disk in this browser.
const INVENTORY_KEY = 'archive-inventory';
const PRODUCTS_KEY = 'archive-products';
const SETTINGS_KEY = 'archive-store-settings';
const CATEGORIES_KEY = 'archive-categories';
const LAST_SEEN_KEY = 'archive-admin-last-seen';
const DEFAULT_CATEGORIES = ['Dresses', 'Sets', 'Outerwear', 'Tops', 'Traditional Wear'];

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Client-side CSV export — no server round-trip, no new dependency. Escapes
// per RFC 4180 (wrap in quotes, double up embedded quotes) so commas/quotes/
// newlines in product names or customer data can't corrupt the file.
function downloadCsv(filename, rows) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}



const ADMIN_THEME = { accentColor: '#0F4F54', fontHeading: 'font-admin' };

const emptyProduct ={ id: null, slug: '', name: '', movie: '', category: 'Dresses', price: '', stockQty: '', image: '', gallery: [], videos: [], video: '', description: '', sizes: ['S', 'M', 'L'], sku: '', rating: 0, reviewCount: 0, inStock: true, bestSeller: false };
const emptyPost = { id: null, slug: '', title: '', excerpt: '', content: '', coverImage: '', seoTitle: '', seoDescription: '', status: 'draft' };

const ADMIN_FONT_HREF = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&display=swap';

function useAdminFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${ADMIN_FONT_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = ADMIN_FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

export default function Admin() {
  useAdminFont();
  // The admin keeps a fixed look instead of following the storefront theme;
  // child panels read accentColor/fontHeading from this object.
  const theme = ADMIN_THEME;
  const { admin, loading, login, logout, markPasswordChanged } = useAdminAuth();
  const [tab, setTab] = useState('overview');
  const [orderFilter, setOrderFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  // Orders are fetched a page (or a view) at a time and kept here by id, so a
  // change made anywhere (order panel, bulk action, Today) shows everywhere.
  const [orderCache, setOrderCache] = useState({});
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState(() => getCatalog());
  const [messages, setMessages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [posts, setPosts] = useState([]);
  const [editingPost, setEditingPost] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [lastSeen, setLastSeen] = useState(() => readStorage(LAST_SEEN_KEY, null));
  const [inventory, setInventory] = useState(() => readStorage(INVENTORY_KEY, {}));
  const [settings, setSettings] = useState(() => readStorage(SETTINGS_KEY, { announcement: 'Free global shipping on archival pieces.', supportEmail: SITE_CONFIG.email, pricing: { taxRatePercent: SITE_CONFIG.tax.ratePercent, shippingFee: SITE_CONFIG.shippingFee, freeShippingThreshold: SITE_CONFIG.freeShippingThreshold } }));
  const [categories, setCategories] = useState(() => readStorage(CATEGORIES_KEY, DEFAULT_CATEGORIES));
  const [editingProduct, setEditingProduct] = useState(null);
  const [saved, setSaved] = useState(false);
  const [settingsErrors, setSettingsErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [apiError, setApiError] = useState('');
  const cacheOrders = useCallback((list) => setOrderCache((prev) => {
    const next = { ...prev };
    for (const order of list || []) next[order.id] = order;
    return next;
  }), []);
  // Counts, the packing queue and recent sales, computed on the server.
  const refreshSummary = useCallback(() => {
    const since = readStorage(LAST_SEEN_KEY, null);
    return fetch(`/api/admin/summary${since ? `?since=${encodeURIComponent(since)}` : ''}`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data) { setSummary(data); cacheOrders(data.toPack); } })
      .catch(() => {});
  }, [cacheOrders]);

  useEffect(() => {
    // First-ever login: start the "unread" clock from now instead of
    // treating the entire order/message/review history as unread.
    if (admin && !lastSeen) markNotificationsSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  useEffect(() => {
    if (!admin) return;
    fetch('/api/admin/catalog', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.products)) { setProducts(data.products); localStorage.setItem(PRODUCTS_KEY, JSON.stringify(data.products)); }
        if (data.settings && Object.keys(data.settings).length) {
          setSettings((current) => ({ ...current, ...data.settings }));
          if (Array.isArray(data.settings.categories)) setCategories(data.settings.categories);
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, ...data.settings }));
        }
      })
      .catch(() => setApiError('Could not load the server catalog. Showing cached data.'));
    fetch('/api/admin/messages', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.messages)) setMessages(data.messages); })
      .catch(() => {});
    fetch('/api/admin/reviews', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.reviews)) setReviews(data.reviews); })
      .catch(() => {});
    fetch('/api/admin/blog', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.posts)) setPosts(data.posts); })
      .catch(() => {});
    fetch('/api/admin/questions', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.questions)) setQuestions(data.questions); })
      .catch(() => {});
    fetch('/api/admin/coupons', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.coupons)) setCoupons(data.coupons); })
      .catch(() => {});
    fetch('/api/admin/audit-logs', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.logs)) setAuditLogs(data.logs); })
      .catch(() => {});
    refreshSummary();
    if (admin.role === 'owner') {
      fetch('/api/admin/staff', { credentials: 'include' })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => { if (Array.isArray(data?.staff)) setStaff(data.staff); })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  // New orders, messages and reviews show up without reloading the page.
  useEffect(() => {
    if (!admin || admin.mustChangePassword) return undefined;
    const timer = setInterval(refreshSummary, 60 * 1000);
    return () => clearInterval(timer);
  }, [admin, refreshSummary]);

  const inviteStaff = (email, password) => {
    return fetch('/api/admin/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) })
      .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(new Error(body.error))))
      .then((created) => setStaff((prev) => [...prev, created]));
  };

  const removeStaff = (id) => {
    if (!window.confirm('Remove this admin\'s access? This cannot be undone.')) return;
    setStaff((prev) => prev.filter((s) => s.id !== id));
    fetch(`/api/admin/staff/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => setApiError('Could not remove that admin.'));
  };

  // "Unread" = created after the admin last opened the notification bell —
  // no server table needed, just a per-browser timestamp.
  const unreadCount = summary?.unread || 0;

  const markNotificationsSeen = () => {
    const now = new Date().toISOString();
    setLastSeen(now);
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(now));
    setSummary((current) => (current ? { ...current, unread: 0 } : current));
  };

  const answerQuestion = (id, answer) => {
    fetch(`/api/admin/questions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ answer }) })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((updated) => setQuestions((prev) => prev.map((q) => q.id === updated.id ? updated : q)))
      .catch(() => setApiError('Answer could not be saved.'));
  };

  const deleteQuestion = (id) => {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    fetch(`/api/admin/questions/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => setApiError('Question delete failed on the server.'));
  };

  const createCoupon = (coupon) => {
    fetch('/api/admin/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(coupon) })
      .then((response) => response.ok ? response.json() : Promise.reject(response))
      .then((created) => setCoupons((prev) => [created, ...prev]))
      .catch(async (response) => {
        const body = response?.json ? await response.json().catch(() => ({})) : {};
        setApiError(body.error || 'Coupon could not be created.');
      });
  };

  const toggleCoupon = (id, active) => {
    setCoupons((prev) => prev.map((c) => c.id === id ? { ...c, active } : c));
    fetch(`/api/admin/coupons/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ active }) }).catch(() => setApiError('Coupon update failed on the server.'));
  };

  const deleteCoupon = (id) => {
    if (!window.confirm('Delete this coupon? This cannot be undone.')) return;
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    fetch(`/api/admin/coupons/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => setApiError('Coupon delete failed on the server.'));
  };

  const savePost = (post) => {
    const method = post.id ? 'PUT' : 'POST';
    const url = post.id ? `/api/admin/blog/${post.id}` : '/api/admin/blog';
    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(post) })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((saved) => {
        setPosts((prev) => post.id ? prev.map((p) => p.id === saved.id ? saved : p) : [saved, ...prev]);
        setEditingPost(null);
      })
      .catch(() => setApiError('Post save failed on the server.'));
  };

  const deletePost = (id) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    setPosts((prev) => prev.filter((post) => post.id !== id));
    fetch(`/api/admin/blog/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => setApiError('Post delete failed on the server.'));
  };

  const deleteReview = (id) => {
    if (!window.confirm('Delete this review? This cannot be undone.')) return;
    setReviews((prev) => prev.filter((review) => review.id !== id));
    fetch(`/api/admin/reviews/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => setApiError('Review delete failed on the server.'));
  };

  // Swap in an order the server returned (e.g. after issuing its invoice).
  const replaceOrder = (updated) => {
    cacheOrders([updated]);
    refreshSummary();
  };
  // Shows the change at once, then takes the server's version: the server may
  // add to it (items marked shipped, timeline dates) or refuse it (e.g.
  // reopening an unpaid order), in which case the order goes back as it was.
  const updateOrder = (id, changes) => {
    const before = orderCache[id];
    setOrderCache((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...changes } } : prev));
    fetch(`/api/admin/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(changes) })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Order update failed on the server.');
        replaceOrder(body);
      })
      .catch((error) => {
        if (before) replaceOrder(before);
        setApiError(error.message || 'Order update failed on the server.');
      });
  };

  const updateRequest = (id, type, status) => {
    const order = orderCache[id];
    const requestKey = type === 'return' ? 'returnRequest' : 'refundRequest';
    updateOrder(id, { [requestKey]: { ...order?.[requestKey], status, reviewedAt: new Date().toISOString() } });
  };

  const markMessage = (id, status) => {
    setMessages((prev) => prev.map((message) => message.id === id ? { ...message, status } : message));
    fetch(`/api/admin/messages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ status }) }).catch(() => setApiError('Message update failed on the server.'));
  };

  const saveProduct = (product) => {
    const next = product.id
      ? products.map((item) => item.id === product.id ? product : item)
      : [...products, { ...product, id: Date.now(), slug: product.slug || product.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }];
    const savedProduct = product.id ? product : next[next.length - 1];
    setProducts(next);
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(next));
    fetch(`/api/admin/products${product.id ? `/${product.id}` : ''}`, { method: product.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(savedProduct) })
      .then((response) => response.ok ? response.json() : Promise.reject(response))
      .then((stored) => {
        // A new product gets its id from the server; swap the temporary one so
        // editing it again (before a reload) updates the right row.
        if (product.id || stored.id === savedProduct.id) return;
        setProducts((prev) => {
          const updated = prev.map((item) => item.id === savedProduct.id ? stored : item);
          localStorage.setItem(PRODUCTS_KEY, JSON.stringify(updated));
          return updated;
        });
      })
      .catch(async (response) => {
        const body = response?.json ? await response.json().catch(() => ({})) : {};
        setApiError(`${body.error || 'Product could not be saved on the server.'} Reload the page to see what was saved.`);
      });
    setEditingProduct(null);
  };

  const deleteProduct = (id) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    const next = products.filter((product) => product.id !== id);
    setProducts(next);
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(next));
    fetch(`/api/admin/products/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => setApiError('Product delete failed on the server.'));
  };

  const updateInventory = (id, available) => {
    const next = { ...inventory, [id]: available };
    const updatedProducts = products.map((product) => product.id === id ? { ...product, inStock: available } : product);
    setInventory(next);
    setProducts(updatedProducts);
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(next));
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(updatedProducts));
    const updatedProduct = updatedProducts.find((product) => product.id === id);
    fetch(`/api/admin/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(updatedProduct) }).catch(() => setApiError('Inventory update failed on the server.'));
  };

  // Only says "Saved" once the server has accepted the settings; otherwise
  // shows which fields to fix.
  const saveSettings = async (event) => {
    event.preventDefault();
    setSettingsErrors({});
    const response = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(settings) }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) {
      setSettingsErrors(body.fields || {});
      setApiError(body.error || 'Settings could not be saved. Check that the server is running, then try again.');
      return;
    }
    const next = { ...settings, ...body };
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setApiError('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const saveCategories = (nextCategories) => {
    const next = [...new Set(nextCategories.map((category) => category.trim()).filter(Boolean))];
    if (!next.length) return;
    setCategories(next);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
    fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ categories: next }) }).catch(() => setApiError('Category update failed on the server.'));
  };

  // Settings (pricing, theme, announcement) and Team (who has admin access)
  // are owner-only — enforced here for the UI and again server-side on every
  // route those tabs call, so a staff account can't reach either by URL either.
  // Counts shown beside nav items — only for things waiting on the admin.
  const pendingCounts = {
    orders: summary?.counts.toShip || 0,
    returns: summary?.counts.pendingRequests || 0,
    questions: questions.filter((question) => question.status === 'pending').length,
    messages: messages.filter((message) => message.status === 'new').length,
  };
  const navGroups = [
    { label: null, items: [{ id: 'overview', label: 'Today', icon: Sun }] },
    { label: 'Sales', items: [
      { id: 'orders', label: 'Orders', icon: Truck },
      { id: 'returns', label: 'Returns & refunds', icon: RotateCcw },
      { id: 'customers', label: 'Customers', icon: Users },
      { id: 'coupons', label: 'Coupons', icon: Tag },
    ] },
    { label: 'Store', items: [
      { id: 'catalog', label: 'Products', icon: Package },
      { id: 'blog', label: 'Blog', icon: FileText },
    ] },
    { label: 'Shoppers', items: [
      { id: 'messages', label: 'Messages', icon: Mail },
      { id: 'questions', label: 'Questions', icon: HelpCircle },
      { id: 'reviews', label: 'Reviews', icon: Star },
    ] },
    { label: 'Admin', items: [
      { id: 'team', label: 'Team', icon: Users, ownerOnly: true },
      { id: 'settings', label: 'Store settings', icon: Settings, ownerOnly: true },
      { id: 'activity', label: 'Activity log', icon: Activity },
      { id: 'account', label: 'My account', icon: UserCircle },
    ] },
  ].map((group) => ({ ...group, items: group.items.filter((item) => !item.ownerOnly || admin?.role === 'owner') })).filter((group) => group.items.length);
  const mobileTabs = [['overview', 'Today', Sun], ['orders', 'Orders', Truck], ['catalog', 'Products', Package], ['messages', 'Messages', Mail]];

  const openTab = (id) => {
    setTab(id);
    setMoreOpen(false);
    window.scrollTo(0, 0);
  };
  const openOrders = (filter, orderId = null) => {
    setOrderFilter(filter);
    setSelectedOrderId(orderId);
    openTab('orders');
  };
  // Header search jumps straight to the thing: an order opens in its panel,
  // a product opens in the editor, a customer opens the list filtered to them.
  const openSearchResult = (result) => {
    setMobileSearchOpen(false);
    if (result.type === 'order') { cacheOrders([result.order]); openOrders('all', result.order.id); }
    else if (result.type === 'product') { setEditingProduct({ ...result.product }); openTab('catalog'); }
    else { setCustomerQuery(result.customer.email); openTab('customers'); }
  };

  if (loading) return <div className="admin-app min-h-screen flex items-center justify-center"><p className="text-sm text-[color:var(--adm-muted)]">Checking your admin session…</p></div>;
  if (!admin) return <AdminLogin theme={theme} login={login} error={authError} setError={setAuthError} />;
  // Signed in with a temporary password: nothing else until a new one is set.
  if (admin.mustChangePassword) return <div className="admin-app min-h-screen"><header className="text-white bg-[color:var(--adm-peacock)]"><div className="h-14 md:h-16 px-4 md:px-7 flex items-center justify-between font-tradition text-[21px] md:text-2xl">{SITE_CONFIG.name}<button type="button" onClick={logout} className="font-admin text-sm text-white/85 underline underline-offset-4">Sign out</button></div><TempleBorder /></header><main className="max-w-2xl mx-auto px-4 py-12"><MyAccount admin={admin} theme={theme} forced onChanged={markPasswordChanged} /></main></div>;

  const navLink = ({ id, label, icon: Icon }) => {
    const active = tab === id;
    const count = pendingCounts[id];
    return <button key={id} type="button" onClick={() => openTab(id)} aria-current={active ? 'page' : undefined} className={`w-full flex items-center gap-3 h-10 px-3 text-[15px] text-left transition-colors ${active ? 'bg-white text-[color:var(--adm-peacock)] font-semibold shadow-[inset_3px_0_0_var(--adm-zari),0_0_0_1px_var(--adm-line)]' : 'text-[#2E3237] hover:bg-white/70'}`}>
      <Icon size={17} className={active ? '' : 'text-[color:var(--adm-muted)]'} />
      <span className="flex-1 truncate">{label}</span>
      {count > 0 && <span className="min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-full text-xs font-bold text-white bg-[color:var(--adm-arakku)]">{count > 99 ? '99+' : count}</span>}
    </button>;
  };

  return (
    <div className="admin-app min-h-screen">
      <Seo path="/admin" title="Admin Workspace" noindex />
      <header className="sticky top-0 z-30 text-white bg-[color:var(--adm-peacock)]">
        <div className="h-14 md:h-16 px-4 md:px-7 flex items-center gap-4">
          <p className="md:w-[212px] shrink-0 font-tradition text-[21px] md:text-2xl leading-none">{SITE_CONFIG.name}</p>
          <div className="hidden md:block flex-1 max-w-[520px]"><AdminSearch products={products} onOpen={openSearchResult} /></div>
          <div className="flex-1" />
          <button type="button" onClick={() => setMobileSearchOpen((open) => !open)} aria-expanded={mobileSearchOpen} className="md:hidden w-11 h-11 inline-flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10" aria-label="Search orders, products and customers"><Search size={19} /></button>
          <button onClick={markNotificationsSeen} className="relative w-11 h-11 inline-flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10" aria-label={`Notifications, ${unreadCount} new since you last checked`} title="New orders, messages and reviews since you last checked"><Bell size={19} />{unreadCount > 0 && <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-[color:var(--adm-zari)] text-[color:var(--adm-ink)]">{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
          <Link to="/shop" className="hidden md:inline-flex items-center gap-2 h-10 px-3 text-sm text-white/90 hover:text-white hover:bg-white/10"><ExternalLink size={15} /> View store</Link>
          <div className="hidden md:flex items-center gap-2.5 pl-2 text-sm">
            <span className="w-8 h-8 rounded-full inline-flex items-center justify-center font-bold uppercase bg-[color:var(--adm-zari)] text-[color:var(--adm-ink)]" aria-hidden="true">{admin.email.charAt(0)}</span>
            <span className="capitalize">{admin.role}</span>
          </div>
        </div>
        {mobileSearchOpen && <div className="md:hidden px-4 pb-3"><AdminSearch products={products} onOpen={openSearchResult} autoFocus /></div>}
        <TempleBorder />
      </header>

      <div className="md:flex">
        <nav aria-label="Admin sections" className="hidden md:flex md:flex-col w-60 shrink-0 sticky top-[76px] h-[calc(100vh-76px)] overflow-y-auto px-4 py-6 gap-5 bg-[color:var(--adm-rail)] border-r border-[color:var(--adm-line)]">
          {navGroups.map((group) => <div key={group.label || 'main'} className="flex flex-col gap-0.5">
            {group.label && <p className="px-3 pb-1.5 text-[13px] text-[color:var(--adm-muted)]">{group.label}</p>}
            {group.items.map(navLink)}
          </div>)}
          <div className="mt-auto pt-4 border-t border-[color:var(--adm-line)] px-3 text-sm">
            <p className="truncate" title={admin.email}>{admin.email}</p>
            <button type="button" onClick={logout} className="mt-2 font-semibold text-[color:var(--adm-peacock)] underline underline-offset-4">Sign out</button>
          </div>
        </nav>

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-12 py-6 md:py-9 pb-28 md:pb-12">
          <div className="max-w-6xl mx-auto">
            {apiError && <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert"><span>{apiError}</span><button type="button" onClick={() => setApiError('')} className="font-semibold">Dismiss</button></div>}
            {tab === 'overview' && <Today summary={summary} orderCache={orderCache} setupMissing={admin.role === 'owner' ? [...missingBusinessDetails(settings.business), ...(policySettings(settings).grievanceName ? [] : ['grievance officer'])] : []} products={products} messages={messages} questions={questions} openTab={openTab} openOrders={openOrders} updateOrder={updateOrder} />}
            {tab === 'orders' && <Orders orderCache={orderCache} cacheOrders={cacheOrders} statusCounts={summary?.counts.byStatus || {}} updateOrder={updateOrder} replaceOrder={replaceOrder} filter={orderFilter} setFilter={setOrderFilter} selectedId={selectedOrderId} setSelectedId={setSelectedOrderId} />}
            {tab === 'returns' && <ReturnsAndRefunds orderCache={orderCache} cacheOrders={cacheOrders} updateRequest={updateRequest} openOrders={openOrders} theme={theme} />}
            {tab === 'catalog' && <Catalog products={products} categories={categories} saveCategories={saveCategories} inventory={inventory} updateInventory={updateInventory} editingProduct={editingProduct} setEditingProduct={setEditingProduct} saveProduct={saveProduct} deleteProduct={deleteProduct} theme={theme} />}
            {tab === 'reviews' && <Reviews reviews={reviews} products={products} deleteReview={deleteReview} theme={theme} />}
            {tab === 'blog' && <BlogAdmin posts={posts} editingPost={editingPost} setEditingPost={setEditingPost} savePost={savePost} deletePost={deletePost} theme={theme} />}
            {tab === 'questions' && <Questions questions={questions} products={products} answerQuestion={answerQuestion} deleteQuestion={deleteQuestion} theme={theme} />}
            {tab === 'coupons' && <Coupons coupons={coupons} createCoupon={createCoupon} toggleCoupon={toggleCoupon} deleteCoupon={deleteCoupon} theme={theme} />}
            {tab === 'customers' && <Customers key={customerQuery} initialSearch={customerQuery} theme={theme} />}
            {tab === 'activity' && <ActivityLog logs={auditLogs} theme={theme} />}
            {tab === 'messages' && <Messages messages={messages} markMessage={markMessage} theme={theme} />}
            {tab === 'team' && admin.role === 'owner' && <Team staff={staff} inviteStaff={inviteStaff} removeStaff={removeStaff} currentEmail={admin.email} theme={theme} />}
            {tab === 'settings' && admin.role === 'owner' && <SettingsPanel settings={settings} setSettings={setSettings} saveSettings={saveSettings} saved={saved} errors={settingsErrors} theme={theme} />}
            {tab === 'account' && <MyAccount admin={admin} theme={theme} />}
          </div>
        </main>
      </div>

      {/* Phone: bottom tab bar for the daily sections, "More" for the rest. */}
      <nav aria-label="Admin sections" className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 bg-white border-t border-[color:var(--adm-line)] pb-[env(safe-area-inset-bottom)]">
        {mobileTabs.map(([id, label, Icon]) => {
          const active = tab === id && !moreOpen;
          const count = pendingCounts[id];
          return <button key={id} type="button" onClick={() => openTab(id)} aria-current={active ? 'page' : undefined} className={`!rounded-none relative flex flex-col items-center justify-center gap-1 h-16 text-xs ${active ? 'text-[color:var(--adm-peacock)] font-bold shadow-[inset_0_3px_0_var(--adm-zari)]' : 'text-[color:var(--adm-muted)]'}`}>
            <Icon size={20} />{label}
            {count > 0 && <span className="absolute top-1.5 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full text-[11px] font-bold text-white bg-[color:var(--adm-arakku)]">{count > 99 ? '99+' : count}</span>}
          </button>;
        })}
        <button type="button" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} className={`!rounded-none flex flex-col items-center justify-center gap-1 h-16 text-xs ${moreOpen || !mobileTabs.some(([id]) => id === tab) ? 'text-[color:var(--adm-peacock)] font-bold shadow-[inset_0_3px_0_var(--adm-zari)]' : 'text-[color:var(--adm-muted)]'}`}><Menu size={20} />More</button>
      </nav>
      {moreOpen && <div className="md:hidden fixed inset-0 z-20 bg-black/30" onClick={() => setMoreOpen(false)}>
        <div className="absolute inset-x-0 bottom-16 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-[color:var(--adm-rail)] px-4 pt-5 pb-4 flex flex-col gap-5" onClick={(event) => event.stopPropagation()}>
          {navGroups.map((group) => <div key={group.label || 'main'} className="flex flex-col gap-0.5">
            {group.label && <p className="px-3 pb-1.5 text-[13px] text-[color:var(--adm-muted)]">{group.label}</p>}
            {group.items.map(navLink)}
          </div>)}
          <div className="flex items-center justify-between gap-3 border-t border-[color:var(--adm-line)] pt-4 px-3 text-sm">
            <span className="truncate">{admin.email}</span>
            <div className="flex gap-4 shrink-0"><Link to="/shop" className="font-semibold text-[color:var(--adm-peacock)]">View store</Link><button type="button" onClick={logout} className="font-semibold text-[color:var(--adm-peacock)]">Sign out</button></div>
          </div>
        </div>
      </div>}
    </div>
  );
}

// Searches what the admin already has loaded (orders, products, customers),
// so results are instant and nothing extra is fetched.
function AdminSearch({ products, onOpen, autoFocus = false }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState({ q: '', orders: [], customers: [] });
  const inputRef = React.useRef(null);

  // "/" focuses search from anywhere in the admin, unless you're typing.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
      if (!inputRef.current?.offsetParent) return;
      event.preventDefault();
      inputRef.current.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Orders and customers are searched on the server (all of them, not just
  // what's loaded); products are already in the admin, so they're instant.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { credentials: 'include', signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => { if (body) setRemote({ q, orders: body.orders, customers: body.customers }); })
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const has = (value) => String(value || '').toLowerCase().includes(q);
    const fresh = remote.q.toLowerCase() === q;
    const orderHits = (fresh ? remote.orders : []).map((order) => ({ type: 'order', key: `o-${order.id}`, order, title: `${order.id}, ${order.customer?.name || 'Guest'}`, detail: `${formatCurrency(order.total)}, ${STATUS_LABEL[order.status] || order.status}` }));
    const productHits = products.filter((p) => has(p.name) || has(p.sku) || has(p.category)).slice(0, 5)
      .map((product) => ({ type: 'product', key: `p-${product.id}`, product, title: product.name, detail: `${product.category}, ${formatCurrency(product.price)}${Number.isFinite(product.stockQty) ? `, ${product.stockQty} in stock` : ''}` }));
    const customerHits = (fresh ? remote.customers : []).map((c) => ({ type: 'customer', key: `c-${c.email}`, customer: c, title: c.name || c.email, detail: `${c.email}${c.account_id ? '' : ', guest'}` }));
    return [['Orders', orderHits], ['Products', productHits], ['Customers', customerHits]].filter(([, hits]) => hits.length);
  }, [query, products, remote]);
  const flat = groups.flatMap(([, hits]) => hits);
  const showList = open && query.trim().length >= 2;

  const choose = (result) => {
    onOpen(result);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, flat.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter' && flat[active]) { event.preventDefault(); choose(flat[active]); }
    else if (event.key === 'Escape') { setOpen(false); event.currentTarget.blur(); }
  };

  return <div className="relative">
    <div className="flex items-center gap-2.5 h-10 px-3.5 rounded-lg bg-white/[0.12] text-white/80 focus-within:bg-white focus-within:text-[color:var(--adm-muted)]">
      <Search size={16} className="shrink-0" />
      <input ref={inputRef} type="search" value={query} autoFocus={autoFocus}
        onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKeyDown}
        placeholder="Search orders, products, customers" aria-label="Search orders, products and customers"
        role="combobox" aria-expanded={showList} aria-controls="admin-search-results" aria-autocomplete="list"
        aria-activedescendant={showList && flat[active] ? `admin-search-${flat[active].key}` : undefined}
        className="flex-1 min-w-0 !bg-transparent !border-0 !rounded-none p-0 text-[15px] text-inherit placeholder:text-current placeholder:opacity-90 outline-none focus:text-[color:var(--adm-ink)]" />
      <kbd className="hidden lg:inline text-xs opacity-70 border border-current/40 rounded px-1.5 leading-5" aria-hidden="true">/</kbd>
    </div>
    {showList && <div id="admin-search-results" role="listbox" aria-label="Search results" className="absolute left-0 right-0 top-full mt-2 z-40 max-h-[70vh] overflow-y-auto rounded-xl bg-white text-[color:var(--adm-ink)] border border-[color:var(--adm-line)] shadow-[0_12px_32px_rgba(15,79,84,0.18)] py-2">
      {groups.length === 0
        ? <p className="px-4 py-3 text-sm text-[color:var(--adm-muted)]">Nothing matches “{query.trim()}”. Try an order number, a name, an email or the last digits of a phone number.</p>
        : groups.map(([label, hits]) => <div key={label} role="group" aria-label={label}>
          <p className="px-4 pt-2 pb-1 text-[13px] text-[color:var(--adm-muted)]">{label}</p>
          {hits.map((hit) => {
            const index = flat.indexOf(hit);
            return <div key={hit.key} id={`admin-search-${hit.key}`} role="option" aria-selected={index === active}
              onMouseDown={(event) => { event.preventDefault(); choose(hit); }} onMouseEnter={() => setActive(index)}
              className={`px-4 py-2 cursor-pointer ${index === active ? 'bg-[#F1F6F6] shadow-[inset_3px_0_0_var(--adm-peacock)]' : ''}`}>
              <p className="text-[15px] font-medium truncate">{hit.title}</p>
              <p className="text-[13px] text-[color:var(--adm-muted)] truncate">{hit.detail}</p>
            </div>;
          })}
        </div>)}
    </div>}
  </div>;
}

// The gold temple-tower strip under the header — the admin's one ornament,
// taken from the zari border of a Kanjeevaram saree.
function TempleBorder() {
  return <svg className="block w-full h-3" aria-hidden="true" focusable="false">
    <defs>
      <pattern id="adm-gopuram" width="24" height="12" patternUnits="userSpaceOnUse">
        <rect width="24" height="12" fill="#0A3A3E" />
        <path d="M0 12 L6 4 L12 12 Z M12 12 L18 4 L24 12 Z" fill="#C39A3E" />
        <path d="M6 4 V1 M18 4 V1" stroke="#C39A3E" strokeWidth="1.2" />
      </pattern>
    </defs>
    <rect width="100%" height="12" fill="url(#adm-gopuram)" />
  </svg>;
}

const LOW_STOCK_THRESHOLD = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

// "To pack" = paid and not shipped yet, with at least one item not packed.
// Once every item is packed the order waits in "ready to ship" instead.
const isPacked = (order) => (order.items || []).length > 0 && order.items.every((item) => ['packed', 'shipped', 'delivered'].includes(item.fulfillmentStatus));
const needsPacking = (order) => order.status === 'processing' && !isPacked(order);

function whenPlaced(iso) {
  const date = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / DAY_MS);
  if (days <= 0) return `Today, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function itemSummary(order) {
  const items = order.items || [];
  if (!items.length) return 'No items';
  const first = items[0];
  const rest = items.length - 1;
  return `${first.name}${first.size ? `, size ${first.size}` : ''}${first.qty > 1 ? ` ×${first.qty}` : ''}${rest > 0 ? ` and ${rest} more` : ''}`;
}

function Thumb({ item, size = 'w-12 h-[60px]' }) {
  return item?.image
    ? <img src={item.image} alt="" className={`${size} shrink-0 rounded-md object-cover bg-[color:var(--adm-canvas)]`} />
    : <span className={`${size} shrink-0 rounded-md bg-[color:var(--adm-canvas)]`} aria-hidden="true" />;
}

function Today({ summary, orderCache, setupMissing = [], products, messages, questions, openTab, openOrders, updateOrder }) {
  // The server sends the oldest orders still to pack; read each from the cache
  // so "Mark packed" takes it off the list straight away.
  const queue = (summary?.toPack || []).map((order) => orderCache[order.id] || order);
  const toPack = queue.filter(needsPacking);
  const packedHere = queue.length - toPack.length;
  const toPackCount = Math.max((summary?.counts.toPack || 0) - packedHere, 0);
  const readyToShip = (summary?.counts.readyToShip || 0) + packedHere;
  const pendingRequests = summary?.counts.pendingRequests || 0;
  const waiting = [
    ['Return and refund requests', pendingRequests, 'returns'],
    ['Unread messages', messages.filter((message) => message.status === 'new').length, 'messages'],
    ['Unanswered questions', questions.filter((question) => question.status === 'pending').length, 'questions'],
  ];
  const lowStock = products.filter((p) => Number.isFinite(p.stockQty) && p.stockQty > 0 && p.stockQty <= LOW_STOCK_THRESHOLD);
  const outOfStock = products.filter((p) => Number.isFinite(p.stockQty) && p.stockQty <= 0);

  const sales = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 14 }, (_, i) => ({ date: new Date(today.getTime() - (13 - i) * DAY_MS), total: 0 }));
    let count = 0;
    let previous = 0;
    for (const order of summary?.recentSales || []) {
      const placed = new Date(order.createdAt);
      placed.setHours(0, 0, 0, 0);
      const index = 13 - Math.round((today - placed) / DAY_MS);
      if (index >= 0 && index < 14) { days[index].total += Number(order.total || 0); count += 1; }
      else if (index >= -14 && index < 0) previous += Number(order.total || 0);
    }
    const total = days.reduce((sum, day) => sum + day.total, 0);
    return { days, total, count, previous, max: Math.max(1, ...days.map((day) => day.total)) };
  }, [summary]);
  const change = sales.total - sales.previous;

  const markPacked = (order) => updateOrder(order.id, { items: order.items.map((item) => ({ ...item, fulfillmentStatus: 'packed' })) });

  return <section className="space-y-6">
    {setupMissing.length > 0 && <div className="rounded-xl border border-[#E8D3AE] bg-[#FBF3E6] px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-[#5E4214]">
      <p className="text-[15px]"><strong className="font-semibold">Finish your invoice details.</strong> Missing: {setupMissing.join(', ')}.</p>
      <button type="button" onClick={() => openTab('settings')} className="h-9 px-4 text-sm font-semibold border border-[#C9A96E] bg-white">Open Store settings</button>
    </div>}
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
      <div>
        <p className="text-[15px] text-[color:var(--adm-muted)]">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1.5 font-tradition text-[34px] md:text-[52px] leading-[1.05] text-[color:var(--adm-ink)]">{!summary ? 'Loading today…' : toPackCount ? `${toPackCount} order${toPackCount === 1 ? '' : 's'} to pack` : 'Nothing to pack right now'}</h1>
      </div>
      <button type="button" onClick={() => openOrders('processing')} className="self-start sm:self-auto h-11 px-5 inline-flex items-center gap-2 text-[15px] font-semibold text-white bg-[color:var(--adm-peacock)] hover:bg-[color:var(--adm-peacock-deep)]">{toPackCount ? 'Start packing' : 'View orders'}</button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-6 items-start">
      <div className="adm-card overflow-hidden">
        <div className="px-5 md:px-6 py-4 flex items-baseline justify-between border-b border-[color:var(--adm-line)]">
          <h2 className="text-[17px] font-semibold">To pack</h2>
          <button type="button" onClick={() => openOrders('all')} className="text-sm font-medium text-[color:var(--adm-peacock)] hover:underline underline-offset-4">All orders</button>
        </div>
        {toPack.length === 0
          ? <p className="px-5 md:px-6 py-8 text-[15px] text-[color:var(--adm-muted)]">New paid orders show up here, oldest first.</p>
          : <ul className="divide-y divide-[color:var(--adm-line)]">{toPack.map((order) => <li key={order.id} className="px-5 md:px-6 py-4 flex items-center gap-4">
            <Thumb item={order.items?.[0]} />
            <button type="button" onClick={() => openOrders('processing', order.id)} className="flex-1 min-w-0 text-left">
              <span className="block text-[15px] font-semibold truncate">{itemSummary(order)}</span>
              <span className="block text-sm text-[color:var(--adm-muted)] mt-0.5 truncate">{order.customer?.name || 'Guest'}, {order.id}</span>
            </button>
            <div className="hidden sm:block text-right shrink-0">
              <p className="text-[15px] font-semibold">{formatCurrency(order.total)}</p>
              <p className="text-[13px] text-[color:var(--adm-muted)] mt-0.5">{whenPlaced(order.paidAt || order.createdAt)}</p>
            </div>
            <button type="button" onClick={() => markPacked(order)} className="shrink-0 h-9 px-3.5 text-sm font-medium border border-[#C9CFCB] bg-white hover:border-[color:var(--adm-peacock)] hover:text-[color:var(--adm-peacock)]">Mark packed</button>
          </li>)}</ul>}
        {toPackCount > toPack.length && <button type="button" onClick={() => openOrders('processing')} className="!rounded-none w-full px-6 py-3 text-sm font-medium text-left text-[color:var(--adm-peacock)] border-t border-[color:var(--adm-line)] hover:bg-[color:var(--adm-canvas)]">{toPackCount - toPack.length} more to pack</button>}
        {readyToShip > 0 && <button type="button" onClick={() => openOrders('processing')} className="!rounded-none w-full px-5 md:px-6 py-3.5 flex items-center gap-3 text-left text-[15px] bg-[#F1F6F6] border-t border-[color:var(--adm-line)] hover:bg-[#E6F0F0]"><Truck size={17} className="text-[color:var(--adm-peacock)]" /><span className="flex-1">{readyToShip} packed order{readyToShip === 1 ? ' is' : 's are'} ready to ship</span><span className="text-sm font-semibold text-[color:var(--adm-peacock)]">Add tracking</span></button>}
      </div>

      <div className="space-y-6">
        <div className="adm-card px-5 md:px-6 py-4">
          <h2 className="text-[17px] font-semibold mb-2">Waiting on you</h2>
          <ul>{waiting.map(([label, count, target]) => <li key={label}><button type="button" onClick={() => openTab(target)} className="w-full flex items-center gap-3 py-2.5 border-t border-[#EEF0EE] text-left text-[15px]"><span className={`w-2 h-2 rounded-full ${count > 0 ? 'bg-[color:var(--adm-arakku)]' : 'bg-[#C9CFCB]'}`} aria-hidden="true" /><span className={`flex-1 ${count > 0 ? '' : 'text-[color:var(--adm-muted)]'}`}>{label}</span><span className="font-semibold">{count}</span></button></li>)}</ul>
        </div>
        {(lowStock.length > 0 || outOfStock.length > 0) && <div className="rounded-xl border border-[#E8D3AE] bg-[#FBF3E6] px-5 md:px-6 py-4 text-[#5E4214]">
          <h2 className="text-[17px] font-semibold mb-2">Running low</h2>
          <ul className="space-y-1 text-[15px] leading-snug">
            {outOfStock.map((p) => <li key={p.id}><strong className="font-semibold">{p.name}</strong> is sold out</li>)}
            {lowStock.map((p) => <li key={p.id}><strong className="font-semibold">{p.name}</strong> has {p.stockQty} left</li>)}
          </ul>
          <button type="button" onClick={() => openTab('catalog')} className="mt-3 text-sm font-semibold underline underline-offset-4">Update stock</button>
        </div>}
      </div>
    </div>

    <div className="adm-card p-5 md:p-6 grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-6 md:gap-8 items-end">
      <div className="space-y-3">
        <h2 className="text-[17px] font-semibold">Sales, last 14 days</h2>
        <div>
          <p className="text-[32px] font-semibold tracking-tight leading-none">{formatCurrency(sales.total)}</p>
          <p className="text-sm text-[color:var(--adm-muted)] mt-1.5">{sales.count ? `from ${sales.count} order${sales.count === 1 ? '' : 's'}, ${formatCurrency(sales.total / sales.count)} on average` : 'No paid orders yet'}</p>
        </div>
        {(sales.total > 0 || sales.previous > 0) && <p className={`text-sm font-semibold ${change >= 0 ? 'text-[#0F6B45]' : 'text-[color:var(--adm-arakku)]'}`}>{change >= 0 ? 'Up' : 'Down'} {formatCurrency(Math.abs(change))} compared with the previous 14 days</p>}
      </div>
      <div className="h-36 flex items-end gap-1.5 md:gap-2.5" role="img" aria-label={`Daily sales for the last 14 days, ${formatCurrency(sales.total)} in total`}>
        {sales.days.map((day, i) => <div key={day.date.toISOString()} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5" title={`${day.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${formatCurrency(day.total)}`}>
          <div className={`w-full rounded-t ${day.total ? (i === 13 ? 'bg-[color:var(--adm-zari)]' : 'bg-[color:var(--adm-peacock)]') : 'bg-[#E4E7E4]'}`} style={{ height: `${Math.max(3, (day.total / sales.max) * 88)}%` }} />
          <span className="text-[11px] text-[color:var(--adm-muted)]">{day.date.getDate()}</span>
        </div>)}
      </div>
    </div>
  </section>;
}

const ORDER_STATUSES = [['pending_payment', 'Awaiting payment'], ['processing', 'To ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
const STATUS_LABEL = Object.fromEntries(ORDER_STATUSES);
const STATUS_PILL = {
  pending_payment: 'bg-[#FDF3E1] text-[#7A5210]',
  processing: 'bg-[#FBEAEC] text-[#8A2433]',
  shipped: 'bg-[#E3EFEF] text-[#0F4F54]',
  delivered: 'bg-[#E5F2EA] text-[#0F6B45]',
  cancelled: 'bg-[#EEF0EE] text-[#5B6166]',
};

function StatusPill({ order }) {
  const status = order.status || 'processing';
  const label = status === 'processing' && isPacked(order) ? 'Packed' : STATUS_LABEL[status] || status;
  return <span className={`inline-block px-2.5 py-1 rounded-full text-[13px] font-semibold whitespace-nowrap ${STATUS_PILL[status] || STATUS_PILL.cancelled}`}>{label}</span>;
}

// Fetches orders from the server 50 at a time (newest first). Filtering and
// search happen on the server, so this stays quick with thousands of orders.
function Orders({ orderCache, cacheOrders, statusCounts, updateOrder, replaceOrder, filter, setFilter, selectedId, setSelectedId }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('shipped');
  const [page, setPage] = useState({ ids: [], total: 0, nextCursor: null, loading: true, error: '' });

  const load = useCallback(async (cursor = null) => {
    setPage((current) => ({ ...current, loading: true, error: '' }));
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (search.trim()) params.set('q', search.trim());
    if (cursor) params.set('cursor', cursor);
    const response = await fetch(`/api/admin/orders?${params}`, { credentials: 'include' }).catch(() => null);
    const body = response?.ok ? await response.json().catch(() => null) : null;
    if (!body) { setPage((current) => ({ ...current, loading: false, error: 'Orders could not be loaded. Check the server is running, then try again.' })); return; }
    cacheOrders(body.orders);
    setPage((current) => ({ ids: [...(cursor ? current.ids : []), ...body.orders.map((o) => o.id)], total: body.total, nextCursor: body.nextCursor, loading: false, error: '' }));
  }, [filter, search, cacheOrders]);

  // Refetch when the filter changes, and shortly after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => { load(); setSelected([]); }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  // An order opened from search or Today may not be in this page yet.
  useEffect(() => {
    if (!selectedId || orderCache[selectedId]) return;
    fetch(`/api/admin/orders/${encodeURIComponent(selectedId)}`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((order) => { if (order) cacheOrders([order]); })
      .catch(() => {});
  }, [selectedId, orderCache, cacheOrders]);

  const filtered = page.ids.map((id) => orderCache[id]).filter(Boolean);
  const allCount = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  const selectedOrder = selectedId ? orderCache[selectedId] || null : null;

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (search.trim()) params.set('q', search.trim());
    window.location.assign(`/api/admin/orders.csv?${params}`);
  };
  const applyBulkStatus = () => {
    const label = STATUS_LABEL[bulkStatus] || bulkStatus;
    if (!window.confirm(`Change ${selected.length} order${selected.length === 1 ? '' : 's'} to “${label}”?${bulkStatus === 'cancelled' ? ' Customers are not refunded automatically.' : ''}`)) return;
    for (const id of selected) updateOrder(id, { status: bulkStatus });
    setSelected([]);
  };
  const toggleOne = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected((prev) => prev.length === filtered.length ? [] : filtered.map((o) => o.id));

  return <section className={`grid grid-cols-1 gap-6 items-start ${selectedOrder ? 'xl:grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
    <div className="min-w-0 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[28px] font-semibold tracking-tight">Orders</h1>
        <button type="button" onClick={exportCsv} title="Downloads every order matching the current filter and search" className="h-10 px-4 inline-flex items-center gap-2 text-sm font-medium border border-[#C9CFCB] bg-white hover:border-[color:var(--adm-peacock)]"><Download size={15} /> Export CSV</button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">{[['all', 'All', allCount], ...ORDER_STATUSES.map(([value, label]) => [value, label, statusCounts[value] || 0])].map(([value, label, count]) => <button key={value} type="button" onClick={() => { setFilter(value); setSelected([]); }} aria-pressed={filter === value} className={`!rounded-full h-9 px-3.5 text-sm font-medium border ${filter === value ? 'bg-[color:var(--adm-peacock)] border-[color:var(--adm-peacock)] text-white' : 'bg-white border-[#C9CFCB] text-[#2E3237] hover:border-[color:var(--adm-peacock)]'}`}>{label} <span className="opacity-70">{count}</span></button>)}</div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by order, name, email or phone" aria-label="Search orders" className="flex-1 min-w-0 max-w-md h-10 px-3 border border-[#C9CFCB] outline-none text-[15px]" />
        {selected.length > 0 && <div className="flex items-center gap-2 text-sm"><span className="text-[color:var(--adm-muted)]">{selected.length} selected</span><select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} aria-label="New status" className="h-10 px-2 border border-[#C9CFCB] text-sm">{ORDER_STATUSES.filter(([value]) => value !== 'pending_payment').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={applyBulkStatus} className="h-10 px-4 text-sm font-semibold text-white bg-[color:var(--adm-peacock)]">Apply</button></div>}
      </div>

      <div className="adm-card overflow-hidden">
        {page.error
          ? <div className="px-6 py-10 text-[15px]"><p className="text-red-700">{page.error}</p><button type="button" onClick={() => load()} className="mt-3 text-sm font-semibold text-[color:var(--adm-peacock)] underline underline-offset-4">Try again</button></div>
          : filtered.length === 0
          ? <p className="px-6 py-10 text-[15px] text-[color:var(--adm-muted)]">{page.loading ? 'Loading orders…' : allCount === 0 ? 'No orders yet. They appear here as soon as a shopper checks out.' : 'No orders match this filter.'}</p>
          : <>
            <div className="hidden md:grid grid-cols-[28px_150px_minmax(0,1fr)_110px_130px] gap-4 px-5 py-3 text-[13px] text-[color:var(--adm-muted)] border-b border-[color:var(--adm-line)]">
              <input type="checkbox" checked={selected.length === filtered.length} onChange={toggleAll} aria-label="Select all orders" />
              <span>Order</span><span>Customer</span><span className="text-right">Total</span><span>Status</span>
            </div>
            <ul className="divide-y divide-[#EEF0EE]">{filtered.map((order) => {
              const active = order.id === selectedId;
              return <li key={order.id} className={`grid grid-cols-[28px_minmax(0,1fr)_auto] md:grid-cols-[28px_150px_minmax(0,1fr)_110px_130px] gap-x-4 gap-y-1 items-center px-5 py-3.5 ${active ? 'bg-[#F1F6F6] shadow-[inset_3px_0_0_var(--adm-peacock)]' : 'hover:bg-[#F7F8F7]'}`}>
                <input type="checkbox" checked={selected.includes(order.id)} onChange={() => toggleOne(order.id)} aria-label={`Select order ${order.id}`} />
                <button type="button" onClick={() => setSelectedId(active ? null : order.id)} aria-expanded={active} className="!rounded-none min-w-0 text-left md:col-span-2 md:grid md:grid-cols-[150px_minmax(0,1fr)] md:gap-4 md:items-center">
                  <span className="block"><span className="block text-sm font-semibold">{order.id}</span><span className="block text-[13px] text-[color:var(--adm-muted)]">{whenPlaced(order.createdAt)}</span></span>
                  <span className="block min-w-0"><span className="block text-[15px] truncate">{order.customer?.name || 'Guest'}</span><span className="block text-[13px] text-[color:var(--adm-muted)] truncate">{itemSummary(order)}</span></span>
                </button>
                <span className="text-right text-[15px] font-semibold">{formatCurrency(order.total)}</span>
                <span className="col-start-2 md:col-start-auto"><StatusPill order={order} /></span>
              </li>;
            })}</ul>
            <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--adm-line)] text-sm text-[color:var(--adm-muted)]">
              <span>Showing {filtered.length} of {page.total}</span>
              {page.nextCursor && <button type="button" onClick={() => load(page.nextCursor)} disabled={page.loading} className="h-9 px-4 text-sm font-semibold text-[color:var(--adm-ink)] border border-[#C9CFCB] bg-white hover:border-[color:var(--adm-peacock)] disabled:opacity-50">{page.loading ? 'Loading…' : 'Load 50 more'}</button>}
            </div>
          </>}
      </div>
    </div>

    {selectedOrder && <OrderPanel key={selectedOrder.id} order={selectedOrder} updateOrder={updateOrder} replaceOrder={replaceOrder} onClose={() => setSelectedId(null)} />}
  </section>;
}

function OrderPanel({ order, updateOrder, replaceOrder, onClose }) {
  const [tracking, setTracking] = useState({ carrier: order.carrier || '', trackingNumber: order.trackingNumber || '', trackingUrl: order.trackingUrl || '' });
  const trackingChanged = tracking.carrier !== (order.carrier || '') || tracking.trackingNumber !== (order.trackingNumber || '') || tracking.trackingUrl !== (order.trackingUrl || '');
  const status = order.status || 'processing';
  const totals = [
    ['Subtotal', order.subtotal],
    order.discount ? [`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, -order.discount] : null,
    ['Shipping', order.shipping],
    order.tax ? ['Tax', order.tax] : null,
  ].filter((row) => row && row[1] != null);
  const payment = order.paymentMethod === 'demo' ? 'Demo checkout, not charged'
    : order.paymentId ? `Paid by Razorpay (${order.paymentId})`
      : status === 'pending_payment' ? 'Waiting for payment'
        : order.paymentMethod === 'razorpay' ? 'Not paid' : 'Paid';
  const cancelReason = order.cancelReason === 'payment_timeout' ? 'Cancelled automatically: payment wasn’t completed within 30 minutes, so the stock was released.' : order.cancelReason ? `Cancelled: ${order.cancelReason.replace(/_/g, ' ')}` : null;
  const field = (key, label, placeholder, type = 'text') => <label className="block"><span className="block text-sm font-medium mb-1.5">{label}</span><input type={type} value={tracking[key]} placeholder={placeholder} onChange={(event) => setTracking({ ...tracking, [key]: event.target.value })} className="w-full h-10 px-3 border border-[#C9CFCB] outline-none text-[15px]" /></label>;
  // Dropdowns only stage a change; nothing is saved until the admin presses
  // the button next to them, so a mis-click can't change a real order.
  const [nextStatus, setNextStatus] = useState(status);
  const [itemDrafts, setItemDrafts] = useState({});
  useEffect(() => { setNextStatus(status); }, [status]);
  useEffect(() => { setItemDrafts({}); }, [order.items]);
  const itemKey = (item) => `${item.id}-${item.size ?? ''}`;
  const changedItems = (order.items || []).filter((item) => itemDrafts[itemKey(item)] && itemDrafts[itemKey(item)] !== (item.fulfillmentStatus || 'pending'));
  const saveStatus = () => {
    if (nextStatus === 'cancelled' && !window.confirm(`Cancel order ${order.id}? The customer is not refunded automatically.`)) return;
    updateOrder(order.id, { status: nextStatus });
  };
  const invoiceIssued = Boolean(order.invoice?.seller);
  const isPaid = Boolean(order.paymentId) || (order.paymentMethod === 'demo' && status !== 'cancelled');
  const [issuing, setIssuing] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const issueInvoice = async () => {
    setIssuing(true);
    setInvoiceError('');
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/invoice`, { method: 'POST', credentials: 'include' }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    if (response?.ok) replaceOrder(body);
    else setInvoiceError(body.error || 'The invoice could not be issued.');
    setIssuing(false);
  };
  const saveItems = () => updateOrder(order.id, { items: order.items.map((item) => itemDrafts[itemKey(item)] ? { ...item, fulfillmentStatus: itemDrafts[itemKey(item)] } : item) });

  return <aside aria-label={`Order ${order.id}`} className="fixed inset-0 z-40 overflow-y-auto bg-white xl:inset-auto xl:z-auto xl:sticky xl:top-[100px] xl:max-h-[calc(100vh-124px)] xl:rounded-xl xl:border xl:border-[color:var(--adm-line)]">
    <div className="p-6 md:p-7 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[color:var(--adm-muted)]">{order.id}, placed {new Date(order.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
          <h2 className="mt-1 text-[22px] font-semibold">{order.customer?.name || 'Guest'}</h2>
        </div>
        <button type="button" onClick={onClose} className="w-10 h-10 -mr-2 inline-flex items-center justify-center text-[color:var(--adm-muted)] hover:bg-[color:var(--adm-canvas)]" aria-label="Close order"><X size={18} /></button>
      </div>
      <div className="flex flex-wrap items-center gap-2.5"><StatusPill order={order} /><select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} aria-label="New status" className="h-9 px-2 border border-[#C9CFCB] text-sm">{ORDER_STATUSES.map(([value, label]) => <option key={value} value={value} disabled={value === 'pending_payment' && status !== 'pending_payment'}>{label}</option>)}</select>{nextStatus !== status && <><button type="button" onClick={saveStatus} className="h-9 px-3.5 text-sm font-semibold text-white bg-[color:var(--adm-peacock)] hover:bg-[color:var(--adm-peacock-deep)]">Update status</button><button type="button" onClick={() => setNextStatus(status)} className="h-9 px-2 text-sm font-medium text-[color:var(--adm-muted)] hover:text-[color:var(--adm-ink)]">Undo</button></>}</div>
      <div className="text-[15px] leading-relaxed">
        {order.customer?.email && <a href={`mailto:${order.customer.email}`} className="block text-[color:var(--adm-peacock)] hover:underline underline-offset-4">{order.customer.email}</a>}
        {order.customer?.phone && <a href={`tel:${order.customer.phone}`} className="block text-[color:var(--adm-peacock)] hover:underline underline-offset-4">{order.customer.phone}</a>}
      </div>
      {order.customer?.address && <div className="rounded-lg bg-[#F4F6F4] p-4 text-[15px] leading-relaxed"><p className="text-[13px] text-[color:var(--adm-muted)] mb-1">Ship to</p><p className="whitespace-pre-wrap break-words">{order.customer.address}</p></div>}

      <div>
        <ul className="space-y-3">{(order.items || []).map((item) => <li key={`${item.id}-${item.size ?? ''}`} className="flex gap-3 items-center">
          <Thumb item={item} size="w-11 h-14" />
          <div className="flex-1 min-w-0 text-[15px]"><p className="truncate">{item.name}</p><p className="text-[13px] text-[color:var(--adm-muted)]">Qty {item.qty}{item.size ? `, size ${item.size}` : ''}</p></div>
          <select value={itemDrafts[itemKey(item)] || item.fulfillmentStatus || 'pending'} onChange={(event) => setItemDrafts({ ...itemDrafts, [itemKey(item)]: event.target.value })} aria-label={`Packing status for ${item.name}`} className={`h-8 px-1.5 border text-[13px] ${changedItems.includes(item) ? 'border-[color:var(--adm-peacock)] bg-[#F1F6F6]' : 'border-[#C9CFCB]'}`}><option value="pending">Not packed</option><option value="packed">Packed</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="returned">Returned</option></select>
        </li>)}</ul>
        {changedItems.length > 0 && <div className="mt-3 flex items-center gap-2.5"><button type="button" onClick={saveItems} className="h-9 px-3.5 text-sm font-semibold text-white bg-[color:var(--adm-peacock)] hover:bg-[color:var(--adm-peacock-deep)]">Save packing ({changedItems.length} item{changedItems.length === 1 ? '' : 's'})</button><button type="button" onClick={() => setItemDrafts({})} className="h-9 px-2 text-sm font-medium text-[color:var(--adm-muted)] hover:text-[color:var(--adm-ink)]">Undo</button></div>}
        <dl className="mt-4 pt-3 border-t border-[color:var(--adm-line)] grid grid-cols-[minmax(0,1fr)_auto] gap-y-1.5 text-sm">
          {totals.map(([label, value]) => <React.Fragment key={label}><dt className="text-[#2E3237]">{label}</dt><dd className="text-right">{value < 0 ? `−${formatCurrency(-value)}` : value === 0 && label === 'Shipping' ? 'Free' : formatCurrency(value)}</dd></React.Fragment>)}
          <dt className="text-[15px] font-semibold pt-1">Total</dt><dd className="text-right text-[15px] font-semibold pt-1">{formatCurrency(order.total)}</dd>
        </dl>
        <p className="mt-2 text-[13px] text-[color:var(--adm-muted)] break-words">{payment}</p>
      </div>

      {status !== 'pending_payment' && status !== 'cancelled' && <div className="space-y-3">
        <h3 className="text-[15px] font-semibold">Shipping</h3>
        {field('carrier', 'Courier', 'e.g. DTDC, India Post')}
        {field('trackingNumber', 'Tracking number', 'e.g. D12345678')}
        {field('trackingUrl', 'Tracking link', 'https://', 'url')}
      </div>}

      {cancelReason && <p className="text-sm text-[color:var(--adm-muted)]">{cancelReason}</p>}

      <div className="flex flex-wrap gap-2.5 pt-1">
        {status === 'processing' && <button type="button" onClick={() => updateOrder(order.id, { ...tracking, status: 'shipped' })} className="flex-1 h-11 px-4 text-[15px] font-semibold text-white bg-[color:var(--adm-peacock)] hover:bg-[color:var(--adm-peacock-deep)]">Mark as shipped</button>}
        {status === 'shipped' && <button type="button" onClick={() => updateOrder(order.id, { ...(trackingChanged ? tracking : {}), status: 'delivered' })} className="flex-1 h-11 px-4 text-[15px] font-semibold text-white bg-[color:var(--adm-peacock)] hover:bg-[color:var(--adm-peacock-deep)]">Mark as delivered</button>}
        {trackingChanged && status !== 'processing' && <button type="button" onClick={() => updateOrder(order.id, tracking)} className="h-11 px-4 text-[15px] font-medium border border-[#C9CFCB] bg-white">Save tracking</button>}
      </div>

      <div className="rounded-lg border border-[color:var(--adm-line)] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-semibold">Invoice</p>
          <p className="text-[color:var(--adm-muted)]">{invoiceIssued ? `${order.invoice.number}, issued ${new Date(order.invoice.issuedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : isPaid ? 'Paid before invoices were automatic.' : 'Created automatically once payment is confirmed.'}</p>
        </div>
        {invoiceIssued && <a href={`/api/admin/orders/${encodeURIComponent(order.id)}/invoice`} target="_blank" rel="noopener" className="h-10 px-4 inline-flex items-center gap-2 text-[15px] font-medium border border-[#C9CFCB] bg-white hover:border-[color:var(--adm-peacock)]"><Printer size={16} /> View invoice</a>}
        {!invoiceIssued && isPaid && <button type="button" onClick={issueInvoice} disabled={issuing} className="h-10 px-4 text-[15px] font-semibold text-white bg-[color:var(--adm-peacock)] disabled:opacity-50">{issuing ? 'Issuing…' : 'Issue invoice'}</button>}
        {invoiceError && <p className="w-full text-sm text-red-700" role="alert">{invoiceError}</p>}
      </div>

      {isPaid && <RefundsSection order={order} replaceOrder={replaceOrder} />}
    </div>
  </aside>;
}

const REFUND_METHOD_LABEL = { razorpay: 'Razorpay', upi: 'UPI', bank: 'Bank transfer', cash: 'Cash', other: 'Other' };

// Refund history for an order, plus the form to record a new refund (full or
// partial). Razorpay refunds are sent automatically; anything else is money
// the shop returned by hand and is recorded here for the books.
function RefundsSection({ order, replaceOrder }) {
  const refunded = Number(order.refundedTotal || 0);
  const remaining = Math.round((Number(order.total) - refunded) * 100) / 100;
  const canRazorpay = Boolean(order.paymentId);
  const blankForm = () => ({ amount: String(remaining), method: canRazorpay ? 'razorpay' : 'upi', reference: '', note: order.refundRequest?.reason || order.returnRequest?.reason || '', restock: order.returnRequest?.status === 'approved' && !order.returnRestocked });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [state, setState] = useState({ saving: false, error: '' });

  const submit = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    const how = form.method === 'razorpay' ? 'through Razorpay to the customer’s original payment method' : `as already paid by ${REFUND_METHOD_LABEL[form.method]}`;
    if (!window.confirm(`Record a refund of ${formatCurrency(amount)} ${how}?${form.method === 'razorpay' ? ' This sends the money now and can’t be undone.' : ''}`)) return;
    setState({ saving: true, error: '' });
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/refunds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ...form, amount }) }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) { setState({ saving: false, error: body.error || 'The refund could not be recorded.' }); return; }
    replaceOrder(body);
    setOpen(false);
    setState({ saving: false, error: '' });
  };

  return <div className="rounded-lg border border-[color:var(--adm-line)] p-4 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <p className="font-semibold text-sm">Refunds</p>
      <p className="text-sm text-[color:var(--adm-muted)]">{refunded > 0 ? `${formatCurrency(refunded)} of ${formatCurrency(order.total)} refunded` : 'None yet'}</p>
    </div>
    {order.refundRequest?.refundState === 'manual_required' && order.refundRequest.status !== 'refunded' && <p className="text-sm rounded-md bg-[#FBF3E6] text-[#5E4214] px-3 py-2">The customer’s refund was approved but couldn’t be sent automatically. Send it by UPI or bank transfer, then record it here.</p>}
    {(order.refunds || []).length > 0 && <ul className="divide-y divide-[color:var(--adm-line)] text-sm">{order.refunds.map((refund) => <li key={refund.id} className="py-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span><strong>{formatCurrency(refund.amount)}</strong> by {REFUND_METHOD_LABEL[refund.method] || refund.method}{refund.reference ? ` (${refund.reference})` : ''}<span className="block text-xs text-[color:var(--adm-muted)]">{new Date(refund.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{refund.restocked ? ', items back in stock' : ''}{refund.note ? `: ${refund.note}` : ''}</span></span>
      {refund.creditNote && <a href={`/api/admin/orders/${encodeURIComponent(order.id)}/refunds/${refund.id}/credit-note`} target="_blank" rel="noopener" className="text-sm font-medium text-[color:var(--adm-peacock)] hover:underline underline-offset-4">{refund.creditNote.number}</a>}
    </li>)}</ul>}
    {remaining > 0 && !open && <button type="button" onClick={() => { setForm(blankForm()); setOpen(true); }} className="h-9 px-3.5 text-sm font-semibold border border-[#C9CFCB] bg-white hover:border-[color:var(--adm-peacock)]">Record a refund</button>}
    {open && <form onSubmit={submit} className="space-y-3 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Amount (max {formatCurrency(remaining)})<input type="number" required min="0.01" max={remaining} step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="mt-1.5 w-full h-10 px-3 border border-[#C9CFCB] outline-none" /></label>
        <label className="block text-sm font-medium">Refunded by<select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} className="mt-1.5 w-full h-10 px-2 border border-[#C9CFCB]">{canRazorpay && <option value="razorpay">Razorpay (sent now)</option>}<option value="upi">UPI (already sent)</option><option value="bank">Bank transfer (already sent)</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
      </div>
      {form.method !== 'razorpay' && <label className="block text-sm font-medium">Reference <span className="font-normal text-[color:var(--adm-muted)]">(UPI or bank UTR number)</span><input value={form.reference} maxLength={80} onChange={(event) => setForm({ ...form, reference: event.target.value })} className="mt-1.5 w-full h-10 px-3 border border-[#C9CFCB] outline-none" /></label>}
      <label className="block text-sm font-medium">Reason <span className="font-normal text-[color:var(--adm-muted)]">(printed on the credit note)</span><input value={form.note} maxLength={300} onChange={(event) => setForm({ ...form, note: event.target.value })} className="mt-1.5 w-full h-10 px-3 border border-[#C9CFCB] outline-none" /></label>
      {!order.returnRestocked && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.restock} onChange={(event) => setForm({ ...form, restock: event.target.checked })} /> Put this order’s items back in stock (they were returned)</label>}
      {state.error && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
      <div className="flex gap-2.5"><button type="submit" disabled={state.saving} className="h-10 px-4 text-sm font-semibold text-white bg-[color:var(--adm-peacock)] disabled:opacity-50">{state.saving ? 'Saving…' : form.method === 'razorpay' ? 'Send refund' : 'Record refund'}</button><button type="button" onClick={() => setOpen(false)} className="h-10 px-3 text-sm font-medium text-[color:var(--adm-muted)]">Cancel</button></div>
    </form>}
  </div>;
}

const REQUEST_NEXT_STEP = {
  'return:approved': 'Once the parcel is back, open the order and record the refund (tick “put items back in stock”).',
  'refund:approved': 'Couldn’t be refunded automatically. Send the money by UPI or bank transfer, then record it in the order.',
};

function ReturnsAndRefunds({ orderCache, cacheOrders, updateRequest, openOrders, theme }) {
  // Only orders that have a request, fetched from the server (up to 200, newest first).
  const [ids, setIds] = useState(null);
  useEffect(() => {
    fetch('/api/admin/orders?has=request&limit=200', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (body) { cacheOrders(body.orders); setIds(body.orders.map((o) => o.id)); } else setIds([]); })
      .catch(() => setIds([]));
  }, [cacheOrders]);
  const orders = (ids || []).map((id) => orderCache[id]).filter(Boolean);
  const requests = orders.flatMap((order) => [order.returnRequest && { order, type: 'return', request: order.returnRequest }, order.refundRequest && { order, type: 'refund', request: order.refundRequest }].filter(Boolean))
    .sort((a, b) => (a.request.status === 'pending' ? 0 : 1) - (b.request.status === 'pending' ? 0 : 1) || new Date(b.request.requestedAt) - new Date(a.request.requestedAt));
  const decide = (order, type, status) => {
    const verb = status === 'approved' ? 'Approve' : 'Reject';
    const extra = status === 'approved' && type === 'refund' ? (order.paymentId ? ` ${formatCurrency(Number(order.total) - Number(order.refundedTotal || 0))} will be refunded through Razorpay right away.` : ' You’ll then need to send the money yourself and record it.') : '';
    if (window.confirm(`${verb} the ${type} request for order ${order.id}?${extra}`)) updateRequest(order.id, type, status);
  };
  return <section className="adm-card p-6 md:p-8"><h2 className={`text-lg font-semibold mb-2 ${theme.fontHeading}`}>Returns & refunds</h2><p className="text-[color:var(--adm-muted)] mb-6">Customer requests, newest waiting first. Refunds themselves are recorded in each order, where the credit note is created.</p>{ids === null ? <p className="text-[color:var(--adm-muted)]">Loading requests…</p> : requests.length === 0 ? <p className="text-[color:var(--adm-muted)]">No return or refund requests yet.</p> : <div className="space-y-4">{requests.map(({ order, type, request }) => {
    const nextStep = order.paymentStatus === 'refunded' ? null : REQUEST_NEXT_STEP[`${type}:${request.status}`];
    return <div key={`${order.id}-${type}`} className="adm-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">{type === 'return' ? 'Return' : 'Refund'} request, {order.id}</p><p className="text-xs text-[color:var(--adm-muted)] mt-0.5">{order.customer?.name}, {formatCurrency(order.total)}, requested {new Date(request.requestedAt).toLocaleDateString()}</p><p className="mt-2 text-sm">“{request.reason}”</p></div><span className="text-sm font-medium capitalize text-[color:var(--adm-muted)]">{request.status}{order.refundedTotal ? `, ${formatCurrency(order.refundedTotal)} refunded` : ''}</span></div>
      {nextStep && <p className="mt-3 text-sm rounded-md bg-[#FBF3E6] text-[#5E4214] px-3 py-2">{nextStep}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{request.status === 'pending' && <><button type="button" onClick={() => decide(order, type, 'approved')} className="inline-flex items-center gap-2 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Check size={14} /> Approve</button><button type="button" onClick={() => decide(order, type, 'rejected')} className="inline-flex items-center gap-2 border border-red-300 px-4 py-2 text-sm font-semibold text-red-700"><XCircle size={14} /> Reject</button></>}<button type="button" onClick={() => openOrders('all', order.id)} className="px-4 py-2 text-sm font-semibold border border-[color:var(--adm-line)] hover:border-[color:var(--adm-peacock)]">Open order</button></div></div>;
  })}</div>}</section>;
}

function Messages({ messages, markMessage, theme }) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const filtered = query ? messages.filter((m) => m.name.toLowerCase().includes(query) || m.email.toLowerCase().includes(query) || m.message.toLowerCase().includes(query)) : messages;
  return <section className="adm-card p-6 md:p-8"><h2 className={`text-lg font-semibold mb-2 ${theme.fontHeading}`}>Contact messages</h2><p className="text-[color:var(--adm-muted)] mb-6">Messages submitted from the storefront contact form.</p>{messages.length === 0 ? <p className="text-[color:var(--adm-muted)]">No messages yet.</p> : <><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" className="w-full max-w-sm px-3 py-2 mb-4 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none text-sm" /><div className="space-y-4">{filtered.map((message) => <div key={message.id} className="adm-card p-5"><div className="flex flex-wrap items-center justify-between gap-3 mb-2"><div><p className="font-semibold">{message.name} <span className="opacity-50 font-normal">&lt;{message.email}&gt;</span></p><p className="text-xs opacity-50 mt-1">{new Date(message.created_at).toLocaleString()}</p></div><span className="text-sm font-medium text-[color:var(--adm-muted)]">{message.status}</span></div><p className="text-sm whitespace-pre-wrap">{message.message}</p><div className="mt-3 flex flex-wrap gap-4"><a href={`mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(`Re: your message to ${SITE_CONFIG.name}`)}&body=${encodeURIComponent(`Hi ${message.name},\n\n\n\n> ${message.message.split('\n').join('\n> ')}`)}`} onClick={() => message.status !== 'replied' && markMessage(message.id, 'replied')} className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4"><Reply size={13} /> Reply by email</a>{message.status === 'new' && <button type="button" onClick={() => markMessage(message.id, 'read')} className="text-sm font-semibold underline underline-offset-4">Mark as read</button>}</div></div>)}</div></>}</section>;
}

function Reviews({ reviews, products, deleteReview, theme }) {
  const productName = (id) => products.find((product) => product.id === id)?.name || `Product #${id}`;
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const filtered = query ? reviews.filter((r) => r.name.toLowerCase().includes(query) || r.comment.toLowerCase().includes(query) || productName(r.product_id).toLowerCase().includes(query)) : reviews;
  return <section className="adm-card p-6 md:p-8"><h2 className={`text-lg font-semibold mb-2 ${theme.fontHeading}`}>Customer reviews</h2><p className="text-[color:var(--adm-muted)] mb-6">Reviews submitted from product pages. Remove anything inappropriate or spam.</p>{reviews.length === 0 ? <p className="text-[color:var(--adm-muted)]">No reviews yet.</p> : <><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reviews" className="w-full max-w-sm px-3 py-2 mb-4 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none text-sm" /><div className="space-y-4">{filtered.map((review) => <div key={review.id} className="adm-card p-5"><div className="flex flex-wrap items-start justify-between gap-3 mb-2"><div><p className="text-xs text-[color:var(--adm-muted)]">{productName(review.product_id)}</p><div className="flex items-center gap-2 mt-1"><div className="flex text-yellow-500" aria-hidden="true">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} fill={i < review.rating ? 'currentColor' : 'none'} />)}</div><span className="font-semibold text-sm">{review.name}</span></div><p className="text-xs opacity-50 mt-1">{new Date(review.created_at).toLocaleString()}</p></div><button type="button" onClick={() => deleteReview(review.id)} className="p-2 border border-[color:var(--adm-line)] hover:bg-red-50 hover:text-red-600 hover:border-red-200" aria-label="Delete review"><Trash2 size={15} /></button></div><p className="text-sm whitespace-pre-wrap">{review.comment}</p></div>)}</div></>}</section>;
}

function BlogAdmin({ posts, editingPost, setEditingPost, savePost, deletePost, theme }) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const filtered = query ? posts.filter((p) => p.title.toLowerCase().includes(query)) : posts;
  return <section><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6"><div><h2 className={`text-lg font-semibold ${theme.fontHeading}`}>Blog</h2><p className="text-[color:var(--adm-muted)] mt-2">Write and publish journal posts for SEO and storytelling.</p></div><button onClick={() => setEditingPost({ ...emptyPost })} className="inline-flex items-center justify-center gap-2 px-5 py-3 text-white text-sm font-semibold" style={{ backgroundColor: theme.accentColor }}><FileText size={15} /> New post</button></div>{editingPost && <PostEditor post={editingPost} setPost={setEditingPost} savePost={savePost} theme={theme} />}{posts.length === 0 ? <p className="text-[color:var(--adm-muted)]">No posts yet.</p> : <><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search posts" className="w-full max-w-sm px-3 py-2 mb-4 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none text-sm" /><div className="space-y-3">{filtered.map((post) => <div key={post.id} className="adm-card p-4 flex gap-4 items-center"><div className="flex-grow min-w-0"><p className="text-xs text-[color:var(--adm-muted)]">{post.status} · {post.published_at ? new Date(post.published_at).toLocaleDateString() : 'not published'}</p><h3 className="font-bold mt-1 truncate">{post.title}</h3></div><div className="flex items-center gap-2"><button onClick={() => setEditingPost({ id: post.id, slug: post.slug, title: post.title, excerpt: post.excerpt, content: post.content, coverImage: post.cover_image || '', seoTitle: post.seo_title || '', seoDescription: post.seo_description || '', status: post.status })} className="p-2 border border-[color:var(--adm-line)] hover:bg-current/10" aria-label={`Edit ${post.title}`}><Pencil size={15} /></button><button onClick={() => deletePost(post.id)} className="p-2 border border-[color:var(--adm-line)] hover:bg-red-50 hover:text-red-600 hover:border-red-200" aria-label={`Delete ${post.title}`}><Trash2 size={15} /></button></div></div>)}</div></>}</section>;
}

function PostEditor({ post, setPost, savePost, theme }) {
  const [mediaError, setMediaError] = useState('');
  const update = (key, value) => setPost({ ...post, [key]: value });
  const uploadCover = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { update('coverImage', await uploadMedia(file)); setMediaError(''); } catch (error) { setMediaError(error.message); }
  };
  return <form onSubmit={(event) => { event.preventDefault(); savePost(post); }} className="adm-card p-6 md:p-8 mb-8 space-y-6"><div className="flex items-center justify-between"><h3 className={`text-base font-semibold ${theme.fontHeading}`}>{post.id ? 'Edit post' : 'New post'}</h3><button type="button" onClick={() => setPost(null)} className="text-xs opacity-60">Cancel</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Title" value={post.title} onChange={(value) => update('title', value)} required /><Field label="URL slug (optional)" value={post.slug} onChange={(value) => update('slug', value)} /><Field label="Status" value={post.status} onChange={(value) => update('status', value)} options={['draft', 'published']} /></div><div><label className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Excerpt</label><textarea required rows="2" value={post.excerpt} onChange={(event) => update('excerpt', event.target.value)} placeholder="One or two sentences shown in the blog listing" className="w-full bg-transparent border border-[color:var(--adm-line)] px-4 py-3 outline-none resize-y" /></div><div><label className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Content</label><textarea required rows="10" value={post.content} onChange={(event) => update('content', event.target.value)} placeholder="Write the post. Leave a blank line between paragraphs." className="w-full bg-transparent border border-[color:var(--adm-line)] px-4 py-3 outline-none resize-y" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="SEO title (optional)" value={post.seoTitle} onChange={(value) => update('seoTitle', value)} /><Field label="SEO description (optional)" value={post.seoDescription} onChange={(value) => update('seoDescription', value)} /></div><MediaUpload label="Cover photo" icon={ImagePlus} value={post.coverImage} accept="image/*" onChange={uploadCover} />{mediaError && <p className="text-sm text-red-600" role="alert">{mediaError}</p>}<button type="submit" className="inline-flex items-center gap-2 px-6 py-3 text-white text-sm font-semibold" style={{ backgroundColor: theme.accentColor }}><Save size={15} /> Save post</button></form>;
}

// Shown once after creating a temporary password: it can't be looked up later.
function TempPasswordNotice({ result, name, phone, who, onClose }) {
  const [copied, setCopied] = useState(false);
  const expires = new Date(result.expiresAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const signInPath = who === 'staff' ? '/admin' : '/login';
  const message = `Hi${name ? ` ${name}` : ''}, your temporary ${SITE_CONFIG.name} password is ${result.temporaryPassword} . Sign in at ${window.location.origin}${signInPath} with ${result.email} and choose a new password. It expires ${expires}.`;
  const whatsapp = phone ? whatsAppLink(phone, message) : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(result.temporaryPassword); setCopied(true); } catch { setCopied(false); }
  };
  return <div className="mb-6 rounded-xl border border-[#E8D3AE] bg-[#FBF3E6] p-5" role="status">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold">Temporary password for {result.email}</p>
        <p className="mt-2 font-mono text-2xl tracking-wide select-all">{result.temporaryPassword}</p>
        <p className="mt-2 text-sm text-[#5E4214]">Works until {expires}. They must choose a new password right after signing in. This is the only time it’s shown.</p>
      </div>
      <button type="button" onClick={onClose} className="p-1 text-[color:var(--adm-muted)] hover:text-[color:var(--adm-ink)]" aria-label="Close"><X size={18} /></button>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={copy} className="h-9 px-3.5 text-sm font-semibold border border-[#C9CFCB] bg-white">{copied ? 'Copied' : 'Copy password'}</button>
      {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="h-9 px-3.5 inline-flex items-center text-sm font-semibold text-white" style={{ backgroundColor: '#128C7E' }}>Send on WhatsApp</a>}
    </div>
  </div>;
}

function Team({ staff, inviteStaff, removeStaff, currentEmail, theme }) {
  const [tempPassword, setTempPassword] = useState({});
  const issueStaffPassword = async (member) => {
    if (!window.confirm(`Create a temporary password for ${member.email}? Their current password stops working and they're signed out everywhere.`)) return;
    const response = await fetch(`/api/admin/staff/${member.id}/temp-password`, { method: 'POST', credentials: 'include' }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    setTempPassword(response?.ok ? { result: body } : { error: body.error || 'The temporary password could not be created.' });
  };
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const submit = (event) => {
    event.preventDefault();
    setError('');
    inviteStaff(form.email, form.password).then(() => setForm({ email: '', password: '' })).catch((err) => setError(err.message));
  };
  return <section><div className="mb-6"><h2 className={`text-lg font-semibold ${theme.fontHeading}`}>Team</h2><p className="text-[color:var(--adm-muted)] mt-2">Staff accounts can manage orders, catalog, and content — not settings, pricing, or the team itself.</p></div>
    <form onSubmit={submit} className="adm-card p-6 md:p-8 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      <label className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Email</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full px-4 py-3 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none" /></label>
      <label className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Temporary password</span><input required type="text" minLength={12} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="w-full px-4 py-3 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none" /></label>
      <button type="submit" className="px-6 py-3 text-white text-sm font-semibold" style={{ backgroundColor: theme.accentColor }}>Invite staff</button>
      {error && <p className="text-sm text-red-600 md:col-span-3" role="alert">{error}</p>}
    </form>
    {tempPassword.result && <TempPasswordNotice result={tempPassword.result} who="staff" onClose={() => setTempPassword({})} />}
    {tempPassword.error && <p className="mb-4 text-sm text-red-700" role="alert">{tempPassword.error}</p>}
    <div className="space-y-3">{staff.map((member) => <div key={member.id} className="adm-card p-4 flex items-center justify-between gap-3"><div><p className="font-semibold">{member.email}{member.email === currentEmail ? ' (you)' : ''}</p><p className="text-xs text-[color:var(--adm-muted)] mt-1">{member.role}</p></div>{member.role !== 'owner' && <div className="flex items-center gap-2"><button type="button" onClick={() => issueStaffPassword(member)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-[color:var(--adm-line)] hover:border-[color:var(--adm-peacock)]"><KeyRound size={14} /> Temporary password</button><button onClick={() => removeStaff(member.id)} className="p-2 border border-[color:var(--adm-line)] hover:bg-red-50 hover:text-red-600 hover:border-red-200" aria-label={`Remove ${member.email}`}><Trash2 size={15} /></button></div>}</div>)}</div>
    <p className="mt-6 text-sm text-[color:var(--adm-muted)]">Locked out of the owner account yourself? On the server, run <code className="px-1.5 py-0.5 rounded bg-[color:var(--adm-canvas)]">npm run reset-admin-password -- your@email</code> to get a temporary password.</p>
  </section>;
}

function SettingsPanel({ settings, setSettings, saveSettings, saved, errors = {}, theme }) {
  const pricing = settings.pricing || {};
  const updatePricing = (key, value) => setSettings({ ...settings, pricing: { ...pricing, [key]: value } });
  const business = settings.business || {};
  const updateBusiness = (key, value) => setSettings({ ...settings, business: { ...business, [key]: value } });
  const policies = { ...policySettings(settings), ...(settings.policies || {}) };
  const updatePolicies = (key, value) => setSettings({ ...settings, policies: { ...policies, [key]: value } });
  const missing = missingBusinessDetails(business);
  const gstinState = business.gstin?.length >= 2 ? INDIAN_STATES.find((s) => s.code === business.gstin.slice(0, 2)) : null;
  const whatsapp = normalizeWhatsAppNumber(settings.whatsapp);
  const prefix = (business.invoicePrefix || 'SB').toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'SB';

  const labelClass = 'block text-sm font-medium text-[color:var(--adm-muted)] mb-2';
  const inputClass = (key) => `w-full px-4 py-3 bg-transparent border outline-none focus:border-current ${errors[key] ? 'border-[color:var(--adm-arakku)]' : 'border-[color:var(--adm-line)]'}`;
  const fieldError = (key) => errors[key] && <p id={`settings-${key}-error`} className="mt-1.5 text-sm text-[color:var(--adm-arakku)]">{errors[key]}</p>;
  const hint = (text) => <p className="mt-1.5 text-xs text-[color:var(--adm-muted)]">{text}</p>;
  const described = (key) => (errors[key] ? { 'aria-invalid': true, 'aria-describedby': `settings-${key}-error` } : {});
  const businessInput = (key, label, extra = {}) => <div>
    <label htmlFor={`settings-business-${key}`} className={labelClass}>{label}</label>
    <input id={`settings-business-${key}`} value={business[key] || ''} onChange={(event) => updateBusiness(key, extra.upper ? event.target.value.toUpperCase() : event.target.value)} className={inputClass(`business.${key}`)} {...described(`business.${key}`)} placeholder={extra.placeholder} maxLength={extra.maxLength} type={extra.type || 'text'} inputMode={extra.inputMode} />
    {fieldError(`business.${key}`)}
    {extra.hint && !errors[`business.${key}`] && hint(extra.hint)}
  </div>;

  return <section className="max-w-2xl adm-card p-6 md:p-8">
    <h2 className={`text-lg font-semibold mb-2 ${theme.fontHeading}`}>Store settings</h2>
    <p className="text-[color:var(--adm-muted)] mb-8">Saved to the server and used across the shop, checkout and every new invoice.</p>
    <form onSubmit={saveSettings} className="space-y-10" noValidate>
      <fieldset className="space-y-5">
        <legend className="font-bold mb-4">Shop</legend>
        <div><label htmlFor="settings-announcement" className={labelClass}>Announcement bar</label><input id="settings-announcement" value={settings.announcement || ''} onChange={(event) => setSettings({ ...settings, announcement: event.target.value })} className={inputClass('announcement')} /></div>
        <div><label htmlFor="settings-supportEmail" className={labelClass}>Support email (shown on the Contact page)</label><input id="settings-supportEmail" type="email" value={settings.supportEmail || ''} onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })} className={inputClass('supportEmail')} {...described('supportEmail')} />{fieldError('supportEmail')}</div>
        <div>
          <label htmlFor="settings-whatsapp" className={labelClass}>WhatsApp number for customer chat</label>
          <input id="settings-whatsapp" type="tel" inputMode="tel" value={settings.whatsapp || ''} placeholder="98765 43210" onChange={(event) => setSettings({ ...settings, whatsapp: event.target.value })} className={inputClass('whatsapp')} {...described('whatsapp')} />
          {fieldError('whatsapp') || hint(!settings.whatsapp ? 'Leave empty to hide the WhatsApp button on the shop.' : whatsapp ? <>Shoppers will chat with +{whatsapp}. <a href={whatsAppLink(settings.whatsapp, 'Test message from the store admin')} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Test the link</a></> : <span className="text-[color:var(--adm-arakku)]">Enter a 10-digit mobile number, or include the country code (+65 …).</span>)}
        </div>
      </fieldset>

      <fieldset className="pt-8 border-t border-[color:var(--adm-line)]">
        <legend className="font-bold mb-4">Pricing</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block"><span className={labelClass}>GST rate (%)</span><input type="number" min="0" step="0.01" value={pricing.taxRatePercent ?? 0} onChange={(event) => updatePricing('taxRatePercent', Number(event.target.value))} className={inputClass('pricing')} /></label>
          <label className="block"><span className={labelClass}>Shipping fee (₹)</span><input type="number" min="0" step="0.01" value={pricing.shippingFee ?? 0} onChange={(event) => updatePricing('shippingFee', Number(event.target.value))} className={inputClass('pricing')} /></label>
          <label className="block"><span className={labelClass}>Free shipping over (₹)</span><input type="number" min="0" step="0.01" value={pricing.freeShippingThreshold ?? ''} placeholder="No threshold" onChange={(event) => updatePricing('freeShippingThreshold', event.target.value === '' ? null : Number(event.target.value))} className={inputClass('pricing')} /></label>
        </div>
        {hint('Applies to every checkout immediately. Leave “free shipping over” empty to always charge shipping.')}
      </fieldset>

      <fieldset className="pt-8 border-t border-[color:var(--adm-line)] space-y-5">
        <legend className="font-bold mb-1">Policies</legend>
        <p className="text-sm text-[color:var(--adm-muted)] -mt-3">Used in the <a href="/policies/returns" target="_blank" rel="noopener" className="underline underline-offset-4">policy pages</a>, FAQ and the shop’s trust bar, so they always say the same thing.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-returnDays" className={labelClass}>Return window (days after delivery)</label>
            <input id="settings-returnDays" type="number" min="0" max="90" step="1" value={policies.returnDays} onChange={(event) => updatePolicies('returnDays', event.target.value === '' ? '' : Number(event.target.value))} className={inputClass('policies.returnDays')} {...described('policies.returnDays')} />
            {fieldError('policies.returnDays') || hint('0 means no change-of-mind returns (damaged or wrong items are still covered). 7 is common in India.')}
          </div>
          <div>
            <label htmlFor="settings-dispatchDays" className={labelClass}>Dispatch time (business days)</label>
            <input id="settings-dispatchDays" value={policies.dispatchDays} maxLength={20} placeholder="1–2" onChange={(event) => updatePolicies('dispatchDays', event.target.value)} className={inputClass('policies.dispatchDays')} />
            {hint('Shown as “Dispatched in 1–2 business days”.')}
          </div>
        </div>
        <div>
          <label htmlFor="settings-grievanceName" className={labelClass}>Grievance officer’s name</label>
          <input id="settings-grievanceName" value={policies.grievanceName} maxLength={80} placeholder="The person who handles customer complaints" onChange={(event) => updatePolicies('grievanceName', event.target.value)} className={inputClass('policies.grievanceName')} />
          {hint('Required by India’s e-commerce rules. Shown with your business email and phone on every policy page.')}
        </div>
      </fieldset>

      <fieldset className="pt-8 border-t border-[color:var(--adm-line)] space-y-5">
        <legend className="font-bold mb-1">Business details for invoices</legend>
        <p className="text-sm text-[color:var(--adm-muted)] -mt-3">Printed on every new invoice and credit note. Ones already issued keep the details they were issued with.</p>
        {missing.length > 0 && <p className="text-sm rounded-md bg-[#FBF3E6] text-[#5E4214] px-3 py-2">Still missing: {missing.join(', ')}. Invoices issued before you add them won’t show them.</p>}
        {businessInput('legalName', 'Registered business name', { placeholder: SITE_CONFIG.legalName, maxLength: 120 })}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {businessInput('gstin', 'GSTIN (leave empty if not registered)', { upper: true, maxLength: 15, placeholder: '33ABCDE1234F1Z5', hint: gstinState ? `Registered in ${gstinState.name}.` : 'Makes invoices “Tax invoices” with CGST/SGST or IGST.' })}
          <div>
            <label htmlFor="settings-business-state" className={labelClass}>State you ship from</label>
            <select id="settings-business-state" value={business.state || ''} onChange={(event) => updateBusiness('state', event.target.value)} className={inputClass('business.state')} {...described('business.state')}>
              <option value="">Choose a state</option>
              {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
            </select>
            {fieldError('business.state') || hint('CGST + SGST for customers in this state, IGST for everyone else.')}
          </div>
        </div>
        <div>
          <label htmlFor="settings-business-address" className={labelClass}>Business address (with PIN code)</label>
          <textarea id="settings-business-address" rows="3" maxLength={400} value={business.address || ''} onChange={(event) => updateBusiness('address', event.target.value)} className={`${inputClass('business.address')} resize-y`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {businessInput('phone', 'Phone', { type: 'tel', inputMode: 'tel', placeholder: '+91 98765 43210', maxLength: 20 })}
          {businessInput('email', 'Email on invoices', { type: 'email', placeholder: settings.supportEmail || 'accounts@yourshop.in', maxLength: 120, hint: business.email ? '' : 'Empty uses the support email above.' })}
        </div>
        {businessInput('invoicePrefix', 'Invoice number prefix', { upper: true, maxLength: 10, placeholder: 'SB', hint: `Invoices: ${prefix}/2026-27/00001. Credit notes: ${prefix}-CN/2026-27/00001. Numbers restart each April. Pick this once: changing it later starts a new-looking series.` })}
      </fieldset>

      <div className="flex items-center gap-4">
        <button type="submit" className="px-6 py-3 text-white text-sm font-semibold" style={{ backgroundColor: theme.accentColor }}>{saved ? 'Saved' : 'Save settings'}</button>
        {Object.keys(errors).length > 0 && <p className="text-sm text-[color:var(--adm-arakku)]" role="alert">Fix the highlighted fields, then save again.</p>}
      </div>
    </form>
  </section>;
}

function Questions({ questions, products, answerQuestion, deleteQuestion, theme }) {
  const productName = (id) => products.find((product) => product.id === id)?.name || `Product #${id}`;
  const [drafts, setDrafts] = useState({});
  const pending = questions.filter((q) => q.status === 'pending');
  const answered = questions.filter((q) => q.status === 'answered');
  return <section className="adm-card p-6 md:p-8"><h2 className={`text-lg font-semibold mb-2 ${theme.fontHeading}`}>Product questions</h2><p className="text-[color:var(--adm-muted)] mb-6">Answer questions submitted from product pages — your answer publishes immediately.</p>
    {pending.length === 0 ? <p className="text-[color:var(--adm-muted)] mb-8">No pending questions.</p> : <div className="space-y-4 mb-10">{pending.map((q) => <div key={q.id} className="adm-card p-5"><p className="text-xs text-[color:var(--adm-muted)] mb-1">{productName(q.product_id)} · asked by {q.asked_name}</p><p className="font-semibold text-sm mb-3">{q.question}</p><div className="flex gap-2"><input value={drafts[q.id] ?? ''} onChange={(event) => setDrafts({ ...drafts, [q.id]: event.target.value })} placeholder="Write an answer" className="flex-grow min-w-0 px-3 py-2 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none text-sm" /><button type="button" onClick={() => answerQuestion(q.id, drafts[q.id])} disabled={!drafts[q.id]?.trim()} className="px-4 py-2 text-white text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: theme.accentColor }}>Answer</button><button type="button" onClick={() => deleteQuestion(q.id)} className="p-2 border border-[color:var(--adm-line)] hover:bg-red-50 hover:text-red-600 hover:border-red-200" aria-label="Delete question"><Trash2 size={15} /></button></div></div>)}</div>}
    {answered.length > 0 && <><h3 className="font-bold mb-4">Answered</h3><div className="space-y-4">{answered.map((q) => <div key={q.id} className="adm-card p-5"><p className="text-xs text-[color:var(--adm-muted)] mb-1">{productName(q.product_id)} · asked by {q.asked_name}</p><p className="font-semibold text-sm mb-2">Q: {q.question}</p><p className="text-sm opacity-70">A: {q.answer}</p></div>)}</div></>}
  </section>;
}

function Coupons({ coupons, createCoupon, toggleCoupon, deleteCoupon, theme }) {
  const [form, setForm] = useState({ code: '', type: 'percent', value: '', minSubtotal: '', maxUses: '' });
  const submit = (event) => {
    event.preventDefault();
    createCoupon({ code: form.code, type: form.type, value: Number(form.value), minSubtotal: form.minSubtotal ? Number(form.minSubtotal) : 0, maxUses: form.maxUses ? Number(form.maxUses) : undefined });
    setForm({ code: '', type: 'percent', value: '', minSubtotal: '', maxUses: '' });
  };
  return <section><div className="mb-6"><h2 className={`text-lg font-semibold ${theme.fontHeading}`}>Coupons</h2><p className="text-[color:var(--adm-muted)] mt-2">Create discount codes. The amount is always validated and charged server-side.</p></div>
    <form onSubmit={submit} className="adm-card p-6 md:p-8 mb-8 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
      <label className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Code</span><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className="w-full px-4 py-3 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none uppercase" /></label>
      <label className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Type</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="w-full px-4 py-3 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none"><option value="percent">% off</option><option value="fixed">₹ off</option></select></label>
      <label className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Value</span><input required type="number" min="0.01" step="0.01" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} className="w-full px-4 py-3 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none" /></label>
      <label className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Min order (₹)</span><input type="number" min="0" value={form.minSubtotal} onChange={(event) => setForm({ ...form, minSubtotal: event.target.value })} className="w-full px-4 py-3 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none" /></label>
      <label className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Max uses (optional)</span><input type="number" min="1" value={form.maxUses} onChange={(event) => setForm({ ...form, maxUses: event.target.value })} className="w-full px-4 py-3 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none" /></label>
      <button type="submit" className="md:col-span-5 inline-flex items-center justify-center gap-2 px-6 py-3 text-white text-sm font-semibold" style={{ backgroundColor: theme.accentColor }}><Tag size={15} /> Create coupon</button>
    </form>
    {coupons.length === 0 ? <p className="text-[color:var(--adm-muted)]">No coupons yet.</p> : <div className="space-y-3">{coupons.map((c) => <div key={c.id} className="adm-card p-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold font-mono">{c.code}</p><p className="text-xs opacity-60 mt-1">{c.type === 'percent' ? `${c.value}% off` : `${formatCurrency(c.value)} off`}{Number(c.min_subtotal) > 0 ? ` · min ${formatCurrency(c.min_subtotal)}` : ''}{c.max_uses != null ? ` · ${c.used_count}/${c.max_uses} used` : ` · ${c.used_count} used`}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => toggleCoupon(c.id, !c.active)} className={`px-3 py-2 text-sm font-semibold border ${c.active ? 'border-emerald-600 text-emerald-700' : 'border-[color:var(--adm-line)] opacity-60'}`}>{c.active ? 'Active' : 'Inactive'}</button><button type="button" onClick={() => deleteCoupon(c.id)} className="p-2 border border-[color:var(--adm-line)] hover:bg-red-50 hover:text-red-600 hover:border-red-200" aria-label={`Delete ${c.code}`}><Trash2 size={15} /></button></div></div>)}</div>}
  </section>;
}

// Registered accounts and guest shoppers, worked out on the server, 50 at a time.
function Customers({ initialSearch = '', theme }) {
  const [search, setSearch] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState('all');
  const [data, setData] = useState({ rows: [], total: 0, registered: 0, loading: true, error: '' });
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set('q', search.trim());
    if (typeFilter !== 'all') p.set('type', typeFilter);
    return p;
  }, [search, typeFilter]);

  const load = useCallback(async (offset = 0) => {
    setData((current) => ({ ...current, loading: true, error: '' }));
    const query = new URLSearchParams(params);
    if (offset) query.set('offset', String(offset));
    const response = await fetch(`/api/admin/customers?${query}`, { credentials: 'include' }).catch(() => null);
    const body = response?.ok ? await response.json().catch(() => null) : null;
    if (!body) { setData((current) => ({ ...current, loading: false, error: 'Customers could not be loaded. Try again.' })); return; }
    const rows = body.customers.map((c) => ({ accountId: c.account_id, name: c.name, email: c.email, phone: c.phone, joinedAt: c.joined_at, orders: c.orders, lifetimeValue: c.lifetime_value, lastOrderAt: c.last_order_at }));
    setData((current) => ({ rows: offset ? [...current.rows, ...rows] : rows, total: body.total, registered: body.registered, loading: false, error: '' }));
  }, [params]);

  useEffect(() => {
    const timer = setTimeout(() => load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const customers = data.rows;
  const filtered = data.rows;
  const exportCsv = () => window.location.assign(`/api/admin/customers.csv?${params}`);

  // Forgot password: after checking it's really them (phone, a recent order),
  // create a one-time password to read out or send on WhatsApp.
  const [tempPassword, setTempPassword] = useState({});
  const issueTempPassword = async (customer) => {
    if (!window.confirm(`Create a temporary password for ${customer.email}? Their current password stops working and they're signed out everywhere. Only do this after confirming it's really them (for example their mobile number or a recent order number).`)) return;
    setTempPassword({ busy: true });
    const response = await fetch(`/api/admin/customers/${customer.accountId}/temp-password`, { method: 'POST', credentials: 'include' }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    setTempPassword(response?.ok ? { result: body, name: customer.name, phone: customer.phone } : { error: body.error || 'The temporary password could not be created.' });
  };

  return <section className="adm-card p-6 md:p-8"><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6"><div><h2 className={`text-lg font-semibold mb-2 ${theme.fontHeading}`}>Customers</h2><p className="text-[color:var(--adm-muted)]">Registered accounts plus every shopper who has checked out as a guest.</p></div>{customers.length > 0 && <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 py-2 border border-[color:var(--adm-line)] text-sm font-semibold hover:bg-current/10"><Download size={14} /> Export CSV</button>}</div>
    {data.error ? <p className="text-red-700">{data.error}</p> : !data.loading && customers.length === 0 && !search && typeFilter === 'all' ? <p className="text-[color:var(--adm-muted)]">No customers yet.</p> : <>
      <div className="flex flex-wrap items-center gap-2 mb-4">{[['all', 'All', null], ['registered', 'Registered', null], ['guest', 'Guests', null]].map(([value, label, count]) => <button key={value} type="button" onClick={() => setTypeFilter(value)} aria-pressed={typeFilter === value} className={`px-3 py-2 text-sm font-semibold border ${typeFilter === value ? 'border-current' : 'border-[color:var(--adm-line)] opacity-60 hover:opacity-100'}`}>{label}{count != null && <span className="text-[color:var(--adm-muted)]"> {count}</span>}</button>)}<span className="ml-auto text-sm text-[color:var(--adm-muted)]">{data.loading && !data.rows.length ? 'Loading…' : `${data.total} ${data.total === 1 ? 'person' : 'people'}${typeFilter === 'all' && data.total ? `, ${data.registered} registered` : ''}`}</span></div>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, or phone" className="w-full max-w-sm px-3 py-2 mb-4 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none text-sm" />
      {tempPassword.result && <TempPasswordNotice result={tempPassword.result} name={tempPassword.name} phone={tempPassword.phone} who="customer" onClose={() => setTempPassword({})} />}
      {tempPassword.error && <p className="mb-4 text-sm text-red-700" role="alert">{tempPassword.error}</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-[color:var(--adm-muted)] border-b border-[color:var(--adm-line)]"><tr><th className="py-3 pr-4">Customer</th><th className="py-3 pr-4">Type</th><th className="py-3 pr-4">Orders</th><th className="py-3 pr-4">Lifetime value</th><th className="py-3 pr-4">Last order</th><th className="py-3"><span className="sr-only">Account actions</span></th></tr></thead><tbody>{filtered.map((c) => <tr key={c.email} className="border-b border-[color:var(--adm-line)] last:border-0 align-top"><td className="py-3 pr-4">{c.name || 'Guest'}<span className="block text-xs opacity-50">{c.email}</span>{c.phone && <span className="block text-xs opacity-50">{c.phone}</span>}</td><td className="py-3 pr-4 text-xs">{c.accountId ? <>Registered<span className="block normal-case tracking-normal opacity-50">since {new Date(c.joinedAt).toLocaleDateString()}</span></> : <span className="text-[color:var(--adm-muted)]">Guest</span>}</td><td className="py-3 pr-4">{c.orders}</td><td className="py-3 pr-4 font-bold">{formatCurrency(c.lifetimeValue)}</td><td className="py-3 pr-4">{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '—'}</td><td className="py-3 text-right">{c.accountId && <button type="button" onClick={() => issueTempPassword(c)} disabled={tempPassword.busy} className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-[color:var(--adm-peacock)] hover:underline underline-offset-4 disabled:opacity-50"><KeyRound size={14} /> Temporary password</button>}</td></tr>)}</tbody></table></div>
      {data.rows.length < data.total && <div className="mt-4 flex justify-center"><button type="button" onClick={() => load(data.rows.length)} disabled={data.loading} className="h-9 px-4 text-sm font-semibold border border-[#C9CFCB] bg-white hover:border-[color:var(--adm-peacock)] disabled:opacity-50">{data.loading ? 'Loading…' : `Load more (${data.total - data.rows.length} left)`}</button></div>}
    </>}
  </section>;
}

function ActivityLog({ logs, theme }) {
  return <section className="adm-card p-6 md:p-8"><h2 className={`text-lg font-semibold mb-2 ${theme.fontHeading}`}>Activity</h2><p className="text-[color:var(--adm-muted)] mb-6">Admin login attempts and account changes.</p>{logs.length === 0 ? <p className="text-[color:var(--adm-muted)]">No activity recorded yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-[color:var(--adm-muted)] border-b border-[color:var(--adm-line)]"><tr><th className="py-3 pr-4">When</th><th className="py-3 pr-4">Admin</th><th className="py-3 pr-4">Action</th><th className="py-3">IP</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id} className="border-b border-[color:var(--adm-line)] last:border-0"><td className="py-3 pr-4 text-xs">{new Date(log.created_at).toLocaleString()}</td><td className="py-3 pr-4">{log.admin_email || '—'}</td><td className="py-3 pr-4"><span className={`text-sm font-semibold ${log.action.endsWith('_failed') ? 'text-red-600' : ''}`}>{log.action.replace(/_/g, ' ')}</span></td><td className="py-3 text-xs opacity-60">{log.ip_address}</td></tr>)}</tbody></table></div>}</section>;
}


function Catalog({ products, categories, saveCategories, inventory, updateInventory, editingProduct, setEditingProduct, saveProduct, deleteProduct, theme }) {
  const [newCategory, setNewCategory] = useState('');
  const [search, setSearch] = useState('');
  const removeCategory = (category) => {
    const inUse = products.filter((product) => product.category === category).length;
    if (inUse > 0) { window.alert(`${inUse} product${inUse === 1 ? '' : 's'} still use "${category}". Move them to another category first.`); return; }
    saveCategories(categories.filter((item) => item !== category));
  };
  const query = search.trim().toLowerCase();
  const filteredProducts = query ? products.filter((p) => p.name.toLowerCase().includes(query) || p.sku?.toLowerCase().includes(query) || p.category.toLowerCase().includes(query)) : products;
  const exportCsv = () => {
    const rows = [['Name', 'SKU', 'Category', 'Price', 'Stock', 'In Stock', 'Best Seller']];
    for (const p of products) rows.push([p.name, p.sku, p.category, p.price, p.stockQty ?? '', (inventory[p.id] ?? p.inStock) ? 'Yes' : 'No', p.bestSeller ? 'Yes' : 'No']);
    downloadCsv(`products-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };
  return <section><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6"><div><h2 className={`text-lg font-semibold ${theme.fontHeading}`}>Product catalog</h2><p className="text-[color:var(--adm-muted)] mt-2">Create categories, then upload product photos and videos.</p></div><div className="flex gap-3"><button onClick={exportCsv} className="inline-flex items-center justify-center gap-2 px-4 py-3 border border-[color:var(--adm-line)] text-sm font-semibold hover:bg-current/10"><Download size={15} /> Export CSV</button><button onClick={() => setEditingProduct({ ...emptyProduct, category: categories[0] || 'Dresses' })} className="inline-flex items-center justify-center gap-2 px-5 py-3 text-white text-sm font-semibold" style={{ backgroundColor: theme.accentColor }}><Package size={15} /> Add product</button></div></div><div className="mb-8 adm-card p-5"><div className="flex items-center justify-between gap-4 mb-4"><div><h3 className="font-bold">Shop categories</h3><p className="text-sm opacity-60 mt-1">These categories appear in the customer Shop filters.</p></div></div><div className="flex flex-wrap gap-2 mb-4">{categories.map((category) => <span key={category} className="inline-flex items-center gap-2 border border-[color:var(--adm-line)] px-3 py-2 text-xs font-medium">{category}<button type="button" onClick={() => removeCategory(category)} className="opacity-50 hover:opacity-100" aria-label={`Remove ${category} category`}>×</button></span>)}</div><form onSubmit={(event) => { event.preventDefault(); saveCategories([...categories, newCategory]); setNewCategory(''); }} className="flex max-w-md gap-2"><input required value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category" className="min-w-0 flex-1 border border-[color:var(--adm-line)] bg-transparent px-3 py-2 text-sm outline-none" /><button className="px-4 py-2 text-white text-sm font-semibold" style={{ backgroundColor: theme.accentColor }}>Add</button></form></div>{editingProduct && <ProductEditor key={editingProduct.id ?? "new"} product={editingProduct} categories={categories} setProduct={setEditingProduct} saveProduct={saveProduct} theme={theme} />}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products by name, SKU, or category" className="w-full max-w-sm px-3 py-2 mb-4 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none text-sm" /><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filteredProducts.map((product) => { const available = inventory[product.id] ?? product.inStock; return <div key={product.id} className="adm-card p-4 flex gap-4 items-center"><img src={product.image} alt="" className="w-16 h-20 object-cover" /><div className="flex-grow min-w-0"><p className="text-xs text-[color:var(--adm-muted)]">{product.category} · {formatCurrency(product.price)}</p><h3 className="font-bold mt-1 truncate">{product.name}</h3><p className="text-sm opacity-60">{available ? 'Available' : 'Hidden from sale'}{Number.isFinite(product.stockQty) ? ` · ${product.stockQty} in stock` : ''}{(product.videos?.length || (product.video ? 1 : 0)) ? ` · ${product.videos?.length || 1} video${(product.videos?.length || 1) === 1 ? '' : 's'}` : ''}</p></div><div className="flex items-center gap-2"><button onClick={() => setEditingProduct({ ...product, videos: product.videos ?? (product.video ? [product.video] : []) })} className="p-2 border border-[color:var(--adm-line)] hover:bg-current/10" aria-label={`Edit ${product.name}`}><Pencil size={15} /></button><button onClick={() => deleteProduct(product.id)} className="p-2 border border-[color:var(--adm-line)] hover:bg-red-50 hover:text-red-600 hover:border-red-200" aria-label={`Delete ${product.name}`}><Trash2 size={15} /></button><button role="switch" aria-checked={available} onClick={() => updateInventory(product.id, !available)} className={`w-12 h-7 p-1 rounded-full transition-colors ${available ? 'bg-emerald-500' : 'bg-gray-300'}`}><span className={`block w-5 h-5 bg-white rounded-full transition-transform ${available ? 'translate-x-5' : ''}`} /></button></div></div>; })}</div></section>;
}

function ProductEditor({ product, categories, setProduct, saveProduct, theme }) {
  const [mediaError, setMediaError] = useState('');
  const update = (key, value) => setProduct({ ...product, [key]: value });
  const useSizeStock = !!product.sizeStock;
  const toggleSizeStock = (enabled) => setProduct({ ...product, sizeStock: enabled ? Object.fromEntries((product.sizes || []).map((s) => [s, Number(product.sizeStock?.[s]) || 0])) : undefined });
  const updateSizeStock = (size, value) => setProduct({ ...product, sizeStock: { ...product.sizeStock, [size]: value } });
  const [uploading, setUploading] = useState('');
  const upload = async (event, key) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading('Uploading cover photo…');
    try { update(key, await uploadMedia(file)); setMediaError(''); } catch (error) { setMediaError(error.message); }
    setUploading('');
  };
  // Uploads each chosen file in turn and appends it to the list (gallery or videos).
  const uploadMany = async (event, key, noun) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (!files.length) return;
    setMediaError('');
    const failed = [];
    for (const [index, file] of files.entries()) {
      setUploading(`Uploading ${noun} ${index + 1} of ${files.length}…`);
      try {
        const url = await uploadMedia(file);
        setProduct((current) => ({ ...current, [key]: [...(current[key] || []), url] }));
      } catch {
        failed.push(file.name);
      }
    }
    setUploading('');
    if (failed.length) setMediaError(`Couldn't upload ${failed.join(', ')}. Photos must be JPEG, PNG, WebP or GIF; videos must be MP4, WebM or MOV.`);
  };
  const removeMedia = (key, index) => setProduct((current) => ({ ...current, [key]: (current[key] || []).filter((_, i) => i !== index) }));
  const moveMedia = (key, index) => setProduct((current) => {
    const list = [...(current[key] || [])];
    [list[index - 1], list[index]] = [list[index], list[index - 1]];
    return { ...current, [key]: list };
  });
  return <form onSubmit={(event) => { event.preventDefault(); saveProduct({ ...product, video: (product.videos || [])[0] || '', price: Number(product.price), stockQty: product.stockQty === '' || product.stockQty == null ? undefined : Number(product.stockQty), sizeStock: product.sizeStock ? Object.fromEntries(Object.entries(product.sizeStock).map(([s, v]) => [s, Number(v) || 0])) : undefined }); }} className="adm-card p-6 md:p-8 mb-8 space-y-6"><div className="flex items-center justify-between"><h3 className={`text-base font-semibold ${theme.fontHeading}`}>{product.id ? 'Edit product' : 'Add product'}</h3><button type="button" onClick={() => setProduct(null)} className="text-xs opacity-60">Cancel</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Product name" value={product.name} onChange={(value) => update('name', value)} required /><Field label="Inspired by / movie" value={product.movie} onChange={(value) => update('movie', value)} /><Field label="Price" type="number" value={product.price} onChange={(value) => update('price', value)} required /><Field label="SKU" value={product.sku} onChange={(value) => update('sku', value)} /><Field label="HSN code (printed on GST invoices)" value={product.hsn || ''} onChange={(value) => update('hsn', value.replace(/\D/g, '').slice(0, 8))} /><Field label="Category" value={product.category} onChange={(value) => update('category', value)} options={categories} /><ListField label="Sizes (comma separated)" value={product.sizes} onChange={(list) => update('sizes', list)} /><ListField label="Colours (comma separated, used by the shop's colour filter)" value={product.colors} onChange={(list) => update('colors', list)} />{!useSizeStock && <Field label="Stock quantity (optional)" type="number" value={product.stockQty ?? ''} onChange={(value) => update('stockQty', value)} />}<label className="flex items-center gap-3 pt-6"><input type="checkbox" checked={!!product.bestSeller} onChange={(event) => update('bestSeller', event.target.checked)} className="w-4 h-4" /><span className="text-sm font-medium text-[color:var(--adm-muted)]">Best seller badge</span></label></div><div className="border-t border-[color:var(--adm-line)] pt-4"><label className="flex items-center gap-3 mb-4"><input type="checkbox" checked={useSizeStock} onChange={(event) => toggleSizeStock(event.target.checked)} className="w-4 h-4" /><span className="text-sm font-medium text-[color:var(--adm-muted)]">Track stock per size</span></label>{useSizeStock && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{(product.sizes || []).map((size) => <label key={size} className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-1">{size}</span><input type="number" min="0" value={product.sizeStock?.[size] ?? 0} onChange={(event) => updateSizeStock(size, event.target.value)} className="w-full px-3 py-2 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none" /></label>)}</div>}</div><div><label className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Description</label><textarea required rows="4" value={product.description} onChange={(event) => update('description', event.target.value)} className="w-full bg-transparent border border-[color:var(--adm-line)] px-4 py-3 outline-none resize-y" /></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><MediaUpload label="Cover photo" icon={ImagePlus} value={product.image} accept="image/*" onChange={(event) => upload(event, 'image')} /></div><MediaList label="Extra photos" hint="shown after the cover photo" kind="photo" items={product.gallery || []} onAdd={(event) => uploadMany(event, 'gallery', 'photo')} onRemove={(index) => removeMedia('gallery', index)} onMove={(index) => moveMedia('gallery', index)} /><MediaList label="Videos" kind="video" items={product.videos || []} onAdd={(event) => uploadMany(event, 'videos', 'video')} onRemove={(index) => removeMedia('videos', index)} onMove={(index) => moveMedia('videos', index)} />{uploading && <p className="text-sm font-medium text-[color:var(--adm-peacock)]" role="status">{uploading} Keep this page open until it finishes.</p>}{mediaError && <p className="text-sm text-red-600" role="alert">{mediaError}</p>}<button type="submit" disabled={!!uploading} className="inline-flex items-center gap-2 px-6 py-3 text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: theme.accentColor }}><Save size={15} /> {uploading ? 'Uploading…' : 'Save product'}</button></form>;
}

// Comma-separated list input. Keeps the text exactly as typed (so "S, " can be
// followed by "M") and reports the parsed list on every change.
function ListField({ label, value = [], onChange }) {
  const [text, setText] = useState(() => (value || []).join(', '));
  return <Field label={label} value={text} onChange={(next) => { setText(next); onChange(next.split(',').map((item) => item.trim()).filter(Boolean)); }} />;
}

function Field({ label, value, onChange, type = 'text', required = false, options }) {
  return <label className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">{label}</span>{options ? <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent border border-[color:var(--adm-line)] px-4 py-3 outline-none">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent border border-[color:var(--adm-line)] px-4 py-3 outline-none" />}</label>;
}

function MediaUpload({ label, icon: Icon, value, accept, onChange }) {
  return <label className="border border-dashed border-[color:var(--adm-line)] p-4 min-h-32 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-current/5"><Icon size={22} className="text-[color:var(--adm-muted)] mb-2" /><span className="text-sm font-semibold">{value ? 'Replace' : 'Upload'} {label}</span>{value && <span className="text-[10px] opacity-50 mt-2">Media ready</span>}<input type="file" accept={accept} onChange={onChange} className="sr-only" /></label>;
}

function AdminLogin({ theme, login, error, setError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try { await login(email, password); } catch (loginError) { setError(loginError.message); } finally { setSubmitting(false); }
  };

  return <div className="admin-app min-h-screen flex flex-col"><Seo path="/admin" title="Admin Login" noindex /><header className="text-white bg-[color:var(--adm-peacock)]"><div className="h-14 md:h-16 px-4 md:px-7 flex items-center font-tradition text-[21px] md:text-2xl">{SITE_CONFIG.name}</div><TempleBorder /></header><main className="flex-1 flex flex-col items-center justify-center px-4 py-16 w-full"><div className="adm-card w-full max-w-sm p-7 md:p-8"><h1 className={`text-xl font-semibold tracking-tight ${theme.fontHeading}`}>Sign in to the store admin</h1><p className="text-sm text-[color:var(--adm-muted)] mt-2 mb-7">Orders, products, customers and settings.</p><form onSubmit={submit} className="space-y-5"><label className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" className="w-full bg-transparent border border-[color:var(--adm-line)] px-4 py-3 outline-none" /></label><label className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">Password</span><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="w-full bg-transparent border border-[color:var(--adm-line)] px-4 py-3 outline-none" /></label>{error && <p className="text-sm text-red-600" role="alert">{error}</p>}<button disabled={submitting} className="w-full py-3 text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: theme.accentColor }}>{submitting ? 'Signing in…' : 'Sign in'}</button></form></div><Link to="/" className="mt-6 text-sm text-[color:var(--adm-muted)] hover:text-[color:var(--adm-ink)] underline underline-offset-4">Back to the store</Link></main></div>;
}

function MyAccount({ admin, theme, forced = false, onChanged }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [status, setStatus] = useState({ error: '', saved: false });
  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) { setStatus({ error: 'The two new passwords do not match.', saved: false }); return; }
    const response = await fetch('/api/admin/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) }).catch(() => null);
    if (response?.ok) { setForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); setStatus({ error: '', saved: true }); onChanged?.(); return; }
    const body = response ? await response.json().catch(() => ({})) : {};
    setStatus({ error: body.error || 'Password could not be changed.', saved: false });
  };
  const input = (key, label, autoComplete) => <label className="block"><span className="block text-sm font-medium text-[color:var(--adm-muted)] mb-2">{label}</span><input required type="password" minLength={key === 'currentPassword' ? undefined : 12} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} autoComplete={autoComplete} className="w-full px-4 py-3 bg-transparent border border-[color:var(--adm-line)] focus:border-current outline-none" /></label>;
  return <section className="max-w-2xl adm-card p-6 md:p-8"><h2 className={`text-lg font-semibold mb-2 ${theme.fontHeading}`}>{forced ? 'Choose a new password' : 'My account'}</h2><p className="text-[color:var(--adm-muted)] mb-8">{forced ? <>You signed in as <strong>{admin.email}</strong> with a temporary password. Choose a new one to open the admin.</> : <>Signed in as <strong>{admin.email}</strong> ({admin.role}).</>}</p>
    <form onSubmit={submit} className="space-y-5">{input('currentPassword', forced ? 'Temporary password' : 'Current password', 'current-password')}{input('newPassword', 'New password (min. 12 characters)', 'new-password')}{input('confirmPassword', 'Confirm new password', 'new-password')}
      {status.error && <p className="text-sm text-red-600" role="alert">{status.error}</p>}
      {status.saved && <p className="text-sm text-emerald-700" role="status">Password updated.</p>}
      <button type="submit" className="inline-flex items-center gap-2 px-6 py-3 text-white text-sm font-semibold" style={{ backgroundColor: theme.accentColor }}><KeyRound size={15} /> Change password</button>
    </form></section>;
}

async function uploadMedia(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/admin/media', { method: 'POST', credentials: 'include', body: formData });
  // Never fall back to embedding the file in the product record: that bloats
  // the catalog every shopper downloads. Callers show the error instead.
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'This file could not be uploaded.');
  }
  return (await response.json()).url;
}

function MediaList({ label, hint, kind, items, onAdd, onRemove, onMove }) {
  const noun = kind === 'video' ? 'video' : 'photo';
  return <div>
    <p className="text-sm font-medium text-[color:var(--adm-muted)] mb-2">{label} <span className="font-normal">({items.length}{hint ? `, ${hint}` : ''})</span></p>
    <div className="flex flex-wrap gap-3">
      {items.map((src, index) => <div key={`${src}-${index}`} className="w-28">
        {kind === 'video'
          ? <video src={`${src}#t=0.1`} muted playsInline preload="metadata" aria-label={`Video ${index + 1}`} className="w-28 h-32 object-cover rounded-lg border border-[color:var(--adm-line)] bg-black" />
          : <img src={src} alt={`Extra photo ${index + 1}`} className="w-28 h-32 object-cover rounded-lg border border-[color:var(--adm-line)]" />}
        <div className="mt-1 flex justify-between text-xs">
          {index > 0 ? <button type="button" onClick={() => onMove(index)} className="font-medium text-[color:var(--adm-peacock)]" aria-label={`Move ${noun} ${index + 1} earlier`}>Move earlier</button> : <span />}
          <button type="button" onClick={() => onRemove(index)} className="font-medium text-[color:var(--adm-arakku)]" aria-label={`Remove ${noun} ${index + 1}`}>Remove</button>
        </div>
      </div>)}
      <label className="w-28 h-32 rounded-lg border border-dashed border-[#C9CFCB] flex flex-col items-center justify-center gap-1 text-xs font-medium text-center text-[color:var(--adm-muted)] cursor-pointer hover:border-[color:var(--adm-peacock)] hover:text-[color:var(--adm-peacock)]">
        {kind === 'video' ? <Video size={20} /> : <ImagePlus size={20} />}Add {noun}s
        <input type="file" multiple accept={kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp,image/gif'} onChange={onAdd} className="sr-only" />
      </label>
    </div>
  </div>;
}
