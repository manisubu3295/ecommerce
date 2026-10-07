import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { SITE_CONFIG } from '../data/siteConfig.js';
import { useCatalog } from '../context/CatalogContext.jsx';
import { policySettings } from '../lib/policies.js';
import Seo from '../components/Seo.jsx';
import { breadcrumbJsonLd, faqJsonLd } from '../lib/jsonld.js';

// Built from Store settings so answers match the policy pages exactly.
function buildFaqs(settings) {
  const policy = policySettings(settings);
  return [
  {
    question: "What regions does Barani's Couture ship to?",
    answer: `Barani's Couture currently ships to ${SITE_CONFIG.shipsTo.map((r) => r.name).join(', ')}. Orders outside these regions can be arranged by contacting support.`,
  },
  {
    question: 'How long does shipping take?',
    answer: 'Delivery time depends on your city — most Indian metros receive orders in 2-4 business days, other Indian cities in 3-6 days, and Singapore/Malaysia in 4-7 days. See the exact estimate for your city on our shipping page.',
  },
  {
    question: 'What is your return policy?',
    answer: policy.returnDays
      ? `Unused items with tags attached can be returned within ${policy.returnDays} days of delivery for a refund to your original payment method, minus the original shipping charge. Stitched or altered pieces can't be returned. Damaged or wrong items are always replaced or refunded in full. See Returns & Refunds for details.`
      : "All sales are final, but damaged or wrong items are always replaced or refunded in full. See Returns & Refunds for details.",
  },
  {
    question: 'Do you offer cash on delivery?',
    answer: 'No. We accept online payment only: UPI, debit and credit cards, net banking and wallets, processed securely by Razorpay. We never see your card number or UPI PIN.',
  },
  {
    question: 'Can I cancel my order?',
    answer: `Yes, any time before it's dispatched (usually within ${policy.dispatchDays} business days of payment), for a full refund. Contact us with your order number.`,
  },
  {
    question: 'How do I choose the right size?',
    answer: 'Western-style pieces list sizes XS-XL and run true-to-size. Sarees and half-sarees are Free Size, draped to fit — the product description notes any specific fit details.',
  },
  {
    question: 'Are the outfits official movie merchandise?',
    answer: "No. Barani's Couture designs are inspired by and referential to iconic film wardrobes, but are original reconstructions, not licensed merchandise.",
  },
  ];
}

export default function FAQ() {
  const { theme } = useTheme();
  const [openIndex, setOpenIndex] = useState(0);
  const FAQS = buildFaqs(useCatalog().settings);

  return (
    <>
      <Seo
        path="/faq"
        title="Frequently Asked Questions"
        description="Shipping regions, delivery times, returns, sizing and more — answers to the most common Barani's Couture questions."
        jsonLd={[
          breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'FAQ', path: '/faq' }]),
          faqJsonLd(FAQS),
        ]}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <h1 className={`text-5xl font-bold mb-12 tracking-tight ${theme.fontHeading}`}>FAQ</h1>
        <div className="divide-y divide-current/10">
          {FAQS.map((faq, i) => (
            <div key={faq.question} className="py-6">
              <button
                onClick={() => setOpenIndex(openIndex === i ? -1 : i)}
                className="w-full flex items-center justify-between text-left gap-4"
                aria-expanded={openIndex === i}
              >
                <span className={`text-lg font-medium ${theme.fontHeading}`}>{faq.question}</span>
                <ChevronDown size={20} className={`shrink-0 transition-transform ${openIndex === i ? 'rotate-180' : ''}`} />
              </button>
              {openIndex === i && <p className="opacity-70 mt-4 leading-relaxed">{faq.answer}</p>}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
