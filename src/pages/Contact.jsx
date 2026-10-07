import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { SITE_CONFIG } from '../data/siteConfig.js';
import Seo from '../components/Seo.jsx';
import { breadcrumbJsonLd } from '../lib/jsonld.js';
import { useCatalog } from '../context/CatalogContext.jsx';

export default function Contact() {
  const { theme } = useTheme();
  // The admin can change this under Store settings; fall back to the built-in address.
  const supportEmail = useCatalog().settings?.supportEmail || SITE_CONFIG.email;
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      let result = {};
      try { result = await response.json(); } catch { result = {}; }
      if (!response.ok) throw new Error(result.error || 'Your message could not be sent. Please try again.');
      setSent(true);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Seo
        path="/contact"
        title="Contact Us"
        description={`Get in touch with ${SITE_CONFIG.name} for order support, sizing help, or press inquiries.`}
        jsonLd={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }])}
      />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <h1 className={`text-5xl font-bold mb-4 tracking-tight ${theme.fontHeading}`}>Contact Us</h1>
        <p className="opacity-60 mb-10 flex items-center gap-2">
          <Mail size={16} /> <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">{supportEmail}</a>
        </p>

        {sent ? (
          <p className="text-lg">Thanks — we've received your message and will reply within 1-2 business days.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-2" htmlFor="name">Name</label>
              <input id="name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-2" htmlFor="email">Email</label>
              <input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest opacity-60 mb-2" htmlFor="message">Message</label>
              <textarea id="message" required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="px-10 py-4 text-white font-bold tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: theme.accentColor }}
            >
              {submitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
