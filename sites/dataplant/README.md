# dataplant — Turn Data into a Planet

Paste JSON, CSV or plain text — or drop a file — and watch it become a unique,
explorable 3D planet. A digital-art toy that runs entirely in your browser: nothing you
paste ever leaves your device.

## The mapping

Every planet is grown deterministically from the bytes you feed it (same data → same
world, always):

| Your data | The planet |
|---|---|
| Volume (bytes, node count) | Planet size and terrain detail |
| Top-level objects / groups | Moons (and continent count) |
| Individual fields and values | City lights on the night side (hover to inspect) |
| Type mix (numbers vs. text) & entropy | Biome archetype, ocean coverage, mountains |
| Nesting depth | Cloud cover and atmosphere |
| Array-heavy shape (e.g. CSV rows) | A ring system |

Six curated biome archetypes (Azure, Verdant, Ochre, Glacial, Ember, Violet) keep every
world beautiful; a seeded remix button re-rolls the aesthetics without changing what the
data means.

## Tech

- Vite + vanilla TypeScript, [three.js](https://threejs.org) — no framework, no backend
- CPU-displaced icosphere terrain with per-vertex biomes; PBR ocean (or emissive lava)
- Custom GLSL: two-shell atmospheric scattering, animated fbm cloud layers, night-side
  city lights, banded rings, twinkling starfield with palette-tinted nebulae
- ACES tone mapping + MSAA render target + Unreal bloom
- High-resolution PNG export

## Develop

```bash
npm ci
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build → dist/
```

## Licence

MIT (this folder's `LICENSE`). GLSL simplex noise from
[webgl-noise](https://github.com/ashima/webgl-noise) (MIT).
