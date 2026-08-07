// Terrain + ocean. The land is a CPU-displaced icosphere with per-vertex
// biome colors and smooth normals; the ocean is a glossy PBR sphere at sea
// level (or glowing lava on Ember worlds). heightAt() re-evaluates the same
// noise stack so cities and pickers can query the surface analytically.

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplexNoise } from '../gen/noise';
import { Rng } from '../gen/rng';
import type { PlanetBlueprint } from '../gen/blueprint';

export interface PlanetSurface {
  group: THREE.Group;
  land: THREE.Mesh;
  ocean: THREE.Mesh;
  /** invisible sea-level sphere used for hover occlusion tests */
  occluder: THREE.Mesh;
  seaRadius: number;
  maxRadius: number;
  /** displaced surface radius in planet-local space for a unit direction */
  heightAt(dir: THREE.Vector3): number;
  dispose(): void;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function makeLavaTexture(seed: number): THREE.CanvasTexture {
  const w = 512, h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const n = new SimplexNoise(seed);
  for (let y = 0; y < h; y++) {
    const v = y / h;
    const phi = v * Math.PI;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const theta = u * Math.PI * 2;
      const px = Math.sin(phi) * Math.cos(theta);
      const py = Math.cos(phi);
      const pz = Math.sin(phi) * Math.sin(theta);
      const crack = n.ridged(px * 4, py * 4, pz * 4, 5);
      const flow = 0.5 + 0.5 * n.fbm(px * 2.4, py * 2.4, pz * 2.4, 4);
      const heat = Math.pow(crack, 2.2) * (0.55 + 0.45 * flow);
      const i = (y * w + x) * 4;
      img.data[i] = Math.min(255, 90 + heat * 220);
      img.data[i + 1] = Math.min(255, 18 + heat * 130);
      img.data[i + 2] = Math.min(255, 4 + heat * 30);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildPlanet(bp: PlanetBlueprint): PlanetSurface {
  const rng = new Rng(bp.seed ^ 0x51ab);
  const continentNoise = new SimplexNoise(rng.fork());
  const ridgeNoise = new SimplexNoise(rng.fork());
  const warpNoise = new SimplexNoise(rng.fork());
  const detailNoise = new SimplexNoise(rng.fork());

  const cFreq = bp.continentFreq;
  const warpAmp = bp.warp;

  /** raw terrain height for a unit direction, roughly [-1, 1] */
  const terrain = (x: number, y: number, z: number): number => {
    const wx = x + warpAmp * warpNoise.fbm(x * 1.4 + 7.3, y * 1.4, z * 1.4, 3) * 0.6;
    const wy = y + warpAmp * warpNoise.fbm(x * 1.4, y * 1.4 + 3.1, z * 1.4, 3) * 0.6;
    const wz = z + warpAmp * warpNoise.fbm(x * 1.4, y * 1.4, z * 1.4 + 9.7, 3) * 0.6;
    const continents = continentNoise.fbm(wx * cFreq, wy * cFreq, wz * cFreq, 5);
    const landMask = smoothstep(-0.12, 0.35, continents);
    const ridges = ridgeNoise.ridged(x * cFreq * 3.1, y * cFreq * 3.1, z * cFreq * 3.1, 5);
    const fine = detailNoise.fbm(x * cFreq * 7.5, y * cFreq * 7.5, z * cFreq * 7.5, 4);
    return continents * 0.62 + landMask * ridges * 0.55 + fine * 0.1;
  };

  // --- Geometry -----------------------------------------------------------
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, bp.detail);
  geo.deleteAttribute('uv'); // uv seams would break vertex merging
  geo.deleteAttribute('normal');
  geo = BufferGeometryUtils.mergeVertices(geo, 1e-4);

  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const count = pos.count;
  const heights = new Float32Array(count);
  const dir = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    heights[i] = terrain(dir.x, dir.y, dir.z);
  }

  // Sea level = the height quantile that yields the requested ocean coverage.
  const sorted = Array.from(heights).sort((a, b) => a - b);
  const qi = Math.min(sorted.length - 1, Math.max(0, Math.floor(bp.oceanFraction * sorted.length)));
  const seaH = sorted[qi]!;
  const minH = sorted[0]!;
  const maxH = sorted[sorted.length - 1]!;
  const amp = bp.mountainAmp;
  const seaRadius = bp.radius * (1 + amp * seaH);
  const maxRadius = bp.radius * (1 + amp * maxH);

  // --- Vertex colors ------------------------------------------------------
  const pal = bp.palette;
  const cOceanDeep = new THREE.Color(pal.oceanDeep).multiplyScalar(0.5);
  const cOceanShallow = new THREE.Color(pal.oceanShallow).multiplyScalar(0.55);
  const cBeach = new THREE.Color(pal.beach);
  const cLow = new THREE.Color(pal.landLow);
  const cMid = new THREE.Color(pal.landMid);
  const cHigh = new THREE.Color(pal.landHigh);
  const cPeak = new THREE.Color(pal.peak);

  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();
  const tmp = new THREE.Color();
  const varNoise = new SimplexNoise(rng.fork());

  for (let i = 0; i < count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const h = heights[i]!;

    if (h <= seaH) {
      const d = seaH - minH > 1e-6 ? (seaH - h) / (seaH - minH) : 0;
      c.copy(cOceanShallow).lerp(cOceanDeep, Math.pow(d, 0.55));
    } else {
      const e = maxH - seaH > 1e-6 ? (h - seaH) / (maxH - seaH) : 0;
      if (e < 0.045) c.copy(cBeach);
      else if (e < 0.32) c.copy(cLow).lerp(cMid, smoothstep(0.045, 0.32, e));
      else if (e < 0.62) c.copy(cMid).lerp(cHigh, smoothstep(0.32, 0.62, e));
      else c.copy(cHigh).lerp(cPeak, smoothstep(0.62, 0.92, e));

      // biome variety: large-scale tint patches
      const patch = varNoise.fbm(dir.x * 2.1, dir.y * 2.1, dir.z * 2.1, 3);
      tmp.copy(cMid).lerp(cLow, 0.5);
      c.lerp(tmp, Math.max(0, patch) * 0.25);

      // snow by latitude + altitude
      const lat = Math.abs(dir.y);
      const snowLine = 1.02 - pal.snowAmount * 0.85;
      const snow = smoothstep(snowLine - 0.14, snowLine + 0.05, lat + e * 0.55);
      c.lerp(cPeak, snow);
    }

    // subtle grain so flats never look airbrushed
    const grain = 1 + varNoise.noise(dir.x * 60, dir.y * 60, dir.z * 60) * 0.045;
    colors[i * 3] = c.r * grain;
    colors[i * 3 + 1] = c.g * grain;
    colors[i * 3 + 2] = c.b * grain;
  }

  // --- Displace + normals -------------------------------------------------
  for (let i = 0; i < count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const r = bp.radius * (1 + amp * heights[i]!);
    pos.setXYZ(i, dir.x * r, dir.y * r, dir.z * r);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const landMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
  });
  const land = new THREE.Mesh(geo, landMat);

