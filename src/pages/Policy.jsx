import React, { useEffect } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import { useCatalog } from '../context/CatalogContext.jsx';
import { SITE_CONFIG, formatCurrency } from '../data/siteConfig.js';
import { policySettings, shippingPromise } from '../lib/policies.js';
import Seo from '../components/Seo.jsx';
import { breadcrumbJsonLd } from '../lib/jsonld.js';

// Policy pages required for an Indian online store (Consumer Protection
// (E-Commerce) Rules, 2020; the DPDP Act, 2023) and checked by Razorpay before
// it enables live payments. Business details and policy numbers come from the
// admin's Store settings, so the pages always match how the shop operates.
// These are sensible starting drafts — have them reviewed by a lawyer.
const LAST_UPDATED = '26 September 2026';

export const POLICY_PAGES = [
  { slug: 'terms', title: 'Terms of Use' },
  { slug: 'privacy', title: 'Privacy Policy' },
  { slug: 'returns', title: 'Returns & Refunds' },
  { slug: 'shipping', title: 'Shipping Policy' },
];

const H2 = ({ id, children }) => <h2 id={id} className="text-2xl font-bold mt-12 mb-4 scroll-mt-24">{children}</h2>;
const P = ({ children }) => <p className="opacity-80 leading-relaxed mb-4">{children}</p>;
const UL = ({ items }) => <ul className="list-disc pl-6 space-y-2 opacity-80 leading-relaxed mb-4">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
const Missing = ({ children }) => <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-sm">[{children}]</span>;

export default function Policy() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const { theme } = useTheme();
  const { settings } = useCatalog();
  const page = POLICY_PAGES.find((p) => p.slug === slug);
  // Links like /policies/terms#grievance jump to that section.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash, slug]);
  if (!page) return <Navigate to="/404" replace />;

  const business = settings?.business || {};
  const policy = policySettings(settings);
  const pricing = settings?.pricing || {};
  const name = business.legalName || SITE_CONFIG.legalName;
  const email = business.email || settings?.supportEmail || SITE_CONFIG.email;
  const ctx = {
    name,
    email,
    phone: business.phone || <Missing>phone number</Missing>,
    address: business.address || <Missing>registered business address</Missing>,
    state: business.state,
    gstin: business.gstin,
    grievanceName: policy.grievanceName || <Missing>grievance officer’s name</Missing>,
    returnDays: policy.returnDays,
    dispatchDays: policy.dispatchDays,
    shipping: shippingPromise(pricing, formatCurrency),
    regions: SITE_CONFIG.shipsTo.map((r) => r.name).join(', '),
  };

  return <>
    <Seo path={`/policies/${slug}`} title={page.title} description={`${page.title} for ${name}.`} jsonLd={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: page.title, path: `/policies/${slug}` }])} />
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
      <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2 mb-10 text-sm">
        {POLICY_PAGES.map((p) => <Link key={p.slug} to={`/policies/${p.slug}`} aria-current={p.slug === slug ? 'page' : undefined} className={p.slug === slug ? 'font-bold underline underline-offset-4' : 'opacity-60 hover:opacity-100'}>{p.title}</Link>)}
      </nav>
      <h1 className={`text-4xl md:text-5xl font-bold tracking-tight ${theme.fontHeading}`}>{page.title}</h1>
      <p className="opacity-50 text-sm mt-3">Last updated {LAST_UPDATED}</p>
      <div className="mt-8">
        {slug === 'terms' && <Terms {...ctx} />}
        {slug === 'privacy' && <Privacy {...ctx} />}
        {slug === 'returns' && <Returns {...ctx} />}
        {slug === 'shipping' && <Shipping {...ctx} />}
      </div>
      <Grievance {...ctx} />
    </main>
  </>;
}

function Seller({ name, address, gstin, email, phone }) {
  return <P><strong>{name}</strong><br /><span className="whitespace-pre-line">{address}</span>{gstin && <><br />GSTIN: {gstin}</>}<br />Email: <a href={`mailto:${email}`} className="underline underline-offset-4">{email}</a><br />Phone: {phone}</P>;
}

