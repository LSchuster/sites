// The Earth: shader ocean, dot-matrix landmass generated from the land
// bitmask, glowing coastlines, an inner atmosphere rim, a soft outer halo
// sprite and a slowly drifting procedural cloud shell.

import * as THREE from 'three';
import { latLonToVec3 } from '../geo/coords';
import { SIMPLEX_3D } from './glsl';

export interface EarthData {
  maskWidth: number;
  maskHeight: number;
  mask: Uint8Array;
  coastlines: Float32Array[]; // flat [lat, lon, lat, lon, ...] per polyline
}

export interface Globe {
  group: THREE.Group;
  update(time: number, lightDir: THREE.Vector3): void;
  dispose(): void;
}

export async function loadEarthData(): Promise<EarthData> {
  const [landRes, coastRes] = await Promise.all([
    fetch('./earth/land.bin'),
    fetch('./earth/coast.bin'),
  ]);
  if (!landRes.ok || !coastRes.ok) throw new Error('Could not load earth data.');
  const land = new DataView(await landRes.arrayBuffer());
  const maskWidth = land.getUint16(0, true);
  const maskHeight = land.getUint16(2, true);
  const mask = new Uint8Array(land.buffer, 4);

  const coast = new DataView(await coastRes.arrayBuffer());
  const coastlines: Float32Array[] = [];
  let offset = 4;
  const ringCount = coast.getUint32(0, true);
  for (let r = 0; r < ringCount; r++) {
    const n = coast.getUint16(offset, true);
    offset += 2;
    const line = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      line[i * 2] = coast.getInt16(offset, true) / 120;
      line[i * 2 + 1] = coast.getInt16(offset + 2, true) / 120;
      offset += 4;
    }
    coastlines.push(line);
  }
  return { maskWidth, maskHeight, mask, coastlines };
}

function isLand(data: EarthData, lat: number, lon: number): boolean {
  const x = Math.min(data.maskWidth - 1, Math.max(0, Math.floor(((lon + 180) / 360) * data.maskWidth)));
  const y = Math.min(data.maskHeight - 1, Math.max(0, Math.floor(((90 - lat) / 180) * data.maskHeight)));
  const bit = y * data.maskWidth + x;
  return ((data.mask[bit >> 3] ?? 0) & (0x80 >> (bit & 7))) !== 0;
}

