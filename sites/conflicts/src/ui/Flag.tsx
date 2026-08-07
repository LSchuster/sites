import { useEffect, useState } from 'react';
import { flagCode, flagUrl, onFlagsLoaded } from '../data/flags.ts';

/**
 * The modern national flag of a polity, when one honestly applies.
 *
 * SVG rather than a regional-indicator emoji: Windows ships no flag glyphs, so
 * `🇩🇪` renders as a boxed "DE" in every browser on that platform. Files are copied
 * into public/data/flags/ at build time and fetched individually — a hover costs a
 * few kilobytes, and the browser caches it.
 */
export function Flag({
  name,
  size = 20,
  title,
}: {
  name: string | null;
  size?: number;
  /** Tooltip — used to say "this is the modern flag", per the About page. */
  title?: string;
}): React.JSX.Element | null {
  const [, force] = useState(0);

  // The index arrives asynchronously; re-render once it does.
  useEffect(() => onFlagsLoaded(() => force((n) => n + 1)), []);

  const code = flagCode(name);
  if (!code) return null;

  return (
    <img
      className="flag"
      src={flagUrl(code)}
      width={size}
      height={size * 0.75}
      alt=""
      title={title}
      loading="lazy"
      decoding="async"
    />
  );
}
