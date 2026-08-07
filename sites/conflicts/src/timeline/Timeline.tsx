import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useAtlas,
  setState,
  getState,
  subscribe,
  clampYear,
  displayYear,
  YEAR_MAX,
  YEAR_MIN,
} from '../state/store.ts';
import { getSnapshotYears, prefetchAround } from '../data/borders.ts';
import { getConflicts, useConflictsLoaded } from '../data/conflicts.ts';
import { GED_START } from '../data/ged.ts';
import { areaPath, deathsPerYear } from './stream.ts';
import { useT } from '../i18n/index.ts';

const STREAM_W = 1400;
const STREAM_H = 46;

const TICKS = [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000];

/**
 * Playback speeds in years per second, labelled as a multiplier of the base.
 * Five steps, always doubling, centred on the 0.5× default (10 years/s) —
 * two slower for reading dense periods, two faster for crossing quiet ones.
 */
const SPEEDS = [
  { mult: 0.125, value: 2.5 },
  { mult: 0.25, value: 5 },
  { mult: 0.5, value: 10 },
  { mult: 1, value: 20 },
  { mult: 2, value: 40 },
];

const pctOf = (year: number) => ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;

export function Timeline(): React.JSX.Element {
  const t = useT();
  const playing = useAtlas((s) => s.playing);
  const speed = useAtlas((s) => s.speed);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Written imperatively on every store change — see the effect below.
  const yearRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<SVGRectElement>(null);
  const erasNavRef = useRef<HTMLElement>(null);
  // The paint loop reads era boundaries through a ref so a locale switch
  // (which re-renders the buttons) never needs to re-subscribe it.
  const erasRef = useRef(t.timeline.eras);
  erasRef.current = t.timeline.eras;

  const loaded = useConflictsLoaded();
  const streamPath = useMemo(
    () => (loaded ? areaPath(deathsPerYear(getConflicts()), STREAM_W, STREAM_H) : ''),
    [loaded],
  );

  /**
   * The scrubber updates itself without React.
   *
   * During playback the year changes every frame. Routing that through a React
   * re-render means reconciling the whole timeline — ticks, era buttons, the stream
   * SVG — sixty times a second, for what is really four attribute writes. This
   * subscribes to the store directly and pokes the DOM.
   */
  useEffect(() => {
    let frame = 0;
    let lastShown = -1;

    const paint = () => {
      frame = 0;
      const { year } = getState();
      const pct = pctOf(year);

      if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      if (handleRef.current) handleRef.current.style.left = `${pct}%`;
      if (clipRef.current) clipRef.current.setAttribute('width', String((pct / 100) * STREAM_W));

      const shown = displayYear(year);
      if (shown !== lastShown) {
        lastShown = shown;
        if (yearRef.current) yearRef.current.textContent = String(shown);
        // The slider's accessible value tracks the display year (it was once
        // frozen at its mount-time value).
        trackRef.current?.setAttribute('aria-valuenow', String(shown));
        // Highlight the era whose jump year is nearest — the era years are
        // destinations, not range starts (Gegenwart jumps to 2010, but 1990
        // already belongs to it).
        const eras = erasRef.current;
        let active = -1;
        let best = Infinity;
        for (let i = 0; i < eras.length; i++) {
          const era = eras[i];
          if (!era) continue;
          const d = Math.abs(shown - era.year);
          if (d < best) {
            best = d;
            active = i;
          }
        }
        const nav = erasNavRef.current;
        if (nav) {
          Array.from(nav.children).forEach((el, i) => {
            el.classList.toggle('is-active', i === active);
          });
        }
        prefetchAround(shown);
      }
    };

    paint();
    const unsubscribe = subscribe(() => {
      if (!frame) frame = requestAnimationFrame(paint);
    });
    return () => {
      unsubscribe();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const yearFromEvent = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return getState().year;
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return clampYear(YEAR_MIN + ratio * (YEAR_MAX - YEAR_MIN));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setState({ year: yearFromEvent(e.clientX), playing: false });
    },
    [yearFromEvent],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      setState({ year: yearFromEvent(e.clientX) });
    },
    [yearFromEvent],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const togglePlay = useCallback(() => {
    const s = getState();
    if (s.playing) {
      setState({ playing: false });
      return;
    }
    // Pressing play at the very end restarts rather than doing nothing.
    setState({ playing: true, year: s.year >= YEAR_MAX - 0.5 ? YEAR_MIN : s.year });
  }, []);

  // Playback. Advances by wall-clock time so speed is frame-rate independent.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = getState().year + getState().speed * dt;
      if (next >= YEAR_MAX) {
        setState({ year: YEAR_MAX, playing: false });
        return;
      }
      setState({ year: next });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        setState({ year: clampYear(Math.round(getState().year) - step), playing: false });
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        setState({ year: clampYear(Math.round(getState().year) + step), playing: false });
        e.preventDefault();
      } else if (e.key === 'Home') {
        setState({ year: YEAR_MIN, playing: false });
        e.preventDefault();
      } else if (e.key === 'End') {
        setState({ year: YEAR_MAX, playing: false });
        e.preventDefault();
      } else if (e.key === ' ') {
        // Space on a focused control must activate that control, not fight it
        // for the play/pause toggle.
        if (target && /^(BUTTON|A|SELECT)$/.test(target.tagName)) return;
        togglePlay();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay]);

  /** Jump to the previous/next border snapshot — the map's own "steps". */
  const stepSnapshot = useCallback((dir: -1 | 1) => {
    const years = getSnapshotYears();
    if (!years.length) return;
    const y = displayYear(getState().year);
    const next =
      dir > 0 ? years.find((s) => s > y) : [...years].reverse().find((s) => s < y);
    if (next != null) setState({ year: next, playing: false });
  }, []);

  const initial = displayYear(getState().year);

  return (
    <div className="timeline">
      <div className="timeline__head">
        <button
          className="timeline__step"
          onClick={() => stepSnapshot(-1)}
          aria-label={t.timeline.prevSnapshot}
          title={t.timeline.prevSnapshot}
        >
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
            <path d="M8.5 1.5 4 6l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M2.4 1.5v9" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        <button
          className="timeline__play"
          onClick={togglePlay}
          aria-label={playing ? t.timeline.pause : t.timeline.play}
          aria-pressed={playing}
        >
          {playing ? (
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <rect x="3.6" y="2.6" width="3.3" height="10.8" rx="1.1" fill="currentColor" />
              <rect x="9.1" y="2.6" width="3.3" height="10.8" rx="1.1" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path
                d="M4.8 3.1v9.8a1 1 0 0 0 1.53.85l7.7-4.9a1 1 0 0 0 0-1.7l-7.7-4.9A1 1 0 0 0 4.8 3.1Z"
                fill="currentColor"
              />
            </svg>
          )}
        </button>
        <button
          className="timeline__step"
          onClick={() => stepSnapshot(1)}
          aria-label={t.timeline.nextSnapshot}
          title={t.timeline.nextSnapshot}
        >
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
            <path d="M3.5 1.5 8 6l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M9.6 1.5v9" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>

        <div className="timeline__year">
          <span className="timeline__year-value" ref={yearRef}>
            {initial}
          </span>
          <span className="timeline__year-suffix">{t.timeline.yearSuffix}</span>
        </div>

        <div className="timeline__speeds" role="group" aria-label={t.timeline.speed}>
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              className={`timeline__speed${speed === s.value ? ' is-active' : ''}`}
              onClick={() => setState({ speed: s.value })}
              aria-pressed={speed === s.value}
            >
              {/* Intl so German gets its comma: 0,5× */}
              {new Intl.NumberFormat(t.bcp47, { maximumFractionDigits: 3 }).format(s.mult)}×
            </button>
          ))}
        </div>

        <nav className="timeline__eras" aria-label={t.timeline.era} ref={erasNavRef}>
          {t.timeline.eras.map((era) => (
            <button
              key={era.label}
              className="timeline__era"
              onClick={() => setState({ year: era.year, playing: false })}
            >
              {era.label}
            </button>
          ))}
        </nav>
      </div>

      <div
        className="timeline__track"
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        tabIndex={0}
        aria-label={t.timeline.year}
        aria-valuemin={YEAR_MIN}
        aria-valuemax={YEAR_MAX}
        aria-valuenow={initial}
      >
        <svg
          className="timeline__stream"
          viewBox={`0 0 ${STREAM_W} ${STREAM_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="streamFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffb972" stopOpacity="0.62" />
              <stop offset="100%" stopColor="#e8622f" stopOpacity="0.08" />
            </linearGradient>
            <clipPath id="streamPast">
              <rect ref={clipRef} x="0" y="0" width={0} height={STREAM_H} />
            </clipPath>
          </defs>
          <path d={streamPath} fill="rgba(190,205,225,0.08)" />
          <path d={streamPath} fill="url(#streamFill)" clipPath="url(#streamPast)" />
        </svg>

        <div className="timeline__rail" />
        <div className="timeline__fill" ref={fillRef} />

        {TICKS.map((t) => (
          <div key={t} className="timeline__tick" style={{ left: `${pctOf(t)}%` }}>
            <span className="timeline__tick-label">{t}</span>
          </div>
        ))}

        {/* Where UCDP's event-level data begins. The density of the map changes
            sharply here, and that is a fact about record-keeping, not violence. */}
        <div className="timeline__epoch" style={{ left: `${pctOf(GED_START)}%` }}>
          <span className="timeline__epoch-label">{GED_START} · {t.timeline.eventDataBegins}</span>
        </div>

        <div className="timeline__handle" ref={handleRef} />
      </div>

      <p className="timeline__scale-note">{t.timeline.scaleNote}</p>
    </div>
  );
}
