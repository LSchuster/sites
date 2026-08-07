# dataplant — agent brief

Static, client-only interactive art piece: paste/upload JSON, CSV or plain text and it
grows a procedurally generated 3D planet (three.js, custom shaders, bloom pipeline).
Vite + vanilla TypeScript, no framework, dark theme only. `npm run dev` → http://localhost:5173.

## Hard rules

1. **Everything stays client-side.** No fetches to any origin at runtime (the CSP in
   `public/_headers` enforces it). Pasted data is never stored anywhere — that privacy
   promise is part of the product.
2. **Determinism is a feature.** The same input bytes must always grow the same planet:
   every random decision flows from the FNV-1a seed in `src/data/profile.ts` through the
   seeded `Rng`/`SimplexNoise` in `src/gen/`. Never call `Math.random()` in generation
   code; "Remix" is `seed + n·0x9e3779b9`, not fresh entropy.
3. **The data→planet mapping is the contract** (volume→size, top-level groups→moons,
   leaf fields→city lights, type mix→biome, depth→clouds, arrays→rings). It is stated in
   the UI legend, the README and `src/gen/blueprint.ts` — change all three together or
   not at all.
4. **Visual quality outranks feature count.** New effects must go through the composer
   (ACES tone mapping + bloom + OutputPass) and respect the sun direction uniform; keep
   the frame budget: geometry detail is capped in `blueprint.ts` (icosphere detail ≤ 96,
   cities ≤ 3200) and parsing is capped in `parse.ts` — raise caps only with profiling.
5. **Licence is MIT (per-site).** three.js is MIT; the GLSL simplex noise is
   webgl-noise (MIT, attributed in `src/scene/glsl.ts`). Do not add GPL dependencies.

## Layout

- `src/data/` — input parsing (JSON/NDJSON/CSV/text → one `DataNode` tree) + profiling
- `src/gen/` — seeded RNG, CPU simplex noise, `blueprint.ts` (the mapping — heart of the app)
- `src/scene/` — one module per phenomenon: planet (terrain+ocean), atmosphere, clouds,
  cities, moons, rings, stars; `world.ts` owns renderer/composer/loop; `glsl.ts` shared noise
- `src/ui/` — hover inspector (raycast → data path tooltip); `main.ts` wires the panel/dock
- `index.html` — all static markup; `src/style.css` — all styling, no CSS framework

## Before you call it done

```bash
npx tsc --noEmit   # strict; noUncheckedIndexedAccess is on
npm run build      # must succeed
```

Then eyeball one planet per sample chip (API response / Sales CSV / A poem) in
`npm run dev` — the three archetype paths exercise ring, moon and text parsing code.
