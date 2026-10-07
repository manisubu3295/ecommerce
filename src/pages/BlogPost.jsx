import React, { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import Seo from '../components/Seo.jsx';
import { breadcrumbJsonLd, articleJsonLd } from '../lib/jsonld.js';

export default function BlogPost() {
  const { slug } = useParams();
  const { theme } = useTheme();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | found | notfound

  useEffect(() => {
    setStatus('loading');
    fetch(`/api/blog/${slug}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data) { setPost(data); setStatus('found'); } else setStatus('notfound');
      })
      .catch(() => setStatus('notfound'));
  }, [slug]);

  if (status === 'notfound') return <Navigate to="/404" replace />;
  if (status === 'loading' || !post) return <main className="max-w-3xl mx-auto px-4 py-32 text-center"><p className="text-xs uppercase tracking-widest opacity-50">Loading...</p></main>;

  const paragraphs = post.content.split(/\n\s*\n/).filter(Boolean);

  return (
    <>
      <Seo
        path={`/blog/${post.slug}`}
        title={post.seo_title || post.title}
        description={post.seo_description || post.excerpt}
        image={post.cover_image}
        jsonLd={[
          breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Journal', path: '/blog' }, { name: post.title, path: `/blog/${post.slug}` }]),
          articleJsonLd(post),
        ]}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-50 mb-10">
          <Link to="/" className="hover:opacity-100">Home</Link>
          <ChevronRight size={12} />
          <Link to="/blog" className="hover:opacity-100">Journal</Link>
        </nav>

        <p className="text-xs uppercase tracking-widest opacity-50 mb-4">
          {post.published_at ? new Date(post.published_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
        </p>
        <h1 className={`text-4xl md:text-5xl font-bold mb-10 tracking-tight ${theme.fontHeading}`}>{post.title}</h1>

        {post.cover_image && (
          <div className="aspect-[16/9] overflow-hidden bg-gray-100 mb-10">
            <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="space-y-6 text-lg leading-relaxed opacity-80">
          {paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
        </div>

        <div className="mt-16 pt-8 border-t border-current/10">
          <Link to="/blog" className="text-sm font-bold tracking-widest uppercase underline underline-offset-4">Back to Journal</Link>
        </div>
      </main>
    </>
  );
}
