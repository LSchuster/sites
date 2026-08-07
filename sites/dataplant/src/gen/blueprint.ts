// DataProfile + seed → PlanetBlueprint: every number the renderer needs.
// The mapping is the product's promise, keep it legible:
//   data volume        → planet radius + mesh detail
//   top-level groups   → moons (and continent frequency)
//   leaf fields        → city lights
//   type mix           → biome archetype + ocean coverage
//   nesting depth      → cloud cover + atmosphere density
//   array-heaviness    → ring system
//   the bytes themselves → the seed (same data, same world)

import { Rng } from './rng';
import type { DataNode } from '../data/parse';
import type { DataProfile } from '../data/profile';

export interface Palette {
  name: string;
  oceanDeep: number;
  oceanShallow: number;
  beach: number;
  landLow: number;
  landMid: number;
  landHigh: number;
  peak: number;
  atmosphere: number;
  clouds: number;
  lights: number;
  ring: number;
  nebula: [number, number];
  /** Lava worlds: the "sea" glows. */
  seaEmissive: number | null;
  seaRoughness: number;
  /** 0 = snow only at the very poles, 1 = heavy glaciation. */
  snowAmount: number;
}

export interface CitySpec {
  path: string;
  label: string;
  preview: string;
  /** 0..1 → light size/brightness */
  weight: number;
}

export interface MoonSpec {
  name: string;
  path: string;
  /** leaf count it represents */
  leaves: number;
  radius: number;
  distance: number;
  speed: number;
  inclination: number;
  phase: number;
  seed: number;
}

export interface RingSpec {
  inner: number;
  outer: number;
  opacity: number;
  seed: number;
}

export interface PlanetBlueprint {
  seed: number;
  profile: DataProfile;
  radius: number;
  detail: number;
  /** target fraction of the surface under water, 0..1 */
  oceanFraction: number;
  continentFreq: number;
  mountainAmp: number;
  warp: number;
  palette: Palette;
  cloudCover: number;
  atmoDensity: number;
  axialTilt: number;
  sunAzimuth: number;
  sunElevation: number;
  cities: CitySpec[];
  moons: MoonSpec[];
  ring: RingSpec | null;
}

// ---------------------------------------------------------------------------
// Curated archetype palettes. Hue-jittered per seed so no two planets match,
// but always inside ranges that stay beautiful.

const ARCHETYPES: Palette[] = [
  {
    name: 'Azure', // temperate water world
    oceanDeep: 0x04203f, oceanShallow: 0x1173a0, beach: 0xc9b98c,
    landLow: 0x3d7a4a, landMid: 0x6b7d4e, landHigh: 0x8d8776, peak: 0xf0f4f4,
    atmosphere: 0x5fb8ff, clouds: 0xffffff, lights: 0xffd9a0, ring: 0xbfd4e6,
    nebula: [0x1c3a6e, 0x0d5a5e], seaEmissive: null, seaRoughness: 0.16, snowAmount: 0.35,
  },
  {
    name: 'Verdant', // lush jungle world
    oceanDeep: 0x062e35, oceanShallow: 0x0e8378, beach: 0xd8c37f,
    landLow: 0x2c6e33, landMid: 0x497a2e, landHigh: 0x7a6f45, peak: 0xe9f0e2,
    atmosphere: 0x7fe8c0, clouds: 0xfaffef, lights: 0xffe9a8, ring: 0xa8d6b8,
    nebula: [0x0c4b3f, 0x274d12], seaEmissive: null, seaRoughness: 0.2, snowAmount: 0.18,
  },
  {
    name: 'Ochre', // arid dune world
    oceanDeep: 0x27383d, oceanShallow: 0x4c7576, beach: 0xd9a05e,
    landLow: 0xb27746, landMid: 0xc08a52, landHigh: 0x8f5f3d, peak: 0xf3e3c8,
    atmosphere: 0xffb37d, clouds: 0xfff1da, lights: 0xaef1ff, ring: 0xe3b98a,
    nebula: [0x6e3a1c, 0x4a2f5e], seaEmissive: null, seaRoughness: 0.3, snowAmount: 0.08,
  },
  {
    name: 'Glacial', // ice world
    oceanDeep: 0x0a1e42, oceanShallow: 0x2b6f9e, beach: 0xb9c8d4,
    landLow: 0x9db4c4, landMid: 0xc3d5e2, landHigh: 0xdfeaf2, peak: 0xffffff,
    atmosphere: 0x9fd4ff, clouds: 0xffffff, lights: 0xffc890, ring: 0xcfe4f4,
    nebula: [0x1b3d78, 0x0f5a72], seaEmissive: null, seaRoughness: 0.1, snowAmount: 0.95,
  },
  {
    name: 'Ember', // volcanic world — the sea is lava
    oceanDeep: 0xff3c00, oceanShallow: 0xffa227, beach: 0x3c2a24,
    landLow: 0x2b2320, landMid: 0x453833, landHigh: 0x5c5049, peak: 0x8d8378,
    atmosphere: 0xff7a45, clouds: 0x8a7a72, lights: 0xffe0b0, ring: 0x7d6a5e,
    nebula: [0x6e1c1c, 0x3d1c5e], seaEmissive: 0xff5a1f, seaRoughness: 0.55, snowAmount: 0,
  },
  {
    name: 'Violet', // alien twilight world
    oceanDeep: 0x1c0f45, oceanShallow: 0x5636a8, beach: 0x8e6fa8,
    landLow: 0x2f5f72, landMid: 0x3f7a6e, landHigh: 0x6a5e8a, peak: 0xe8ddf6,
    atmosphere: 0xc37dff, clouds: 0xf2e8ff, lights: 0x8dfcff, ring: 0xb08ade,
    nebula: [0x4a1c6e, 0x1c2f6e], seaEmissive: null, seaRoughness: 0.14, snowAmount: 0.3,
  },
];

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Pick an archetype with weights nudged by the data's character. */
function pickArchetype(p: DataProfile, rng: Rng): Palette {
  // order matches ARCHETYPES
  const w = [1, 1, 1, 1, 0.7, 0.9];
  if (p.numericRatio > 0.6) { w[0]! += 1.4; w[3]! += 0.8; } // number-heavy → water/ice
  if (p.numericRatio < 0.25) { w[2]! += 1.1; w[1]! += 0.7; } // wordy → arid/lush
  if (p.entropy > 0.75) { w[4]! += 1.3; w[5]! += 1.2; } // chaotic → volcanic/alien
  if (p.entropy < 0.45) { w[3]! += 0.9; } // uniform → glacial calm
  if (p.maxDepth >= 6) { w[1]! += 0.9; w[5]! += 0.6; } // deeply nested → overgrown/strange
  if (p.parsed.format === 'text') { w[1]! += 0.6; w[2]! += 0.5; }

  let total = 0;
  for (const x of w) total += x;
  let r = rng.next() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i]!;
    if (r <= 0) return ARCHETYPES[i]!;
  }
  return ARCHETYPES[0]!;
}

