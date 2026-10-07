// `npm run build`: always a production build.
// .env sets NODE_ENV=development for the local API server, and Vite would use
// that for the build too — producing React's development build (about 75%
// bigger and slower). Setting it here, before Vite starts, takes precedence
// over .env and works the same on Windows, macOS and Linux.
process.env.NODE_ENV = 'production';

// Likewise .env's VITE_SITE_URL is usually http://localhost:5173 for local
// work; a production bundle must carry the live domain in its canonical URLs
// and JSON-LD. Pass VITE_SITE_URL in the shell to build for staging instead.
process.env.VITE_SITE_URL ||= 'https://baraniscouture.com';

const { build } = await import('vite');
await build();
