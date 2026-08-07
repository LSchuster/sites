// Top-level groups become moons: cratered, displaced icospheres on inclined
// orbits. Each carries userData for the hover inspector ("which group am I?").

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplexNoise } from '../gen/noise';
import { Rng } from '../gen/rng';
import type { MoonSpec, PlanetBlueprint } from '../gen/blueprint';

export interface Moons {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  update(time: number): void;
  dispose(): void;
}

function buildMoonMesh(spec: MoonSpec, bp: PlanetBlueprint): THREE.Mesh {
  const rng = new Rng(spec.seed);
  const noise = new SimplexNoise(rng.fork());
  const craterNoise = new SimplexNoise(rng.fork());

  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 24);
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = BufferGeometryUtils.mergeVertices(geo, 1e-4);

  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const dir = new THREE.Vector3();

  // Moon tint: a desaturated cousin of the planet's rock, hue-shifted per moon.
  const base = new THREE.Color(bp.palette.landHigh);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  base.setHSL((hsl.h + rng.range(-0.06, 0.06) + 1) % 1, hsl.s * 0.35, 0.32 + rng.range(0, 0.25));
  const dark = base.clone().multiplyScalar(0.55);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const rough = noise.fbm(dir.x * 3.2, dir.y * 3.2, dir.z * 3.2, 4) * 0.5;
    // inverted ridged noise ≈ crater rims and pits
    const craters = (1 - craterNoise.ridged(dir.x * 2.2, dir.y * 2.2, dir.z * 2.2, 4)) * -0.35;
    const h = 1 + (rough + craters) * 0.09;
    pos.setXYZ(i, dir.x * h, dir.y * h, dir.z * h);
    c.copy(dark).lerp(base, 0.5 + rough + craters * 0.8);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 }),
  );
  mesh.scale.setScalar(spec.radius);
  mesh.userData['kind'] = 'moon';
  mesh.userData['spec'] = spec;
  return mesh;
}

export function buildMoons(bp: PlanetBlueprint): Moons {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const pivots: { pivot: THREE.Object3D; mesh: THREE.Mesh; spec: MoonSpec }[] = [];

  for (const spec of bp.moons) {
    const pivot = new THREE.Object3D();
    pivot.rotation.z = spec.inclination;
    const mesh = buildMoonMesh(spec, bp);
    mesh.position.set(spec.distance, 0, 0);
    pivot.add(mesh);
    group.add(pivot);
    pivots.push({ pivot, mesh, spec });
    meshes.push(mesh);
  }

  return {
    group,
    meshes,
    update: (time) => {
      for (const { pivot, mesh, spec } of pivots) {
        pivot.rotation.y = spec.phase + time * spec.speed;
        mesh.rotation.y = time * spec.speed * 4;
      }
    },
    dispose: () => {
      for (const { mesh } of pivots) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    },
  };
}
