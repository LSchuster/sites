// Small formatting helpers for the HUD.

export function formatKm(km: number): string {
  if (km >= 100) return `${Math.round(km).toLocaleString('en-US')} km`;
  return `${km.toFixed(1)} km`;
}

export function formatMs(ms: number): string {
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`;
  if (ms < 120_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

/** ISO 3166-1 alpha-2 → regional-indicator flag emoji. */
export function flagEmoji(cc: string): string {
  const code = cc.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Animate a numeric readout from 0 to its target. */
export function countUp(el: HTMLElement, target: number, format: (v: number) => string, duration = 1100): void {
  const start = performance.now();
  const tick = (now: number): void => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(target * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
