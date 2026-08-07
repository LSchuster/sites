/**
 * The single source for the user's motion preference.
 *
 * CSS already honours prefers-reduced-motion for DOM transitions; this is the
 * canvas side's read of the same signal. Consumers: the border crossfade
 * collapses to a hard cut, conflict-mark and label fades become instant, and
 * the relief plate appears without its stepped entrance.
 */
let reduced = false;

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduced = mq.matches;
  mq.addEventListener?.('change', (e) => {
    reduced = e.matches;
  });
}

export function prefersReducedMotion(): boolean {
  return reduced;
}