// Required by the Consumer Protection (E-Commerce) Rules, 2020: a named
// grievance officer who acknowledges complaints within 48 hours and resolves
// them within one month.
function Grievance({ name, grievanceName, email, phone }) {
  return <section aria-labelledby="grievance" className="mt-16 pt-8 border-t border-current/10">
    <H2 id="grievance">Complaints and grievance officer</H2>
    <P>If something has gone wrong, write to our grievance officer. We acknowledge every complaint within 48 hours and resolve it within one month of receiving it.</P>
    <P><strong>{grievanceName}</strong>, Grievance Officer, {name}<br />Email: <a href={`mailto:${email}`} className="underline underline-offset-4">{email}</a><br />Phone: {phone}</P>
  </section>;
}

function Terms(ctx) {
  return <>
    <P>These terms apply when you browse or buy from {ctx.name} (“we”, “us”). By placing an order you agree to them. The seller of every product on this site is:</P>
    <Seller {...ctx} />
    <H2>Products and colours</H2>
    <P>We describe and photograph every piece as accurately as we can. Handwoven and handcrafted fabrics, silk in particular, have small variations in weave, zari and colour; these are part of the craft, not defects. Colours can also look slightly different on different screens.</P>
    <H2>Prices and payment</H2>
    <UL items={[
      'Prices are in Indian rupees (₹) and include GST unless the checkout shows it separately.',
      'We accept online payment only: UPI, debit and credit cards, net banking and wallets, processed securely by Razorpay. We never see or store your card number or UPI PIN.',
      'We do not offer cash on delivery.',
      'If a price is shown wrongly because of an error, we will tell you before dispatch and you can cancel for a full refund.',
    ]} />
    <H2>Orders and cancellation</H2>
    <UL items={[
      'Your order is confirmed once payment succeeds. You’ll see a confirmation page and can track it on the Track Order page.',
      'You can cancel for a full refund any time before we dispatch it. Contact us with your order number.',
      'If an item turns out to be unavailable after you pay, we will refund you in full to your original payment method.',
    ]} />
    <H2>Shipping, returns and refunds</H2>
    <P>See our <Link to="/policies/shipping" className="underline underline-offset-4">Shipping Policy</Link> and <Link to="/policies/returns" className="underline underline-offset-4">Returns &amp; Refunds</Link>.</P>
    <H2>Your account</H2>
    <P>Keep your password private. You’re responsible for orders placed from your account. Tell us straight away if you think someone else has used it.</P>
    <H2>Content and designs</H2>
    <P>The photos, text and designs on this site belong to {ctx.name} or are used with permission. Our pieces are original designs; references to films or eras describe their inspiration only and are not official merchandise.</P>
    <H2>Liability</H2>
    <P>Nothing in these terms limits your rights under Indian consumer law. Beyond that, our responsibility for any order is limited to the amount you paid for it.</P>
    <H2>Law and disputes</H2>
    <P>These terms are governed by the laws of India. Disputes are subject to the courts of {ctx.state || 'India'}, without affecting your right to approach a consumer commission.</P>
  </>;
}

function Privacy(ctx) {
  return <>
    <P>This policy explains what personal data {ctx.name} collects, why, and your rights under the Digital Personal Data Protection Act, 2023.</P>
    <H2>What we collect</H2>
    <UL items={[
      'Details you give us: name, email, mobile number and delivery address when you check out, create an account, write a review or contact us.',
      'Order details: what you bought, when, and how much you paid.',
      'Payment: handled entirely by Razorpay. We receive a payment reference, never your card number, CVV or UPI PIN.',
      'Your browser keeps your cart, wishlist and recently viewed items on your device so they’re there next time. These aren’t sent to us until you check out.',
    ]} />
    <H2>Why we use it</H2>
    <UL items={[
      'To process, deliver and support your orders, including invoices, returns and refunds.',
      'To let you track your order and manage your account.',
      'To reply when you contact us.',
      'To keep records that tax law requires.',
    ]} />
    <P>We don’t sell your data, and we only send marketing messages if you ask for them.</P>
    <H2>Who we share it with</H2>
    <UL items={[
      'Razorpay, to take your payment.',
      'Courier partners, who need your name, phone and address to deliver.',
      'Our hosting and email providers, which store and send data on our behalf.',
      'Authorities, only when the law requires it.',
    ]} />
    <H2>How long we keep it</H2>
    <P>Order and invoice records are kept for as long as Indian tax law requires (currently about six years). Account details are kept until you ask us to delete your account.</P>
    <H2>Your rights</H2>
    <P>You can ask to see, correct or delete your personal data, or withdraw consent, by emailing <a href={`mailto:${ctx.email}`} className="underline underline-offset-4">{ctx.email}</a>. Records we must keep by law (like invoices) can’t be deleted early, but we’ll stop using them for anything else.</P>
    <H2>Security</H2>
    <P>Passwords are stored encrypted, the site uses a secure connection, and access to customer data is limited to staff who need it for orders.</P>
  </>;
}

