// Two-shell atmosphere: an additive back-side halo (the glowing limb seen
// against space) and a subtle front-side fresnel haze over the surface. Both
// respond to the sun direction so the day side scatters brighter.

import * as THREE from 'three';
import type { PlanetBlueprint } from '../gen/blueprint';

export interface Atmosphere {
  group: THREE.Group;
  setSunDir(dir: THREE.Vector3): void;
  dispose(): void;
}

const HALO_VERT = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSunDir;
uniform float uDensity;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  // back side: normals face away from the camera, flip for the rim term
  float rim = pow(clamp(dot(viewDir, -vWorldNormal), 0.0, 1.0), 2.6);
  float sun = pow(clamp(dot(normalize(vWorldPos), uSunDir) * 0.5 + 0.55, 0.0, 1.0), 1.6);
  float glow = rim * (0.35 + 1.5 * sun) * uDensity;
  gl_FragColor = vec4(uColor * glow, glow);
}
`;

const HAZE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSunDir;
uniform float uDensity;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - clamp(dot(viewDir, vWorldNormal), 0.0, 1.0), 3.8);
  float sun = clamp(dot(vWorldNormal, uSunDir) * 0.6 + 0.5, 0.0, 1.0);
  float a = fres * (0.15 + 0.85 * sun) * uDensity * 0.75;
  gl_FragColor = vec4(uColor, a);
}
`;

export function buildAtmosphere(bp: PlanetBlueprint, surfaceRadius: number): Atmosphere {
  const color = new THREE.Color(bp.palette.atmosphere);
  const group = new THREE.Group();

  const haloUniforms = {
    uColor: { value: color },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uDensity: { value: bp.atmoDensity },
  };
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(surfaceRadius * 1.14, 96, 64),
    new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: haloUniforms,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const hazeUniforms = {
    uColor: { value: color },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uDensity: { value: bp.atmoDensity },
  };
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(surfaceRadius * 1.015, 96, 64),
    new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HAZE_FRAG,
      uniforms: hazeUniforms,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
    }),
  );

  group.add(halo, haze);

  return {
    group,
    setSunDir: (dir) => {
      haloUniforms.uSunDir.value.copy(dir);
      hazeUniforms.uSunDir.value.copy(dir);
    },
    dispose: () => {
      halo.geometry.dispose();
      (halo.material as THREE.Material).dispose();
      haze.geometry.dispose();
      (haze.material as THREE.Material).dispose();
    },
  };
}