// Small deterministic hash so the dot jitter is stable between sessions.
function hash(i: number, j: number): number {
  let h = (i * 374761393 + j * 668265263) >>> 0;
  h = (h ^ (h >> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// ------------------------------------------------------------------- ocean

function buildOcean(): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldNormal;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLightDir;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldNormal;
      void main() {
        float day = clamp(dot(vWorldNormal, uLightDir), -1.0, 1.0);
        float lit = smoothstep(-0.35, 0.6, day);

        vec3 deep = vec3(0.008, 0.023, 0.058);
        vec3 shallow = vec3(0.030, 0.082, 0.160);
        vec3 base = mix(deep, shallow, lit);

        // subtle specular sun glint
        vec3 lightView = normalize((viewMatrix * vec4(uLightDir, 0.0)).xyz);
        vec3 halfway = normalize(lightView + vViewDir);
        float spec = pow(max(dot(vNormal, halfway), 0.0), 42.0) * 0.35 * lit;

        // fresnel rim — the inner edge of the atmosphere
        float rim = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.2);
        vec3 rimColor = vec3(0.22, 0.55, 1.0) * rim * 0.9;

        gl_FragColor = vec4(base + spec * vec3(0.9, 0.95, 1.0) + rimColor, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), material);
  mesh.renderOrder = 0;
  return { mesh, material };
}

// ---------------------------------------------------------------- land dots

function buildLandDots(data: EarthData): { points: THREE.Points; material: THREE.ShaderMaterial } {
  const positions: number[] = [];
  const rnds: number[] = [];
  const latStep = 0.5;
  for (let ring = 0; ; ring++) {
    const lat = -84 + ring * latStep;
    if (lat > 84) break;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const count = Math.max(1, Math.floor((360 * cosLat) / latStep));
    const lonStep = 360 / count;
    const phase = (ring % 2) * 0.5;
    for (let i = 0; i < count; i++) {
      const lon = -180 + (i + phase) * lonStep;
      const jLat = (hash(ring, i) - 0.5) * latStep * 0.55;
      const jLon = (hash(i, ring) - 0.5) * lonStep * 0.55;
      if (!isLand(data, lat + jLat, lon + jLon)) continue;
      const v = latLonToVec3(lat + jLat, lon + jLon, 1.002);
      positions.push(v.x, v.y, v.z);
      rnds.push(hash(ring * 7919, i * 104729));
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('aRnd', new THREE.BufferAttribute(new Float32Array(rnds), 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uLightDir: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute float aRnd;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec3 uLightDir;
      varying float vRnd;
      varying float vDay;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vRnd = aRnd;
        vDay = smoothstep(-0.3, 0.55, dot(normalize(mat3(modelMatrix) * position), uLightDir));
        gl_PointSize = (1.85 + aRnd * 1.1) * uPixelRatio * (3.3 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying float vRnd;
      varying float vDay;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float alpha = smoothstep(0.5, 0.18, length(uv));
        // daytime land: cool cyan matrix; night side: dim, except sparse warm
        // "city light" dots that glow and gently flicker
        vec3 dayColor = mix(vec3(0.16, 0.45, 0.72), vec3(0.35, 0.75, 1.0), vRnd);
        vec3 nightBase = vec3(0.05, 0.11, 0.22);
        float city = step(0.915, vRnd);
        float flicker = 0.8 + 0.2 * sin(uTime * (1.0 + vRnd * 3.0) + vRnd * 40.0);
        vec3 cityColor = vec3(1.0, 0.72, 0.35) * (1.6 * flicker);
        vec3 night = mix(nightBase, cityColor, city);
        vec3 color = mix(night, dayColor, vDay);
        gl_FragColor = vec4(color, alpha * (0.55 + 0.45 * vDay + 0.5 * city * (1.0 - vDay)));
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 2;
  return { points, material };
}

// --------------------------------------------------------------- coastlines

function buildCoastlines(data: EarthData): { lines: THREE.LineSegments; material: THREE.LineBasicMaterial } {
  const positions: number[] = [];
  for (const line of data.coastlines) {
    const n = line.length / 2;
    for (let i = 0; i + 1 < n; i++) {
      const a = latLonToVec3(line[i * 2]!, line[i * 2 + 1]!, 1.004);
      const b = latLonToVec3(line[(i + 1) * 2]!, line[(i + 1) * 2 + 1]!, 1.004);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(0.2, 0.62, 0.95),
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 1;
  return { lines, material };
}

// ------------------------------------------------------------------- clouds

function buildClouds(): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vWorldNormal;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vPos = position;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vNormalV = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uLightDir;
      varying vec3 vPos;
      varying vec3 vWorldNormal;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      ${SIMPLEX_3D}
      void main() {
        vec3 p = vPos * 3.2 + vec3(uTime * 0.008, 0.0, uTime * 0.005);
        float n = fbm(p);
        float cover = smoothstep(0.2, 0.7, n);
        float lit = smoothstep(-0.25, 0.55, dot(vWorldNormal, uLightDir));
        // fade clouds at the silhouette so the rim glow stays clean
        float facing = max(dot(vNormalV, vViewDir), 0.0);
        float edgeFade = smoothstep(0.08, 0.35, facing);
        vec3 color = mix(vec3(0.35, 0.45, 0.62), vec3(0.85, 0.92, 1.0), lit);
        gl_FragColor = vec4(color, cover * edgeFade * (0.04 + 0.11 * lit));
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.018, 72, 72), material);
  mesh.renderOrder = 3;
  return { mesh, material };
}

// ---------------------------------------------------------------- halo glow

function makeHaloTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(60, 140, 255, 0.55)');
  grad.addColorStop(0.35, 'rgba(45, 110, 230, 0.22)');
  grad.addColorStop(0.7, 'rgba(30, 70, 180, 0.06)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ------------------------------------------------------------------- public

export function buildGlobe(data: EarthData): Globe {
  const group = new THREE.Group();

  const ocean = buildOcean();
  const dots = buildLandDots(data);
  const coast = buildCoastlines(data);
  const clouds = buildClouds();

  const haloTexture = makeHaloTexture();
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      // depthTest stays ON: the globe must occlude the halo so it reads as a
      // rim glow, not a wash over the whole disc.
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(3.5);
  halo.renderOrder = -5;

  group.add(halo, ocean.mesh, coast.lines, dots.points, clouds.mesh);

  return {
    group,
    update(time, lightDir) {
      const pr = Math.min(2, window.devicePixelRatio || 1);
      dots.material.uniforms.uTime!.value = time;
      dots.material.uniforms.uPixelRatio!.value = pr;
      (dots.material.uniforms.uLightDir!.value as THREE.Vector3).copy(lightDir);
      (ocean.material.uniforms.uLightDir!.value as THREE.Vector3).copy(lightDir);
      clouds.material.uniforms.uTime!.value = time;
      (clouds.material.uniforms.uLightDir!.value as THREE.Vector3).copy(lightDir);
      clouds.mesh.rotation.y = time * 0.004;
    },
    dispose() {
      for (const obj of [ocean.mesh, dots.points, coast.lines, clouds.mesh]) {
        (obj.geometry as THREE.BufferGeometry).dispose();
      }
      ocean.material.dispose();
      dots.material.dispose();
      coast.material.dispose();
      clouds.material.dispose();
      haloTexture.dispose();
      halo.material.dispose();
    },
  };
}