function Returns(ctx) {
  if (ctx.returnDays === 0) {
    return <>
      <P>All sales are final: we don’t accept returns for a change of mind. If your order arrives damaged, defective or wrong, we’ll make it right, as below.</P>
      <DamagedItems {...ctx} />
      <Refunds />
    </>;
  }
  return <>
    <P>If something isn’t right, you can return it within <strong>{ctx.returnDays} days of delivery</strong>.</P>
    <H2>What can be returned</H2>
    <UL items={[
      'Unused and unwashed, with all tags attached and in the original packaging.',
      'Sarees with the fall, pico and blouse piece uncut and unstitched.',
    ]} />
    <H2>What can’t be returned</H2>
    <UL items={[
      'Pieces stitched, altered or customised for you, including stitched blouses.',
      'Items marked “final sale”.',
      'Items that have been worn, washed or damaged after delivery.',
    ]} />
    <H2>How to return</H2>
    <UL items={[
      <>Go to <Link to="/track-order" className="underline underline-offset-4">Track Order</Link>, open the order and choose “Request a return”, or contact us.</>,
      'We’ll confirm and share the return address or arrange a pickup.',
      'Unless the item was damaged or wrong, the return shipping cost is yours, and the original shipping charge isn’t refunded.',
    ]} />
    <DamagedItems {...ctx} />
    <Refunds />
    <H2>Exchanges</H2>
    <P>We don’t exchange automatically. Return the item for a refund and place a new order, or message us and we’ll help.</P>
  </>;
}

function DamagedItems() {
  return <>
    <H2>Damaged, defective or wrong items</H2>
    <P>Tell us within 48 hours of delivery with photos (an unboxing video helps a lot). We’ll replace the item or refund you in full, including shipping, and cover the return cost.</P>
  </>;
}

function Refunds() {
  return <>
    <H2>Refunds</H2>
    <UL items={[
      'Once the return reaches us and passes a quick check, we refund to your original payment method, usually within 5–7 working days.',
      'Every refund comes with a credit note against your invoice.',
      'Cancelled orders (before dispatch) are refunded in full.',
    ]} />
  </>;
}

function Shipping(ctx) {
  return <>
    <P>We ship to {ctx.regions}.</P>
    <H2>When your order leaves us</H2>
    <P>We dispatch within {ctx.dispatchDays} business days of payment. Festive season and made-to-order pieces may take longer; the product page will say so.</P>
    <H2>Delivery times after dispatch</H2>
    <UL items={[
      'Indian metro cities: 2–4 business days.',
      'Rest of India: 3–6 business days.',
      'Singapore and Malaysia: 4–7 business days.',
    ]} />
    <P>These are estimates from our courier partners. Remote areas and public holidays can add a few days.</P>
    <H2>Shipping charges</H2>
    <P>{ctx.shipping}. The exact amount is shown at checkout before you pay.</P>
    <H2>Tracking</H2>
    <P>Once your order ships, the courier and tracking number appear on <Link to="/track-order" className="underline underline-offset-4">Track Order</Link> and in your account.</P>
    <H2>International orders</H2>
    <P>Customs duties or import taxes charged by the destination country are paid by the recipient.</P>
    <H2>Failed delivery</H2>
    <P>If a parcel comes back to us because the address was wrong or nobody was available after the courier’s attempts, we’ll contact you to reship (at the shipping cost) or refund the order minus shipping.</P>
  </>;
}
