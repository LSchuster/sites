// Every leaf field becomes a city light on the night side. Rendered as one
// additive point cloud with per-light size, warmth and flicker phase; the
// shader fades lights in as their patch of ground rotates away from the sun.
// The point cloud is raycastable — hovering a light reveals which field it is.

import * as THREE from 'three';
import { Rng } from '../gen/rng';
import type { CitySpec, PlanetBlueprint } from '../gen/blueprint';
import type { PlanetSurface } from './planet';

export interface CityLights {
  points: THREE.Points | null;
  /** aligned with the point index — used by the hover inspector */
  specs: CitySpec[];
  update(time: number, sunDir: THREE.Vector3): void;
  dispose(): void;
}

const VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform vec3 uSunDir;
uniform float uScale;
varying float vGlow;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 up = normalize(wp.xyz);
  float night = smoothstep(0.22, -0.18, dot(up, uSunDir));
  float flicker = 0.82 + 0.18 * sin(uTime * (1.2 + aPhase * 2.0) + aPhase * 40.0);
  vGlow = night * flicker;
  vec4 mv = viewMatrix * wp;
  gl_PointSize = aSize * uScale * (140.0 / max(1.0, -mv.z)) * (0.35 + 0.65 * night);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vGlow;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float core = exp(-r2 * 22.0);
  float halo = exp(-r2 * 6.0) * 0.35;
  float a = (core + halo) * vGlow;
  if (a < 0.004) discard;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), core * 0.5), a);
}
`;

export function buildCities(
  bp: PlanetBlueprint,
  surface: PlanetSurface,
): CityLights {
  const specs = bp.cities;
  if (specs.length === 0) {
    return { points: null, specs: [], update: () => {}, dispose: () => {} };
  }

  const rng = new Rng(bp.seed ^ 0xc17e5);
  const positions = new Float32Array(specs.length * 3);
  const sizes = new Float32Array(specs.length);
  const phases = new Float32Array(specs.length);
  const dir = new THREE.Vector3();
  const placed: THREE.Vector3[] = [];

  // Lights cluster: a handful of seeded "settlement centers" attract most
  // placements so the night side reads as civilisation, not static.
  const centers: THREE.Vector3[] = [];
  const centerCount = Math.min(14, 3 + Math.floor(Math.sqrt(specs.length) / 3));
  for (let i = 0; i < centerCount * 6; i++) {
    dir.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
    if (dir.lengthSq() < 0.01 || dir.lengthSq() > 1) continue;
    dir.normalize();
    if (surface.heightAt(dir) > surface.seaRadius * 1.001) {
      centers.push(dir.clone());
      if (centers.length >= centerCount) break;
    }
  }
  if (centers.length === 0) centers.push(new THREE.Vector3(1, 0, 0));

  for (let i = 0; i < specs.length; i++) {
    let ok = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const center = centers[rng.int(0, centers.length - 1)]!;
      const spread = attempt < 6 ? 0.35 : 1.2; // widen if land is scarce
      dir
        .set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1))
        .multiplyScalar(spread)
        .add(center)
        .normalize();
      const h = surface.heightAt(dir);
      if (h > surface.seaRadius * 1.0015) {
        positions[i * 3] = dir.x * (h + 0.006);
        positions[i * 3 + 1] = dir.y * (h + 0.006);
        positions[i * 3 + 2] = dir.z * (h + 0.006);
        ok = true;
        break;
      }
    }
    if (!ok) {
      // ocean world — float the light just above the sea (harbor barges)
      dir.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
      const r = surface.seaRadius + 0.006;
      positions[i * 3] = dir.x * r;
      positions[i * 3 + 1] = dir.y * r;
      positions[i * 3 + 2] = dir.z * r;
    }
    placed.push(new THREE.Vector3(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!));
    sizes[i] = 0.6 + specs[i]!.weight * 1.7;
    phases[i] = rng.next();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uColor: { value: new THREE.Color(bp.palette.lights) },
    uScale: { value: Math.min(2, window.devicePixelRatio || 1) },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.userData['kind'] = 'cities';

  return {
    points,
    specs,
    update: (time, sunDir) => {
      (uniforms['uTime'] as THREE.IUniform<number>).value = time;
      (uniforms['uSunDir'] as THREE.IUniform<THREE.Vector3>).value.copy(sunDir);
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
