import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built site works unchanged on Cloudflare Pages, Netlify,
// and GitHub Pages project sites (which serve from /<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    // Data lives in public/ and is fetched at runtime, so the JS bundle stays small.
    // Warn early if the app itself starts bloating.
    chunkSizeWarningLimit: 400,
  },
});
