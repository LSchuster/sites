import { FONT, INK, MAGNITUDE, MAP, PANEL, SIDE } from './theme.ts';

/**
 * Push the theme.ts palette into CSS custom properties, once, at startup.
 *
 * This is the bridge that keeps canvas and DOM on one palette: styles.css
 * carries static fallbacks for the instant before this module runs, but the
 * values that actually style the chrome come from here. Reading CSS variables
 * per frame from canvas code remains forbidden (rule 4 territory) — this is a
 * single write in the other direction.
 */
export function injectThemeVars(): void {
  const tokens: Record<string, string> = {
    '--ocean': MAP.oceanInner,
    '--ocean-deep': MAP.page,
    '--surface': PANEL.surface,
    '--surface-raised': PANEL.raised,
    '--hairline': PANEL.hairline,
    '--hairline-strong': PANEL.hairlineStrong,
    '--ink': INK.primary,
    '--ink-secondary': INK.secondary,
    '--ink-muted': INK.muted,
    '--ink-faint': INK.faint,
    '--accent': MAGNITUDE[2],
    '--accent-bright': MAGNITUDE[4],
    '--side-a': SIDE.a,
    '--side-b': SIDE.b,
    '--font-sans': FONT.sans,
    '--font-display': FONT.display,
  };
  const root = document.documentElement.style;
  for (const [name, value] of Object.entries(tokens)) root.setProperty(name, value);
}
