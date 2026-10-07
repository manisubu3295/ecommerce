import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useTheme } from './context/ThemeContext.jsx';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import CheckoutModal from './components/CheckoutModal.jsx';
import ThemeAdminPanel from './components/ThemeAdminPanel.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import WhatsAppButton from './components/WhatsAppButton.jsx';
import LaunchingSoon from './components/LaunchingSoon.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import About from './pages/About.jsx';
import FAQ from './pages/FAQ.jsx';
import Contact from './pages/Contact.jsx';
import OrderSuccess from './pages/OrderSuccess.jsx';
import NotFound from './pages/NotFound.jsx';
import TrackOrder from './pages/TrackOrder.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Blog from './pages/Blog.jsx';
import BlogPost from './pages/BlogPost.jsx';
import ShippingIndex from './pages/ShippingIndex.jsx';
import LocationPage from './pages/LocationPage.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Policy from './pages/Policy.jsx';
import Signup from './pages/Signup.jsx';
import Account from './pages/Account.jsx';
import { useCatalog } from './context/CatalogContext.jsx';

// The admin is only downloaded when someone opens /admin, so shoppers never
// load its code.
const Admin = lazy(() => import('./pages/Admin.jsx'));
const adminLoading = <div className="min-h-screen flex items-center justify-center text-sm opacity-60">Loading the admin…</div>;

export default function App() {
  const { theme } = useTheme();
  const { settings } = useCatalog();
  const announcement = settings.announcement || 'Free global shipping on archival pieces.';
  const { pathname } = useLocation();

  // The admin is its own full-screen workspace, without the storefront's
  // announcement bar, nav, footer, or cart.
  if (pathname.startsWith('/admin')) {
    return <><ScrollToTop /><Suspense fallback={adminLoading}><Admin /></Suspense></>;
  }

  return (
    <div className="min-h-screen font-sans transition-colors duration-700 ease-in-out flex flex-col">
      <ScrollToTop />
      <div
        className="w-full text-center py-2 text-xs tracking-widest uppercase font-medium text-white transition-colors duration-700"
        style={{ backgroundColor: theme.accentColor }}
      >
        {announcement}
      </div>

      <Nav />

      <div className="flex-grow flex flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/admin" element={<Suspense fallback={adminLoading}><Admin /></Suspense>} />
          <Route path="/track-order" element={<TrackOrder />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/shipping" element={<ShippingIndex />} />
          <Route path="/shipping/:citySlug" element={<LocationPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/policies/:slug" element={<Policy />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/account" element={<Account />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>

      <Footer />

      <LaunchingSoon color={theme.accentColor} />
      <WhatsAppButton />
      <CartDrawer />
      <CheckoutModal />
      <ThemeAdminPanel />
    </div>
  );
}
