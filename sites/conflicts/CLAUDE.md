# conflicts.io — agent brief

Static, client-only atlas of human conflict, year 0 → now. Vite + React + TypeScript + D3,
canvas rendering, no server, no runtime API keys. `npm run dev` → http://localhost:5173.

**This file is the contract. Read the one routed doc for your task before editing that area.**
Do not read them all — each is a deep dive and only one will be relevant.

| Your task | Read first |
|---|---|
| Add/edit conflicts, run a pipeline, touch `public/data/` | `docs/data.md` |
| Map appearance, canvas layers, performance, hit-testing | `docs/rendering.md` |
| Add a language, translate, flags, country-name matching | `docs/i18n-and-flags.md` |
| Change an encoding, a colour, or ask "why is it like this" | `docs/decisions.md` |
| Deploy, hosting, launch, legal pages, monetization, marketing | `docs/implementation-roadmap.md` (tasks; strategy in `docs/publication-plan.md`) |

Human-facing setup and deployment live in `README.md`.

---

## Hard rules

1. **Never hand-edit `public/data/`.** It is generated. Sources of truth are
   `data/curated/*.yaml` (conflicts), `data/curated/i18n/*.yaml` (translations), and the
   pipeline scripts. Edit those, then re-run the pipeline.
2. **Never fetch a raw source at runtime.** All fetching, parsing and aggregation happens in
   `pipeline/` at build time. This is what keeps hosting free — the raw UCDP file alone is
   239 MB. `src/` reads pre-baked files and nothing else.
3. **After any data edit run `npm run data:conflicts && npm run data:validate`.** Historical
   data fails silently; a transposed coordinate puts a battle in the ocean and nothing throws.
4. **The canvas render loop must not go through React.** `src/map/renderer.ts` runs its own rAF
   loop reading the store directly. Routing per-frame state through React re-renders costs
   roughly 45 fps. Same rule for the timeline scrubber, which writes the DOM imperatively.
5. **Every casualty figure is `{low, best, high, confidence}`.** Never reduce one to a bare
   number, and never invent data to fill a sparse century. Uncertainty is a feature here, not
   a defect to hide.
6. **Licence is GPL-3.0 and must stay so** while `public/data/borders/` ships — that data is
   GPL-3.0 upstream.

## Four traps that have already cost real debugging time

Each looked like something else. All four are commented at the fix site; do not "simplify" them.

1. **Ring winding floods the globe.** GeoJSON's spherical reading treats ring orientation as
   meaningful — a reversed ring means the *complement*, so one bad ring fills the whole map with
   flat colour. Simplification collapses small islands into inverted micro-rings. The repair in
   `src/data/borders.ts` is **per polygon**; a per-feature version silently swaps which pieces
   are broken and changes nothing on screen.
2. **The year must stay fractional.** `state.year` is a float; playback advances it a fraction
   per frame. Rounding it in the store snaps every increment back and the animation sits still
   while the loop runs at full speed. Round only at display (`displayYear`).
3. **`dirty` means content changed, not viewport moved.** The renderer blits cached layers with
   a delta transform while dragging. Setting `dirty` in `setTransform` forces a full re-raster
   every pan frame → 15 fps, while every other interaction still measures 60 and hides the cause.
4. **`Intl.DisplayNames` answers for dead ISO codes.** Iterating AA–ZZ last-writer-wins maps
   France→FX, United Kingdom→UK, Russia→SU, Serbia→YU. None have flag assets, so it surfaces as
   "France has no flag" rather than an error. Filter to codes that ship an asset; take the first.

## Before you call it done

```bash
npx tsc --noEmit                 # strict; noUncheckedIndexedAccess is on
npm run data:validate            # if any data changed
npm run build                    # must succeed; watch the gzip numbers
node tools/perf.mjs              # if you touched the renderer — see baseline below
```

**Verify visually — this is a graphics project and typechecking proves nothing about it.**
`node tools/shot.mjs <url> <out.png> [waitMs] [w] [h] ["x,y;x,y"]` drives headless Edge over
CDP and can click before capturing. It exists because Chromium's `--screenshot` needs
`--virtual-time-budget`, under which `requestAnimationFrame` never fires and the canvas always
captures blank. **Look at the screenshot.** When something looks wrong, measure pixels or
geometry rather than guessing — every map bug in this repo was found that way and none was
correctly guessed.

## Baselines to protect

| | value |
|---|---|
| First paint | ~230 KB gzipped (~205 KB data/JS/CSS + 21.5 KB preloaded display font; border snapshots grew ~2 KB gz each with entity/tint/label props) |
| JS bundle | ~98 KB gzipped |
| Frame rate | 60 idle / ~58 playback / 60 panning / 60 hover (headless, software rendering); the playback probe runs at the 0.5× default (10 yr/s, 1914→~1938) so it barely clips the 1-year wartime snapshots — crossing 1938–45 still spikes ~50 ms per snapshot — see docs/rendering.md |
| Lazy extras | terrain/relief.webp ~250 KB, fetched on idle after borders — never on the first-paint path |
| Data | 105 conflicts · 6,519 battles (+21 KB gz German name overlay, lazy) · 64,036 UCDP cell-years · 43 border snapshots (37 upstream + 6 curated WWII) · 2,507 cross-snapshot entities · 174 flags |

Panning is the number to watch: it is the only interaction that can invalidate the cached
vector layers, and it has regressed to 15 fps once already.

## Commands

```bash
npm run dev | build | preview
npm run data:borders    # 43 world snapshots (incl. curated WWII years) + entity/tint/label pass → TopoJSON
npm run data:battles    # ~6,500 geolocated battles from Wikidata (SPARQL)
npm run data:conflicts  # curated YAML + translations → conflicts.json
npm run data:flags      # polity names → ISO codes, copies SVGs
npm run data:terrain    # Natural Earth relief → pre-projected Equal Earth plate (webp)
npm run data:validate   # invariant checks (conflicts + borders) — run after any data edit
npm run data:ucdp       # needs a manual 29 MB download; see docs/data.md
# one-off: node tools/fonts.mjs — re-subset EB Garamond into src/assets/fonts/
```