// ---------------------------------------------------------------------------

function collectCities(root: DataNode, cap: number): CitySpec[] {
  const out: CitySpec[] = [];
  const stack: DataNode[] = [root];
  while (stack.length > 0 && out.length < cap) {
    const n = stack.pop()!;
    if (n.children) {
      // push in reverse so document order is roughly preserved
      for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]!);
      continue;
    }
    let weight = 0.35;
    if (n.type === 'number' && n.num !== undefined) {
      weight = 0.3 + 0.7 * clamp01(Math.log10(Math.abs(n.num) + 1) / 6);
    } else if (n.type === 'string') {
      weight = 0.25 + 0.6 * clamp01((n.preview?.length ?? 1) / 60);
    } else if (n.type === 'boolean') {
      weight = n.preview === 'true' ? 0.55 : 0.3;
    } else {
      weight = 0.18; // nulls barely glow
    }
    out.push({ path: n.path || n.key, label: n.key, preview: n.preview ?? '', weight });
  }
  return out;
}

export function buildBlueprint(profile: DataProfile, remix = 0): PlanetBlueprint {
  const seed = (profile.seed + remix * 0x9e3779b9) >>> 0;
  const rng = new Rng(seed);

  const { parsed } = profile;
  const volume = clamp01(Math.log10(parsed.bytes + 10) / 6); // 10 B → 0.17 · 1 MB → 1
  const complexity = clamp01(Math.log2(profile.totalNodes + 1) / 14); // ~16k nodes → 1

  const radius = 1.65 + 0.85 * volume;
  const detail = Math.round(52 + 44 * complexity); // icosphere subdivisions, ≤ 96

  const palette = pickArchetype(profile, rng);
  const oceanFraction = palette.name === 'Ember'
    ? 0.2 + 0.2 * rng.next()
    : clamp01(0.3 + 0.42 * profile.numericRatio + rng.range(-0.08, 0.08));

  // Major structures → moons.
  const groups = [...profile.topGroups].sort((a, b) => b.size - a.size);
  const moonCount = Math.min(groups.length > 12 ? 3 : groups.length, 7);
  const moons: MoonSpec[] = [];
  const totalGroupLeaves = Math.max(1, groups.reduce((s, g) => s + g.size, 0));
  for (let i = 0; i < moonCount; i++) {
    const g = groups[i]!;
    const share = g.size / totalGroupLeaves;
    moons.push({
      name: g.key === 'root' || g.key.startsWith('[') ? `${g.key}` : g.key,
      path: g.path || g.key,
      leaves: g.size,
      radius: radius * (0.075 + 0.14 * Math.sqrt(share)),
      distance: radius * (2.5 + i * 0.85 + rng.range(0, 0.4)),
      speed: rng.range(0.05, 0.16) * (rng.chance(0.85) ? 1 : -1) / (1 + i * 0.5),
      inclination: rng.range(-0.4, 0.4),
      phase: rng.range(0, Math.PI * 2),
      seed: rng.fork(),
    });
  }

  // Array-heavy data → ring system.
  const rootChildren = parsed.root.children?.length ?? 0;
  const wantsRing =
    (parsed.root.type === 'array' && rootChildren >= 40) ||
    (profile.arrayRatio > 0.55 && profile.leafCount > 80) ||
    parsed.format === 'csv';
  const ring: RingSpec | null = wantsRing
    ? {
        inner: radius * rng.range(1.45, 1.6),
        outer: radius * rng.range(2.0, 2.35),
        opacity: 0.35 + 0.4 * clamp01(Math.log10(rootChildren + 1) / 3.5),
        seed: rng.fork(),
      }
    : null;

  return {
    seed,
    profile,
    radius,
    detail,
    oceanFraction,
    continentFreq: 1.15 + 0.22 * Math.sqrt(Math.min(24, Math.max(1, profile.topGroups.length))) + rng.range(0, 0.35),
    mountainAmp: 0.045 + 0.05 * profile.entropy + rng.range(0, 0.018),
    warp: 0.35 + 0.55 * profile.entropy,
    palette,
    cloudCover: clamp01(0.32 + 0.075 * Math.min(8, profile.maxDepth) + rng.range(-0.06, 0.06)),
    atmoDensity: 0.55 + 0.55 * volume,
    axialTilt: rng.range(-0.45, 0.45),
    sunAzimuth: rng.range(0, Math.PI * 2),
    sunElevation: rng.range(-0.25, 0.45),
    cities: collectCities(parsed.root, 3200),
    moons,
    ring,
  };
}
