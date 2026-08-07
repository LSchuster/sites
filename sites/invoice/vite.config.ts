import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built site works unchanged on Cloudflare Pages, Netlify,
// and GitHub Pages project sites (which serve from /<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    // The PDF generator (@cantoo/pdf-lib + fonts) is a lazy chunk loaded on the
    // first download click; it is large by nature and never on the first-paint
    // path. The landing/app chunk should stay far below this.
    chunkSizeWarningLimit: 1000,
  },
});
