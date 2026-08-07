// Array-heavy data earns a ring system: banded, noise-broken, double-sided,
// with soft inner/outer falloff and sun-dependent shading.

import * as THREE from 'three';
import { SNOISE3 } from './glsl';
import type { PlanetBlueprint, RingSpec } from '../gen/blueprint';

export interface Rings {
  mesh: THREE.Mesh;
  update(time: number, sunDir: THREE.Vector3): void;
  dispose(): void;
}

const VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorldPos;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSunDir;
uniform float uInner;
uniform float uOuter;
uniform float uOpacity;
uniform float uSeed;
varying vec3 vLocal;
varying vec3 vWorldPos;
${SNOISE3}
void main() {
  float r = length(vLocal.xy);
  float t = (r - uInner) / (uOuter - uInner);
  if (t < 0.0 || t > 1.0) discard;

  // radial bands: layered 1-D noise along the radius
  float bands = 0.55 + 0.45 * snoise(vec3(t * 26.0, uSeed, 0.0));
  bands *= 0.6 + 0.4 * snoise(vec3(t * 90.0, uSeed + 11.0, 0.0));
  bands = clamp(bands, 0.0, 1.0);

  // gaps — a few Cassini-like divisions
  float gaps = smoothstep(0.02, 0.09, abs(t - 0.28)) * smoothstep(0.015, 0.06, abs(t - 0.62));
  float edge = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.85, 1.0, t));

  float a = bands * gaps * edge * uOpacity;
  if (a < 0.003) discard;

  // simple shadow: the ring darkens where the planet blocks the sun
  vec3 toSun = uSunDir;
  vec3 p = vWorldPos;
  float along = dot(p, toSun);
  float perp2 = dot(p, p) - along * along;
  float shadow = (along < 0.0 && perp2 < uInner * uInner * 0.42) ? 0.25 : 1.0;

  float sunFace = 0.55 + 0.45 * abs(dot(vec3(0.0, 1.0, 0.0), uSunDir));
  vec3 col = uColor * (0.35 + 0.75 * sunFace) * shadow;
  gl_FragColor = vec4(col, a);
}
`;

export function buildRings(bp: PlanetBlueprint, spec: RingSpec): Rings {
  const uniforms: Record<string, THREE.IUniform> = {
    uColor: { value: new THREE.Color(bp.palette.ring) },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uInner: { value: spec.inner },
    uOuter: { value: spec.outer },
    uOpacity: { value: spec.opacity },
    uSeed: { value: (spec.seed % 1000) / 10 },
  };
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(spec.inner, spec.outer, 256, 1),
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = Math.PI / 2;

  return {
    mesh,
    update: (_time, sunDir) => {
      (uniforms['uSunDir'] as THREE.IUniform<THREE.Vector3>).value.copy(sunDir);
    },
    dispose: () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
  };
}
