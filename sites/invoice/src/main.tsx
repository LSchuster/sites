/**
 * Client entry, loaded from src/pages/index.astro as a bundled external
 * script. Styles are imported by the Astro page (they must style the static
 * shell before React loads); the pre-paint theme attribute is applied by
 * public/theme-init.js in <head>.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing in index.astro');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
