// Route visualization: elevated great-circle arcs revealed hop by hop, a
// "hero" packet that rides the reveal, an ambient packet stream afterwards,
// and pulsing hop markers. All glow values run >1.0 so bloom picks them up.

import * as THREE from 'three';
import { latLonToVec3 } from '../geo/coords';
import type { Hop, HopRole } from '../net/route';

const ROLE_COLORS: Record<HopRole, number> = {
  origin: 0x34d399,
  isp: 0x22d3ee,
  exchange: 0x38bdf8,
  transit: 0x818cf8,
  cdn: 0xc084fc,
  relay: 0x38bdf8,
  destination: 0xfb7185,
};

const ROUTE_GRADIENT = [
  new THREE.Color(0x22d3ee),
  new THREE.Color(0x60a5fa),
  new THREE.Color(0xa78bfa),
  new THREE.Color(0xfb7185),
];

function gradientColor(t: number): THREE.Color {
  const x = THREE.MathUtils.clamp(t, 0, 1) * (ROUTE_GRADIENT.length - 1);
  const i = Math.min(ROUTE_GRADIENT.length - 2, Math.floor(x));
  return ROUTE_GRADIENT[i]!.clone().lerp(ROUTE_GRADIENT[i + 1]!, x - i);
}

interface Segment {
  points: THREE.Vector3[]; // sampled arc, equal arc-length-ish steps
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  duration: number; // seconds in the reveal timeline
  length: number; // radians of great-circle angle
}

export interface RouteLayer {
  group: THREE.Group;
  hopPositions: THREE.Vector3[];
  pickMeshes: THREE.Mesh[];
  /** Restart the hop-by-hop reveal animation. */
  play(): void;
  /** Skip the reveal and light the whole route. */
  finish(): void;
  setSelected(index: number | null): void;
  update(time: number, dt: number): void;
  dispose(): void;
  onHopReached: ((index: number) => void) | null;
  onFinished: (() => void) | null;
}

function sampleArc(a: THREE.Vector3, b: THREE.Vector3, samples = 96): THREE.Vector3[] {
  const angle = a.angleTo(b);
  const lift = Math.min(0.5, 0.028 + Math.pow(angle / Math.PI, 0.75) * 0.42);
  const points: THREE.Vector3[] = [];
  const qa = a.clone().normalize();
  const qb = b.clone().normalize();
  const omega = Math.max(1e-5, qa.angleTo(qb));
  const sinOmega = Math.sin(omega);
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    // spherical interpolation between the two unit vectors
    const dir = qa
      .clone()
      .multiplyScalar(Math.sin((1 - t) * omega) / sinOmega)
      .addScaledVector(qb, Math.sin(t * omega) / sinOmega)
      .normalize();
    const altitude = 1.004 + Math.sin(Math.PI * t) * lift;
    points.push(dir.multiplyScalar(altitude));
  }
  return points;
}

function pointOnPolyline(points: THREE.Vector3[], t: number, out: THREE.Vector3): THREE.Vector3 {
  const x = THREE.MathUtils.clamp(t, 0, 1) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(x));
  return out.copy(points[i]!).lerp(points[i + 1]!, x - i);
}

