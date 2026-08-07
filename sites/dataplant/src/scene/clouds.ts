// Two animated procedural cloud shells. Coverage comes from data nesting
// depth; the noise field drifts slowly and is lit by the sun with a soft
// wrap term plus a warm tint near the terminator.

import * as THREE from 'three';
import { SNOISE3 } from './glsl';
import type { PlanetBlueprint } from '../gen/blueprint';

export interface Clouds {
  group: THREE.Group;
  update(time: number, sunDir: THREE.Vector3): void;
  dispose(): void;
}

const VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vLocal = position;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uCover;
uniform float uSeed;
uniform float uFreq;
uniform vec3 uTint;
uniform vec3 uSunDir;
varying vec3 vLocal;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
${SNOISE3}
void main() {
  vec3 p = normalize(vLocal);
  vec3 q = p * uFreq + vec3(uSeed);
  // slow domain drift so the weather actually moves
  q += 0.18 * vec3(
    snoise(p * 1.5 + uTime * 0.008 + uSeed),
    snoise(p * 1.5 + uTime * 0.011 + uSeed + 31.0),
    snoise(p * 1.5 + uTime * 0.009 + uSeed + 67.0));
  float n = fbm(q + vec3(uTime * 0.004, 0.0, uTime * 0.006), 5, 2.2, 0.55);
  n = n * 0.5 + 0.5;

  float cover = 1.0 - uCover;
  float alpha = smoothstep(cover, cover + 0.32, n);
  alpha *= alpha;

  float sun = clamp(dot(vWorldNormal, uSunDir) * 0.72 + 0.28, 0.0, 1.0);
  // silver lining near the terminator
  float term = pow(1.0 - abs(dot(vWorldNormal, uSunDir)), 6.0) * 0.35;
  vec3 lit = uTint * (0.08 + 1.05 * sun) + vec3(1.0, 0.75, 0.5) * term * sun;

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float rim = pow(1.0 - clamp(dot(viewDir, vWorldNormal), 0.0, 1.0), 2.0);
  alpha *= 1.0 - rim * 0.35; // thin out at the limb so the atmosphere reads

  gl_FragColor = vec4(lit, alpha * 0.92);
}
`;

export function buildClouds(bp: PlanetBlueprint, surfaceRadius: number): Clouds {
  const group = new THREE.Group();
  const tint = new THREE.Color(bp.palette.clouds);
  const layers: { mesh: THREE.Mesh; uniforms: Record<string, THREE.IUniform>; spin: number }[] = [];

  const specs = [
    { scale: 1.03, freq: 2.6, cover: bp.cloudCover, spin: 0.0045 },
    { scale: 1.055, freq: 4.1, cover: bp.cloudCover * 0.55, spin: 0.007 },
  ];

  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]!;
    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uCover: { value: s.cover },
      uSeed: { value: ((bp.seed >>> (i * 8)) % 1000) / 10 },
      uFreq: { value: s.freq },
      uTint: { value: tint },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    };
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(surfaceRadius * s.scale, 96, 64),
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    group.add(mesh);
    layers.push({ mesh, uniforms, spin: s.spin });
  }

  return {
    group,
    update: (time, sunDir) => {
      for (const l of layers) {
        (l.uniforms['uTime'] as THREE.IUniform<number>).value = time;
        (l.uniforms['uSunDir'] as THREE.IUniform<THREE.Vector3>).value.copy(sunDir);
        l.mesh.rotation.y = time * l.spin;
      }
    },
    dispose: () => {
      for (const l of layers) {
        l.mesh.geometry.dispose();
        (l.mesh.material as THREE.Material).dispose();
      }
    },
  };
}
