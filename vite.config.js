import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds go through scripts/build.mjs (npm run build), which sets
// NODE_ENV=production before Vite reads .env.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/media': 'http://localhost:8787',
      '/sitemap.xml': 'http://localhost:8787',
    },
  },
});
