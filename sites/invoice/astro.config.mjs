// @ts-check
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

// Astro renders the static shell (landing, SEO content, legal-adjacent copy);
// the React generator app mounts client-side into #root via src/main.tsx.
export default defineConfig({
  site: 'https://invoice.teespoon.io',
  integrations: [react()],
  vite: {
    build: {
      target: 'es2022',
      // The PDF generator (@cantoo/pdf-lib + fonts) is a lazy ~1.5 MB chunk
      // loaded on the first download click; it is large by nature and never
      // on the first-paint path. The landing/app chunks stay far below this.
      chunkSizeWarningLimit: 1600,
      // CSP in public/_headers is script-src 'self' — bundled scripts must be
      // emitted as external files, never inlined into the HTML.
      assetsInlineLimit: 0,
    },
  },
});
