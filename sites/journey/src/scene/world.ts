// World: renderer, camera, postprocessing and scene composition. Owns the
// globe, the starfield and the current route layer; provides cinematic camera
// moves (fly-to-route, fly-to-hop) and pointer picking of hop markers.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import type { Hop } from '../net/route';
import { buildRouteLayer, type RouteLayer } from './arcs';
import { buildGlobe, type EarthData, type Globe } from './globe';
import { buildStarfield, type Starfield } from './stars';

interface CameraTween {
  fromDir: THREE.Vector3;
  toDir: THREE.Vector3;
  fromDist: number;
  toDist: number;
  t: number;
  duration: number;
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private readonly composer: EffectComposer;
  private readonly clock = new THREE.Clock();
  private readonly lightDir = new THREE.Vector3(1, 0.35, 0.6).normalize();
  private readonly starfield: Starfield;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  private globe: Globe | null = null;
  private route: RouteLayer | null = null;
  private fxaa!: ShaderPass;
  private tween: CameraTween | null = null;
  private frameCallbacks: Array<(time: number, dt: number) => void> = [];

  /** Hover callback: hop index (or null) + screen position of the marker. */
  onHopHover: ((index: number | null, x: number, y: number) => void) | null = null;
  onHopClick: ((index: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // MSAA happens on the composer's render target
      powerPreference: 'high-performance',
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x01030a);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 220);
    this.camera.position.set(0, 0.75, 3.4);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.45;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.3;
    this.controls.maxDistance = 7;

    this.starfield = buildStarfield();
    this.scene.add(this.starfield.points);

    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    // NO MSAA on the composer target: resolving a multisampled half-float
    // buffer through ANGLE/D3D causes transient black/white tile artifacts
    // on Windows drivers. Anti-aliasing is done by the FXAA pass instead,
    // which also softens the bright dot specks at the globe's silhouette.
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.65, 0.85, 0.68));
    this.composer.addPass(new OutputPass());
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa); // after OutputPass: FXAA wants LDR input

    canvas.addEventListener('pointermove', (e) => this.pick(e, false));
    canvas.addEventListener('click', (e) => this.pick(e, true));

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setEarth(data: EarthData): void {
    this.globe = buildGlobe(data);
    this.scene.add(this.globe.group);
  }

  onFrame(cb: (time: number, dt: number) => void): void {
    this.frameCallbacks.push(cb);
  }

  get routeLayer(): RouteLayer | null {
    return this.route;
  }

  showRoute(hops: Hop[]): RouteLayer {
    this.clearRoute();
    const layer = buildRouteLayer(hops);
    this.scene.add(layer.group);
    this.route = layer;
    this.controls.autoRotate = false;
    this.flyToRoute(layer.hopPositions);
    layer.play();
    return layer;
  }

  clearRoute(): void {
    if (!this.route) return;
    this.scene.remove(this.route.group);
    this.route.dispose();
    this.route = null;
    this.controls.autoRotate = true;
  }

  /** Frame the whole route: aim at its spherical centroid, back off to fit. */
  flyToRoute(positions: THREE.Vector3[]): void {
    if (!positions.length) return;
    const centroid = new THREE.Vector3();
    for (const p of positions) centroid.add(p.clone().normalize());
    if (centroid.lengthSq() < 1e-4) centroid.set(0, 0, 1); // antipodal fallback
    centroid.normalize();
    let maxAngle = 0;
    for (const p of positions) maxAngle = Math.max(maxAngle, centroid.angleTo(p.clone().normalize()));
    const distance = THREE.MathUtils.clamp(1.9 + maxAngle * 1.75, 2.1, 5.6);
    // keep a pleasant slight downward viewing angle
    const dir = centroid.clone();
    dir.y = THREE.MathUtils.clamp(dir.y + 0.18, -0.92, 0.92);
    this.startTween(dir.normalize(), distance, 2.0);
  }

  flyToHop(position: THREE.Vector3): void {
    this.startTween(position.clone().normalize(), 2.05, 1.4);
  }

  private startTween(toDir: THREE.Vector3, toDist: number, duration: number): void {
    const fromDist = this.camera.position.length();
    this.tween = {
      fromDir: this.camera.position.clone().normalize(),
      toDir: toDir.clone().normalize(),
      fromDist,
      toDist,
      t: 0,
      duration,
    };
  }

  private pick(event: PointerEvent | MouseEvent, isClick: boolean): void {
    const route = this.route;
    if (!route) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(route.pickMeshes, false);
    const first = hits[0];
    if (first) {
      const index = first.object.userData.hopIndex as number;
      // horizon test: a point at radius ~1 is visible from distance d only
      // when the angle to the camera direction is inside the horizon cone
      const camDist = this.camera.position.length();
      const facing = first.object.position
        .clone()
        .normalize()
        .dot(this.camera.position.clone().normalize());
      if (facing > 1 / camDist - 0.02) {
        if (isClick) this.onHopClick?.(index);
        else this.onHopHover?.(index, event.clientX, event.clientY);
        this.renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }
    this.renderer.domElement.style.cursor = '';
    if (!isClick) this.onHopHover?.(null, 0, 0);
  }

  /** Project a world position to CSS pixels; null when behind the camera. */
  projectToScreen(position: THREE.Vector3): { x: number; y: number } | null {
    const v = position.clone().project(this.camera);
    if (v.z > 1) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - v.y) / 2) * rect.height,
    };
  }

  private frame(): void {
    const dt = Math.min(0.1, this.clock.getDelta());
    const time = this.clock.elapsedTime;

    // slow drifting sun so the terminator crawls and city lights live
    this.lightDir.set(Math.cos(time * 0.014) * 0.9, 0.34, Math.sin(time * 0.014) * 0.9).normalize();

    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      const e = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - Math.pow(-2 * tw.t + 2, 3) / 2; // easeInOutCubic
      const qa = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tw.fromDir);
      const qb = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tw.toDir);
      const q = qa.clone().slerp(qb, e);
      const dist = THREE.MathUtils.lerp(tw.fromDist, tw.toDist, e);
      this.camera.position.set(0, 0, 1).applyQuaternion(q).multiplyScalar(dist);
      if (tw.t >= 1) this.tween = null;
    }

    this.globe?.update(time, this.lightDir);
    this.starfield.update(time);
    this.route?.update(time, dt);
    this.controls.update();
    for (const cb of this.frameCallbacks) cb(time, dt);
    this.composer.render();
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    const res = this.fxaa.material.uniforms['resolution']!.value as THREE.Vector2;
    res.set(1 / (w * pr), 1 / (h * pr));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
