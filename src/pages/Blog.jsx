import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import Seo from '../components/Seo.jsx';
import { breadcrumbJsonLd } from '../lib/jsonld.js';

export default function Blog() {
  const { theme } = useTheme();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/blog')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (Array.isArray(data?.posts)) setPosts(data.posts); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Seo
        path="/blog"
        title="Journal"
        description="Notes on Kanjeevaram silk, 90s film wardrobes, drape guides, and the craft behind Barani's Couture's collections."
        jsonLd={[breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Journal', path: '/blog' }])]}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="mb-16">
          <h1 className={`text-4xl md:text-5xl font-bold mb-4 tracking-tight ${theme.fontHeading}`}>Journal</h1>
          <p className="opacity-60 text-lg font-light max-w-2xl">Notes on craft, drape, and the stories behind each collection.</p>
        </div>

        {loading ? (
          <p className="opacity-50 py-12">Loading...</p>
        ) : posts.length === 0 ? (
          <p className="opacity-60 py-24 text-center">No journal entries yet — check back soon.</p>
        ) : (
          <div className="space-y-16">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`} className="group grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-6 sm:gap-10">
                {post.cover_image ? (
                  <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                    <img src={post.cover_image} alt={post.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ) : <div className="aspect-[4/3] bg-gray-100" />}
                <div>
                  <p className="text-xs uppercase tracking-widest opacity-50 mb-3">
                    {post.published_at ? new Date(post.published_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                  </p>
                  <h2 className={`text-2xl md:text-3xl font-bold mb-3 tracking-tight group-hover:underline underline-offset-4 ${theme.fontHeading}`}>{post.title}</h2>
                  <p className="opacity-70 leading-relaxed">{post.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
