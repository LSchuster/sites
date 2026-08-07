import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import 'd3-transition'; // augments Selection with .transition()
import { zoom, zoomIdentity, type D3ZoomEvent } from 'd3-zoom';
import { AtlasRenderer } from './renderer.ts';
import { initBorders, prefetchAround } from '../data/borders.ts';
import { initConflicts } from '../data/conflicts.ts';
import { getState, setState } from '../state/store.ts';
import { ensureRelief } from './terrain.ts';
import { grainTileUrl } from './grain.ts';
import { prefersReducedMotion } from '../motion.ts';

export function MapCanvas(): React.JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generated client-side once — a 160px tile ships no asset bytes.
    if (grainRef.current) {
      grainRef.current.style.backgroundImage = `url(${grainTileUrl()})`;
    }
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const base = baseRef.current;
    const overlay = overlayRef.current;
    if (!wrap || !base || !overlay) return;

    const renderer = new AtlasRenderer(base, overlay);
    renderer.setCountryListener((c) => setState({ hoveredCountry: c }));

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      renderer.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2));
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 24])
      .on('zoom', (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        renderer.setTransform(event.transform);
      });

    const sel = select(overlay);
    sel.call(zoomBehavior).on('dblclick.zoom', null);
    // Double-click resets rather than zooming — more useful on a world map.
    sel.on('dblclick', () => {
      sel
        .transition()
        .duration(prefersReducedMotion() ? 0 : 600)
        .call(zoomBehavior.transform, zoomIdentity);
    });

    /**
     * Hover work is coalesced into one rAF tick.
     *
     * A pointermove can fire well above 60Hz, and the country test is a spherical
     * point-in-polygon across every feature in the snapshot. Running it per event
     * would burn milliseconds redoing identical work between frames.
     */
    let pending: { x: number; y: number } | null = null;
    let frame = 0;

    const processHover = () => {
      frame = 0;
      if (!pending || dragging) return;
      const { x, y } = pending;

      // Conflict bubbles take priority; battle dots only answer when no bubble does.
      const id = renderer.hitTest(x, y);
      if (id !== getState().hoveredId) setState({ hoveredId: id });

      const battle = id ? null : renderer.hitTestBattle(x, y);
      const prevBattle = getState().hoveredBattle;
      if (battle?.name !== prevBattle?.name || battle?.year !== prevBattle?.year) {
        // Only swap the object when the dot actually changed — a fresh object per
        // move would defeat setState's identity check and re-render every frame.
        setState({ hoveredBattle: battle ? { name: battle.name, year: battle.year } : null });
      }

      if (id || battle) setState({ hoverPos: [x, y] });
      else if (getState().hoverPos) setState({ hoverPos: null });

      renderer.setHoveredCountry(renderer.hitTestCountry(x, y));
      // Battles are not clickable, so only conflicts get the pointer cursor.
      overlay.style.cursor = id ? 'pointer' : '';
    };

    const onMove = (e: PointerEvent) => {
      const rect = overlay.getBoundingClientRect();
      pending = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (!frame) frame = requestAnimationFrame(processHover);
    };

    // Distinguish a click from the end of a drag: d3-zoom owns the same element,
    // and panning the map should never select whatever ends up under the cursor.
    let downAt: { x: number; y: number } | null = null;
    // While the button is held the map is being dragged; the spherical
    // point-in-polygon country test is skipped until it is released.
    let dragging = false;
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
      dragging = true;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 4) return;
      const rect = overlay.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Conflict bubbles win; then the territory under the cursor; the ocean
      // clears both. Conflict and country selection are mutually exclusive —
      // two open panels fighting for the corners helps nobody.
      const id = renderer.hitTest(x, y);
      if (id) {
        setState({ selectedId: id, selectedCountry: null });
        return;
      }
      const country = renderer.hitTestCountry(x, y);
      setState({
        selectedId: null,
        selectedCountry: country?.name ? country : null,
      });
    };
    const onLeave = () => {
      pending = null;
      dragging = false;
      setState({ hoveredId: null, hoveredBattle: null, hoverPos: null });
      renderer.setHoveredCountry(null);
    };

    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerdown', onDown);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointerleave', onLeave);

    void initBorders().then(() => {
      prefetchAround(getState().year);
      renderer.invalidate();
      // Terrain is a progressive enhancement: fetched only once the borders
      // are up and the main thread is idle, never on the first-paint path.
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => ensureRelief(), { timeout: 4000 });
      } else {
        setTimeout(ensureRelief, 1500);
      }
    });
    void initConflicts();
    // Canvas text rasterises with whatever face is loaded at bake time; once
    // the atlas serif arrives, cached layers must be thrown away or labels
    // keep the fallback face until the next unrelated rebake.
    void document.fonts.ready.then(() => renderer.invalidate());

    renderer.start();

    return () => {
      renderer.stop();
      ro.disconnect();
      sel.on('.zoom', null);
      if (frame) cancelAnimationFrame(frame);
      overlay.removeEventListener('pointermove', onMove);
      overlay.removeEventListener('pointerdown', onDown);
      overlay.removeEventListener('pointerup', onUp);
      overlay.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div className="map" ref={wrapRef}>
      <canvas className="map__canvas" ref={baseRef} />
      <canvas className="map__canvas map__canvas--overlay" ref={overlayRef} />
      <div className="map__grain" ref={grainRef} aria-hidden="true" />
      <div className="map__vignette" aria-hidden="true" />
    </div>
  );
}
