// Hover inspection: raycast city lights and moons, show which piece of data
// they represent. The sea-level occluder hides hits on the planet's far side.

import * as THREE from 'three';
import type { World } from '../scene/world';

const tip = () => document.getElementById('tip') as HTMLDivElement;

export function attachInspector(world: World, canvas: HTMLCanvasElement): void {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let px = 0;
  let py = 0;
  let dirty = false;

  canvas.addEventListener('pointermove', (e) => {
    px = e.clientX;
    py = e.clientY;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    dirty = true;
  });
  canvas.addEventListener('pointerleave', () => {
    tip().hidden = true;
  });

  let frameCount = 0;
  world.onFrame(() => {
    frameCount++;
    if (!dirty || frameCount % 3 !== 0) return;
    dirty = false;

    const sys = world.currentSystem;
    if (!sys) {
      tip().hidden = true;
      return;
    }

    raycaster.setFromCamera(pointer, world.camera);
    raycaster.params.Points.threshold = sys.blueprint.radius * 0.02;

    const targets: THREE.Object3D[] = [sys.surface.occluder, ...sys.moons.meshes];
    if (sys.cities.points) targets.push(sys.cities.points);
    const hits = raycaster.intersectObjects(targets, false);

    let html: string | null = null;
    for (const hit of hits) {
      const kind = hit.object.userData['kind'] as string | undefined;
      if (kind === 'occluder') break; // planet body blocks everything behind it
      if (kind === 'moon') {
        const spec = hit.object.userData['spec'] as { name: string; path: string; leaves: number };
        html =
          `<div class="tip-kind">moon · group</div>` +
          `<div class="tip-path">${escapeHtml(spec.path || spec.name)}</div>` +
          `<div class="tip-val">${spec.leaves.toLocaleString('en-US')} fields inside</div>`;
        break;
      }
      if (kind === 'cities' && hit.index !== undefined) {
        const spec = sys.cities.specs[hit.index];
        if (spec) {
          html =
            `<div class="tip-kind">city · field</div>` +
            `<div class="tip-path">${escapeHtml(spec.path)}</div>` +
            (spec.preview ? `<div class="tip-val">${escapeHtml(spec.preview)}</div>` : '');
        }
        break;
      }
    }

    const t = tip();
    if (html) {
      t.innerHTML = html;
      t.hidden = false;
      const flip = px > window.innerWidth - 340;
      t.style.left = `${px}px`;
      t.style.top = `${py}px`;
      t.style.transform = flip ? 'translate(calc(-100% - 14px), -50%)' : 'translate(14px, -50%)';
    } else {
      t.hidden = true;
    }
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
