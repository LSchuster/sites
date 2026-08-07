/**
 * Theme switching: 'system' follows prefers-color-scheme (no attribute),
 * an explicit choice sets data-theme="light|dark" on <html> and is stored
 * locally. Applied in main.tsx before React renders.
 *
 * The invoice preview sheet deliberately ignores the theme — it represents
 * paper and keeps fixed light tokens (see .sheet in styles.css).
 */
export type Theme = 'system' | 'light' | 'dark';

const KEY = 'invoice.theme';

export function storedTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(theme: Theme): void {
  const el = document.documentElement;
  if (theme === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // storage unavailable — theme still applies for this visit
  }
  apply(theme);
}

export function initTheme(): void {
  apply(storedTheme());
}
