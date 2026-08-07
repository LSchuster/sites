# Rendering

`src/map/renderer.ts` is the whole map. It is imperative canvas code that runs its own rAF loop
and reads the store directly. **React never drives a frame.**

## Layers

Two stacked canvases plus six offscreen layers, with two DOM sheets above them:

```
base canvas   ← page fill, then blit: geoLayer + layerA + layerB(alpha=mix)
                + tintLayer + tintLayerB(alpha=mix)
overlay       ← cleared and redrawn every frame: hover/selection washes, GED field,
                polity labels, battles, bubbles
.map__grain   ← DOM: paper-grain tile (CSS background, browser-composited — a canvas
                pattern fill of the same tile cost ~5 fps of playback)
.map__vignette← DOM: corner vignette
```

| Offscreen layer | Re-rasterised when |
|---|---|
| `geoLayer` | ocean gradient + graticule + plate edge — viewport changes |
| `layerA` / `layerB` | the bracketing border snapshots — snapshot, viewport, or relief step changes |
| `tintLayer` / `tintLayerB` | belligerent + occupied washes per snapshot — snapshot year or matched sets change, **never the display year** |
| `reliefLayer` | the terrain plate warped to the viewport — viewport changes; consumed by snapshot rasters, never composited directly |

Each layer holds a `key`; render methods early-return when the key matches. Keying
the tint on the display year would re-rasterise it twenty times a second during playback (it once
did, and was the sole source of dropped frames); the snapshot year changes only at gap crossings.

Ocean depth is **map-space** (a radial gradient baked into `geoLayer`, anchored to the sphere, so
it pans with the world); grain and vignette are **page-space** by design — they are properties of
the print, not the map, so they deliberately do not pan and cost the render loop nothing as DOM.

### Terrain relief

`pipeline/8-terrain.ts` bakes Natural Earth shaded relief (public domain) into an Equal Earth
"plate shading": translucent black where the ground falls, translucent white where it rises, fully
transparent where it is flat or wet. Because the live projection is also Equal Earth and
`fitExtent` only ever changes scale and translate, warping the plate to the screen is **one affine
`drawImage`** into `reliefLayer` per settle; each snapshot raster then embosses it with a 1:1
`source-atop` draw — clipped to that snapshot's own landmass, so relief crossfades and pans with
the layer for free. Fetched lazily after the borders (never on the first-paint path), stepped in
over ~0.6 s, faded out between zoom 4 and 8 where the raster would turn to mush.

Snapshot layer keys carry the **snapshot year, not the feature count**: the curated wartime
snapshots 1941–1943 all have 251 features, and a count-based key kept a stale raster across
those crossings. At a gap crossing the layer the playhead just left already holds the raster the
other slot needs, so `drawBase` swaps `layerA`/`layerB` instead of re-projecting the world twice
— with 1-year gaps through 1938–45 the double raster showed as playback spikes.

The tint has two washes: `MAP.belligerent` for named belligerents and the deeper `MAP.occupied`
for polities held by an *enemy* belligerent (`isOccupiedByEnemy` in `src/data/involvement.ts` —
the polity and its `subjectTo` must resolve to different sides of the same active conflict, which
is what keeps "Belgian Congo" and every other same-side colony out of it). Occupied wins; a
feature is never painted twice. There are two tint layers because there are two snapshot layers:
A's wash rides at full alpha, B's dissolves in at the crossfade mix — with a single layer keyed to
"the snapshot in effect", the wash popped to the new geometry at the halfway flip while the ground
beneath it was still dissolving.

### Land fills and the border stack

Land fills are per-polity tints: `TERRITORY[props.color]`, a seven-slot low-chroma range assigned
at build time (see docs/data.md, entities pass), `MAP.land` for unnamed ground. The relief plate
is embossed over the fills, then the border stack — all inside the snapshot layer, so the
crossfade can never double-expose it: a soft dark under-stroke beneath the crisp internal
hairline, the *uncertain* mesh (boundaries whose either side carries the source's own
`precision ≥ 3` rating) drawn softer and dashed once zoom gives the dash room, then a wide coast
glow under a crisp bright coastline. Weights step with zoom via `borderStyle(k)`.

### Polity labels

`src/map/layers/labels.ts`. Serif letterspaced capitals with an ink halo, baked once per
(text, size) into sprite canvases — a label costs one `drawImage` per frame. Anchors and areas
are precomputed by the pipeline (`l` = pole of inaccessibility of the largest part, `a` =
spherical area); placement runs only at settle or snapshot-pair change: candidates gated by
`minArea(k)`, sized by area, greedily rejected on screen-space collision, capped at 64. During a
crossfade each label fades with its own snapshot's mix — an entity present on both sides stays at
full alpha while its anchor glides between the two snapshots' poles — and every appearance or
disappearance eases through a short per-label fade, scrub-safe in both directions. Drawing waits
for `document.fonts`; `MapCanvas` invalidates once the face arrives so cached layers never keep
the fallback font.

## The panning contract

While the viewport is moving, cached layers are **blitted with a delta transform** — one
`drawImage` each instead of re-projecting every polygon in the world. `SETTLE_MS` (90 ms) after
the last transform change, everything re-rasterises crisply. The transient softness during a drag
is invisible in practice.

