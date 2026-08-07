import { defineConfig } from 'vite';

// Relative base so the built site works unchanged on Cloudflare Pages, Netlify,
// and GitHub Pages project sites (which serve from /<repo>/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // three.js is the whole app here; a single ~170 KB gzip chunk is expected
    // and there is no meaningful first-paint path without it.
    chunkSizeWarningLimit: 1200,
  },
});