function makeArcMaterial(colorA: THREE.Color, colorB: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uAmbient: { value: 0 },
      uColorA: { value: colorA },
      uColorB: { value: colorB },
    },
    vertexShader: /* glsl */ `
      attribute float aT;
      varying float vT;
      void main() {
        vT = aT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uProgress;
      uniform float uTime;
      uniform float uAmbient;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying float vT;
      void main() {
        if (vT > uProgress) discard;
        vec3 color = mix(uColorA, uColorB, vT);
        // bright head while revealing
        float head = exp(-(uProgress - vT) * 26.0) * (1.0 - uAmbient);
        // flowing pulses once the route is lit
        float pulse = pow(0.5 + 0.5 * sin(vT * 34.0 - uTime * 2.6), 3.0) * uAmbient;
        float glow = 0.55 + head * 3.2 + pulse * 0.9;
        float alpha = 0.5 + head * 0.5 + pulse * 0.35;
        gl_FragColor = vec4(color * glow, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function addTubeTAttribute(geometry: THREE.BufferGeometry, tubularSegments: number, radialSegments: number): void {
  const count = geometry.getAttribute('position').count;
  const ts = new Float32Array(count);
  // TubeGeometry vertex order: ring i (0..tubularSegments) × (radialSegments + 1)
  const ringSize = radialSegments + 1;
  for (let v = 0; v < count; v++) {
    ts[v] = Math.min(1, Math.floor(v / ringSize) / tubularSegments);
  }
  geometry.setAttribute('aT', new THREE.BufferAttribute(ts, 1));
}

function makeGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(200,225,255,0.55)');
  grad.addColorStop(1, 'rgba(120,160,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const PULSE_SHADER = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uPhase;
    uniform float uBoost;
    varying vec2 vUv;
    void main() {
      float r = length(vUv - 0.5) * 2.0;
      float cycle = fract(uTime * 0.45 + uPhase);
      float ringR = cycle;
      float ring = smoothstep(0.09, 0.0, abs(r - ringR)) * (1.0 - cycle);
      float core = smoothstep(0.16, 0.0, r) * 1.4;
      float v = (ring * 0.9 + core) * (1.0 + uBoost);
      if (v < 0.01) discard;
      gl_FragColor = vec4(uColor * (0.8 + uBoost) * v, v);
    }
  `,
};