The delta, in device pixels, for layers baked at `T0` and displayed at `T1`:

```
s = T1.k / T0.k
setTransform(s, 0, 0, s, (T1.x - T0.x*s) * dpr, (T1.y - T0.y*s) * dpr)
```

**`dirty` must not be set in `setTransform`.** It means "content changed, re-raster"; a moved
viewport only means "re-composite what we already have". Setting it there pins panning at 15 fps.

Hover work is also skipped while dragging (`MapCanvas.tsx`) and the hover/selection washes are
skipped until settled — re-projecting a country outline every frame of a drag is pure waste. The
washes ease in and out (~150 ms, per-territory) and their fill thins beyond zoom 6: at deep zoom a
single polity fills the viewport, and a constant-alpha wash read as a grey veil over everything.
Clicking land selects the polity (`state.selectedCountry`, resolved across snapshots by entity id
with a name fallback, self-clearing when the polity ceases to exist); the ocean clears it.

## Border crossfade

Snapshots are **crossfaded, not morphed**. Vertex interpolation between topologies with different
shapes (Rome → a dozen successor states) is ill-defined and tears.

Draw the earlier snapshot at **full opacity** and dissolve the later one over it at `mix`. The
intuitive alternative — A at `1-mix`, B at `mix` — is wrong: the second `drawImage` dilutes the
first, so mid-crossfade the land ends up ~77% opaque and ocean bleeds through. Mid-era years
looked washed out compared to years that happened to land exactly on a snapshot.

`mix` comes from `bracket()` in `src/data/borders.ts`: held at 0 for most of a gap (anachronism
control — see docs/decisions.md), then **smoothstepped** through the fade window; the raw ramp was
C0 but not C1 and playback visibly kicked as each window opened. Under `prefers-reduced-motion`
(`src/motion.ts`, the single matchMedia read) the dissolve collapses to a hard cut at the window's
midpoint, and the mark/label/relief fades become instant.

`snapshotAt()` — the snapshot whose *names* are trusted (hover, hit-testing, tint sets) — still
flips at `mix > 0.5`. That is a semantic choice, not an oversight: at mix 0.9 the reader is mostly
looking at B, so B's names are the correct answer; the visible pops the flip once caused are now
masked by the per-snapshot tint layers and the animated hover washes.

## Land fills

Fill features **one at a time**. Filling the whole FeatureCollection as a single path is tempting
and floods the sphere: with nonzero winding, circumpolar Antarctica's rings combine with
everything else. Per-feature fills keep each polygon's winding to itself. The cost is fine because
this layer only rasterises on snapshot or viewport change, not per frame.

## Hit testing

- **Conflicts**: `hitTest(x, y)` scans the marks the last frame placed. Cheap; ~20 visible.
- **Countries**: `hitTestCountry(x, y)` inverts the projection then uses `geoContains` — a proper
  spherical point-in-polygon, so it stays correct across the antimeridian and at the poles where a
  planar test gives quietly wrong answers. Coalesced to one rAF tick, skipped while dragging.

Unnamed features are unclaimed land; the test keeps looking for a named polity covering the same
point before settling for one.

## State

`src/state/store.ts` is a tiny external store. Components subscribe narrowly via `useAtlas`
(selector-based, so a `year` change doesn't re-render a component watching `vizMode`). The
renderer bypasses it and calls `getState()` per frame.

**`year` is a float.** Playback advances it by a fraction each frame; rounding it in the store
freezes the animation. `displayYear()` rounds for presentation. It also makes the crossfade
continuous rather than stepped.

The timeline scrubber writes the DOM imperatively from a store subscription rather than
re-rendering — during playback that would reconcile ticks, era buttons and the stream SVG sixty
times a second for what is four attribute writes.

## Measuring

```bash
node tools/perf.mjs [url]     # idle / playback / panning / hover sweep
```

Baseline (headless, software rendering — a real GPU does better): **60 / ~58 / 60 / 60 fps**,
measured after the atlas redesign (tints, relief, layered borders, labels, tint crossfade) and
the battle/bubble animation pass. Panning is the one to watch. The playback probe runs at the
0.5× default speed (10 years/s, so its window covers ~1914–1938) and barely clips the wartime
cluster; when playback does cross 1938–45, the curated snapshots sit one year apart and each
crossing re-rasterises a full world layer (~50 ms spike, cold or warm — it is raster work, not
loading). Median frame time stays 16.7 ms. The perf probe clicks the play button at `PLAY_X` —
if the timeline head layout changes, update it, or the probe silently measures idle.

Screenshots: `node tools/shot.mjs <url> <out.png> [waitMs] [w] [h] ["x,y;x,y"]`. It drives CDP
because Chromium's `--screenshot` requires `--virtual-time-budget`, under which
`requestAnimationFrame` never fires and the canvas captures blank regardless of how long you wait.

**When the map looks wrong, measure it.** Probe pixel colours, feature areas, or projected
coordinates from a throwaway page that imports the real modules. Every map bug in this repo was
found that way, and every one was mis-guessed at least once first.
