// Deep-space backdrop: a few thousand twinkling stars with varied color
// temperature, plus faint palette-tinted nebula sprites so every world sits
// in a sky that matches its mood.

import * as THREE from 'three';
import { Rng } from '../gen/rng';
import type { Palette } from '../gen/blueprint';

export interface Starfield {
  group: THREE.Group;
  setPalette(p: Palette): void;
  update(time: number): void;
  dispose(): void;
}

const VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uScale;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vColor = aColor;
  vTwinkle = 0.75 + 0.25 * sin(uTime * (0.4 + aPhase) + aPhase * 80.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float a = exp(-r2 * 18.0) * vTwinkle;
  gl_FragColor = vec4(vColor, a);
}
`;

function makeNebulaTexture(hex: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = new THREE.Color(hex);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  grad.addColorStop(0, `rgba(${rgb},0.85)`);
  grad.addColorStop(0.4, `rgba(${rgb},0.28)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildStarfield(seed: number): Starfield {
  const rng = new Rng(seed ^ 0x57a5);
  const group = new THREE.Group();

  const COUNT = 5200;
  const positions = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const phases = new Float32Array(COUNT);
  const colors = new Float32Array(COUNT * 3);
  const c = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    // uniform on the sphere
    const z = rng.range(-1, 1);
    const t = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(1 - z * z);
    const R = 380;
    positions[i * 3] = Math.cos(t) * r * R;
    positions[i * 3 + 1] = z * R;
    positions[i * 3 + 2] = Math.sin(t) * r * R;
    const mag = Math.pow(rng.next(), 2.6);
    sizes[i] = 0.8 + mag * 3.4;
    phases[i] = rng.next();
    // color temperature: mostly white, some warm, some blue
    const k = rng.next();
    if (k < 0.12) c.setRGB(1, 0.75, 0.55);
    else if (k < 0.28) c.setRGB(0.65, 0.78, 1);
    else c.setRGB(0.92, 0.94, 1);
    c.multiplyScalar(0.55 + mag * 0.45);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
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
  const stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false;
  group.add(stars);

  // Nebulae — rebuilt whenever the palette changes.
  let nebulae: THREE.Sprite[] = [];
  let nebulaTextures: THREE.CanvasTexture[] = [];

  const clearNebulae = () => {
    for (const s of nebulae) {
      group.remove(s);
      s.material.dispose();
    }
    for (const t of nebulaTextures) t.dispose();
    nebulae = [];
    nebulaTextures = [];
  };

  const setPalette = (p: Palette) => {
    clearNebulae();
    const nrng = new Rng(seed ^ 0xeb1a);
    for (let i = 0; i < 3; i++) {
      const hex = p.nebula[i % 2]!;
      const tex = makeNebulaTexture(hex);
      nebulaTextures.push(tex);
      const mat2 = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.05 + nrng.next() * 0.055,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat2);
      const z = nrng.range(-0.7, 0.7);
      const t = nrng.range(0, Math.PI * 2);
      const r = Math.sqrt(1 - z * z);
      sprite.position.set(Math.cos(t) * r * 300, z * 300, Math.sin(t) * r * 300);
      sprite.scale.setScalar(nrng.range(190, 330));
      nebulae.push(sprite);
      group.add(sprite);
    }
  };

  return {
    group,
    setPalette,
    update: (time) => {
      (uniforms['uTime'] as THREE.IUniform<number>).value = time;
    },
    dispose: () => {
      clearNebulae();
      geo.dispose();
      mat.dispose();
    },
  };
}