export function buildRouteLayer(hops: Hop[]): RouteLayer {
  const group = new THREE.Group();
  const hopPositions = hops.map((h) => latLonToVec3(h.lat, h.lon, 1.004));

  // --- arcs -----------------------------------------------------------
  const segments: Segment[] = [];
  const n = hops.length;
  for (let i = 0; i + 1 < n; i++) {
    const a = hopPositions[i]!;
    const b = hopPositions[i + 1]!;
    const points = sampleArc(a, b);
    const curve = new THREE.CatmullRomCurve3(points);
    const tubular = 90;
    const radial = 6;
    const geometry = new THREE.TubeGeometry(curve, tubular, 0.0034, radial, false);
    addTubeTAttribute(geometry, tubular, radial);
    const material = makeArcMaterial(gradientColor(i / Math.max(1, n - 1)), gradientColor((i + 1) / Math.max(1, n - 1)));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 5;
    group.add(mesh);
    const length = a.angleTo(b);
    segments.push({ points, mesh, material, duration: 0.45 + length * 1.7, length });
  }
  // normalize the reveal to a cinematic 3.5–8.5 s
  const rawTotal = segments.reduce((s, seg) => s + seg.duration, 0);
  const scale = rawTotal > 0 ? THREE.MathUtils.clamp(rawTotal, 3.5, 8.5) / rawTotal : 1;
  for (const seg of segments) seg.duration *= scale;

  // --- markers --------------------------------------------------------
  const pickMeshes: THREE.Mesh[] = [];
  const pulseMaterials: THREE.ShaderMaterial[] = [];
  const coreMeshes: THREE.Mesh[] = [];
  const markerGroup = new THREE.Group();
  const coreGeometry = new THREE.SphereGeometry(0.0075, 16, 16);
  const pulseGeometry = new THREE.PlaneGeometry(0.085, 0.085);
  const pickGeometry = new THREE.SphereGeometry(0.035, 8, 8);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  hops.forEach((hop, i) => {
    const color = new THREE.Color(ROLE_COLORS[hop.role]);
    const pos = hopPositions[i]!;

    const core = new THREE.Mesh(
      coreGeometry,
      new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.2) }),
    );
    core.position.copy(pos);
    core.renderOrder = 6;
    coreMeshes.push(core);

    const pulseMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: color },
        uTime: { value: 0 },
        uPhase: { value: i * 0.23 },
        uBoost: { value: 0 },
      },
      ...PULSE_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
    pulse.position.copy(pos.clone().multiplyScalar(1.002));
    pulse.lookAt(pos.clone().multiplyScalar(2));
    pulse.renderOrder = 7;
    pulseMaterials.push(pulseMaterial);

    const pick = new THREE.Mesh(pickGeometry, pickMaterial);
    pick.position.copy(pos);
    pick.userData.hopIndex = i;
    pickMeshes.push(pick);

    markerGroup.add(core, pulse, pick);
  });
  group.add(markerGroup);

  // --- packets --------------------------------------------------------
  const glowTexture = makeGlowTexture();
  const hero = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  hero.scale.setScalar(0.055);
  hero.visible = false;
  hero.renderOrder = 8;
  group.add(hero);

  interface StreamPacket {
    segment: number;
    offset: number;
    speed: number;
  }
  const streamPackets: StreamPacket[] = [];
  segments.forEach((seg, i) => {
    const count = Math.max(2, Math.round(seg.length * 9));
    for (let k = 0; k < count; k++) {
      streamPackets.push({ segment: i, offset: k / count, speed: 0.22 / Math.max(0.12, seg.duration) });
    }
  });
  const streamGeometry = new THREE.BufferGeometry();
  streamGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(streamPackets.length * 3), 3),
  );
  const streamMaterial = new THREE.PointsMaterial({
    map: glowTexture,
    color: 0xbfdcff,
    size: 0.022,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const stream = new THREE.Points(streamGeometry, streamMaterial);
  stream.visible = false;
  stream.renderOrder = 8;
  group.add(stream);

  // --- timeline -------------------------------------------------------
  let mode: 'hidden' | 'revealing' | 'ambient' = 'hidden';
  let elapsed = 0;
  let reachedHop = -1;
  let selected: number | null = null;
  const tmp = new THREE.Vector3();

  const layer: RouteLayer = {
    group,
    hopPositions,
    pickMeshes,
    onHopReached: null,
    onFinished: null,

    play() {
      mode = 'revealing';
      elapsed = 0;
      reachedHop = -1;
      hero.visible = true;
      stream.visible = false;
      for (const seg of segments) {
        seg.material.uniforms.uProgress!.value = 0;
        seg.material.uniforms.uAmbient!.value = 0;
      }
    },

    finish() {
      mode = 'ambient';
      hero.visible = false;
      stream.visible = true;
      for (const seg of segments) {
        seg.material.uniforms.uProgress!.value = 1;
        seg.material.uniforms.uAmbient!.value = 1;
      }
    },

    setSelected(index) {
      selected = index;
    },

    update(time, dt) {
      pulseMaterials.forEach((m, i) => {
        m.uniforms.uTime!.value = time;
        m.uniforms.uBoost!.value = selected === i ? 1.6 : 0;
      });
      coreMeshes.forEach((mesh, i) => {
        const s = selected === i ? 1.9 : 1;
        mesh.scale.setScalar(s + Math.sin(time * 3 + i) * 0.08);
      });
      for (const seg of segments) seg.material.uniforms.uTime!.value = time;

      if (mode === 'revealing') {
        if (reachedHop < 0) {
          reachedHop = 0;
          layer.onHopReached?.(0);
        }
        elapsed += dt;
        let t = elapsed;
        let done = true;
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]!;
          if (t <= 0) {
            done = false;
            break;
          }
          const progress = Math.min(1, t / seg.duration);
          seg.material.uniforms.uProgress!.value = progress;
          if (progress < 1) {
            pointOnPolyline(seg.points, progress, tmp);
            hero.position.copy(tmp);
            done = false;
            break;
          }
          if (reachedHop < i + 1) {
            reachedHop = i + 1;
            layer.onHopReached?.(i + 1);
          }
          t -= seg.duration;
        }
        if (done) {
          layer.finish();
          layer.onFinished?.();
        }
      }

      if (mode === 'ambient') {
        const attr = streamGeometry.getAttribute('position') as THREE.BufferAttribute;
        streamPackets.forEach((p, i) => {
          p.offset = (p.offset + p.speed * dt) % 1;
          const seg = segments[p.segment]!;
          pointOnPolyline(seg.points, p.offset, tmp);
          attr.setXYZ(i, tmp.x, tmp.y, tmp.z);
        });
        attr.needsUpdate = true;
      }
    },

    dispose() {
      for (const seg of segments) {
        seg.mesh.geometry.dispose();
        seg.material.dispose();
      }
      for (const m of pulseMaterials) m.dispose();
      for (const mesh of coreMeshes) (mesh.material as THREE.Material).dispose();
      coreGeometry.dispose();
      pulseGeometry.dispose();
      pickGeometry.dispose();
      pickMaterial.dispose();
      hero.material.dispose();
      streamGeometry.dispose();
      streamMaterial.dispose();
      glowTexture.dispose();
    },
  };
  return layer;
}
