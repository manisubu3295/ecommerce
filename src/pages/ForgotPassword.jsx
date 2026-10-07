import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, MessageCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCatalog } from '../context/CatalogContext.jsx';
import { SITE_CONFIG } from '../data/siteConfig.js';
import { whatsAppLink } from '../lib/whatsapp.js';
import Seo from '../components/Seo.jsx';

// No automatic email reset (the shop doesn't send email yet): the shopper
// contacts the shop, which sets a temporary password from the admin.
export default function ForgotPassword() {
  const { theme } = useTheme();
  const { settings } = useCatalog();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const message = `Hi ${SITE_CONFIG.name}, I forgot the password for my account${email.trim() ? ` (${email.trim()})` : ''}. Please send me a temporary password.`;
  const whatsapp = whatsAppLink(settings?.whatsapp, message);
  const supportEmail = settings?.supportEmail || SITE_CONFIG.email;

  return <>
    <Seo path="/forgot-password" title="Forgot Password" noindex />
    <main className="max-w-md mx-auto px-4 py-24 w-full">
      <div className="border border-current/10 p-8 md:p-10">
        <p className="text-xs uppercase tracking-[0.25em] opacity-50 mb-3">Your account</p>
        <h1 className={`text-3xl font-bold tracking-tight ${theme.fontHeading}`}>Forgot your password?</h1>
        <p className="opacity-70 mt-3">Tell us the email you signed up with and we’ll send you a temporary password. You’ll choose a new one as soon as you sign in.</p>
        <label className="block mt-8"><span className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Your account email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full bg-transparent border border-current/20 px-4 py-3 outline-none focus:border-current" /></label>
        <div className="mt-6 space-y-3">
          {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center gap-2 py-4 text-white text-xs font-bold uppercase tracking-widest" style={{ backgroundColor: '#128C7E' }}><MessageCircle size={16} /> Message us on WhatsApp</a>}
          <a href={`mailto:${supportEmail}?subject=${encodeURIComponent('Forgot my password')}&body=${encodeURIComponent(message)}`} className="w-full inline-flex items-center justify-center gap-2 py-4 border border-current text-xs font-bold uppercase tracking-widest"><Mail size={16} /> Email {supportEmail}</a>
        </div>
        <p className="text-sm opacity-60 mt-6">To protect your account we may ask you to confirm your mobile number or a recent order number. Temporary passwords work for 24 hours.</p>
        <p className="text-sm opacity-60 mt-6">Remembered it? <Link to={{ pathname: '/login', search: location.search }} state={location.state} className="underline underline-offset-4 font-semibold">Sign in</Link> · Just want to check an order? <Link to="/track-order" className="underline underline-offset-4 font-semibold">Track it here</Link></p>
      </div>
    </main>
  </>;
}
