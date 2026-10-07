import React from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';

export default function NotFound() {
  return (
    <>
      <Seo path="/404" title="Page Not Found" noindex />
      <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-32 w-full text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <p className="opacity-60 mb-10">This page has left the archive. It may have been moved or never existed.</p>
        <Link to="/" className="underline underline-offset-4 font-bold uppercase text-sm tracking-widest">
          Back to Home
        </Link>
      </main>
    </>
  );
}