  // --- Ocean --------------------------------------------------------------
  const oceanGeo = new THREE.SphereGeometry(seaRadius, 128, 96);
  let oceanMat: THREE.Material;
  if (pal.seaEmissive !== null) {
    const lavaTex = makeLavaTexture(bp.seed ^ 0x7f3);
    oceanMat = new THREE.MeshStandardMaterial({
      color: 0x140a06,
      emissive: new THREE.Color(pal.seaEmissive),
      emissiveMap: lavaTex,
      emissiveIntensity: 2.4,
      roughness: pal.seaRoughness,
      metalness: 0,
    });
  } else {
    oceanMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(pal.oceanDeep).lerp(new THREE.Color(pal.oceanShallow), 0.35),
      roughness: pal.seaRoughness,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.88,
    });
  }
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);

  // --- Occluder for hover tests ------------------------------------------
  const occluder = new THREE.Mesh(
    new THREE.SphereGeometry(seaRadius * 0.995, 48, 32),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  occluder.renderOrder = -100;
  occluder.userData['kind'] = 'occluder';

  const group = new THREE.Group();
  group.add(land, ocean, occluder);

  return {
    group,
    land,
    ocean,
    occluder,
    seaRadius,
    maxRadius,
    heightAt: (d: THREE.Vector3) => {
      const n = d.clone().normalize();
      return bp.radius * (1 + amp * terrain(n.x, n.y, n.z));
    },
    dispose: () => {
      geo.dispose();
      oceanGeo.dispose();
      occluder.geometry.dispose();
      landMat.dispose();
      oceanMat.dispose();
      (occluder.material as THREE.Material).dispose();
      if (oceanMat instanceof THREE.MeshStandardMaterial && oceanMat.emissiveMap) {
        oceanMat.emissiveMap.dispose();
      }
    },
  };
}
