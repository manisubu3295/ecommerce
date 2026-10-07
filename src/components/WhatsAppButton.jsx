import React from 'react';
import { useLocation } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { SITE_CONFIG } from '../data/siteConfig.js';
import { whatsAppLink } from '../lib/whatsapp.js';

// Floating "chat on WhatsApp" button. Shown only once the store owner has
// entered a WhatsApp number in Store settings. On a product page the message
// is pre-filled with that product, so the shop knows what they're asking about.
export default function WhatsAppButton() {
  const { settings, products } = useCatalog();
  const { isCheckoutOpen, isCartOpen } = useCart();
  const { pathname } = useLocation();
  const slug = pathname.startsWith('/product/') ? decodeURIComponent(pathname.slice('/product/'.length)) : null;
  const product = slug ? products.find((p) => p.slug === slug) : null;
  const message = product
    ? `Hi ${SITE_CONFIG.name}, I have a question about "${product.name}": ${window.location.href}`
    : `Hi ${SITE_CONFIG.name}, I have a question.`;
  const href = whatsAppLink(settings?.whatsapp, message);
  if (!href || isCheckoutOpen || isCartOpen) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed z-40 bottom-5 right-5 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E]"
      style={{ backgroundColor: '#25D366' }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.29-.15-1.72-.85-1.99-.95-.27-.1-.46-.15-.66.15-.19.29-.76.95-.93 1.14-.17.2-.34.22-.63.07-.29-.15-1.23-.45-2.35-1.44-.87-.78-1.45-1.73-1.62-2.02-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.49-.66-.5h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44 0 1.44 1.05 2.83 1.2 3.02.15.2 2.06 3.15 5 4.42.7.3 1.24.48 1.67.61.7.22 1.34.19 1.84.12.56-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.27-.2-.56-.34zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 1 1 7.99 4.41zm8.02-17.45A11.33 11.33 0 0 0 12.05.72C5.8.72.71 5.8.71 12.05c0 2 .52 3.95 1.52 5.66L.62 23.28l5.7-1.5a11.32 11.32 0 0 0 5.72 1.46h.01c6.25 0 11.34-5.08 11.34-11.33 0-3.03-1.18-5.88-3.32-8.02z" />
      </svg>
    </a>
  );
}
