import { useEffect, useState } from 'react';
import { useConflictsLoaded } from '../data/conflicts.ts';
import { useT } from '../i18n/index.ts';

/**
 * A brief veil over the first paint.
 *
 * The opening frame has real work to do — parse the conflict records, decode a
 * TopoJSON snapshot, build the meshes — and without this the map appears as an
 * empty ocean for a beat, which reads as broken rather than busy. It fades once
 * the data is in and removes itself from the tree afterwards.
 */
export function Loading(): React.JSX.Element | null {
  const loaded = useConflictsLoaded();
  const t = useT();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => setGone(true), 620);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  if (gone) return null;

  return (
    <div className={`loading${loaded ? ' is-done' : ''}`} aria-hidden={loaded}>
      <div className="loading__mark">
        <span className="loading__ring" />
        <span className="loading__ring loading__ring--2" />
        <span className="loading__ring loading__ring--3" />
      </div>
      <p className="loading__text">{t.app.loading}</p>
    </div>
  );
}
