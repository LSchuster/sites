// World: owns the renderer, camera, postprocessing chain and the currently
// grown planetary system. `setBlueprint()` tears down the old system and
// builds the new one; the animation loop drives orbits, weather and lights.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { PlanetBlueprint } from '../gen/blueprint';
import { buildPlanet, type PlanetSurface } from './planet';
import { buildAtmosphere, type Atmosphere } from './atmosphere';
import { buildClouds, type Clouds } from './clouds';
import { buildCities, type CityLights } from './cities';
import { buildMoons, type Moons } from './moons';
import { buildRings, type Rings } from './rings';
import { buildStarfield, type Starfield } from './stars';

interface PlanetSystem {
  blueprint: PlanetBlueprint;
  root: THREE.Group;
  surface: PlanetSurface;
  atmosphere: Atmosphere;
  clouds: Clouds;
  cities: CityLights;
  moons: Moons;
  rings: Rings | null;
  spinGroup: THREE.Group;
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly sun: THREE.DirectionalLight;
  private readonly sunDir = new THREE.Vector3(1, 0, 0);
  private readonly starfield: Starfield;
  private readonly clock = new THREE.Clock();
  private readonly pmrem: THREE.PMREMGenerator;

  private system: PlanetSystem | null = null;
  private introFrom = 0;
  private introTo = 0;
  private introT = 1; // 0..1, 1 = finished
  private frameCallbacks: Array<(time: number) => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // MSAA happens on the composer's render target
      preserveDrawingBuffer: true, // needed for PNG export
      powerPreference: 'high-performance',
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1200);
    this.camera.position.set(0, 2.2, 9);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.25;
    this.controls.enablePan = false;

    // Soft studio environment for tasteful PBR speculars (ocean glint).
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.15;

    this.sun = new THREE.DirectionalLight(0xfff3e0, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(new THREE.HemisphereLight(0x35507a, 0x0a0d18, 0.14));

    this.starfield = buildStarfield(0x5eed);
    this.scene.add(this.starfield.group);

    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      samples: 8,
      type: THREE.HalfFloatType,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.75, 0.72);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  onFrame(cb: (time: number) => void): void {
    this.frameCallbacks.push(cb);
  }

  get currentSystem(): PlanetSystem | null {
    return this.system;
  }

  setBlueprint(bp: PlanetBlueprint): void {
    this.disposeSystem();

    const surface = buildPlanet(bp);
    const atmosphere = buildAtmosphere(bp, surface.maxRadius);
    const clouds = buildClouds(bp, surface.maxRadius * 0.995);
    const cities = buildCities(bp, surface);
    const moons = buildMoons(bp);
    const rings = bp.ring ? buildRings(bp, bp.ring) : null;

    surface.land.castShadow = true;
    surface.land.receiveShadow = true;
    surface.ocean.receiveShadow = true;
    for (const m of moons.meshes) {
      m.castShadow = true;
      m.receiveShadow = true;
    }

    const spinGroup = new THREE.Group();
    spinGroup.add(surface.group, clouds.group, atmosphere.group);
    if (cities.points) spinGroup.add(cities.points);

    const root = new THREE.Group();
    root.rotation.z = bp.axialTilt;
    root.add(spinGroup, moons.group);
    if (rings) root.add(rings.mesh);
    this.scene.add(root);

    // Sun placement + shadow frustum sized to the system.
    this.sunDir
      .set(
        Math.cos(bp.sunElevation) * Math.cos(bp.sunAzimuth),
        Math.sin(bp.sunElevation),
        Math.cos(bp.sunElevation) * Math.sin(bp.sunAzimuth),
      )
      .normalize();
    this.sun.position.copy(this.sunDir).multiplyScalar(40);
    this.sun.target.position.set(0, 0, 0);
    const span = Math.max(bp.radius * 4, ...bp.moons.map((m) => m.distance + m.radius));
    const cam = this.sun.shadow.camera;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.near = 10;
    cam.far = 80;
    cam.updateProjectionMatrix();

    atmosphere.setSunDir(this.sunDir);

    this.starfield.setPalette(bp.palette);

    this.system = { blueprint: bp, root, surface, atmosphere, clouds, cities, moons, rings, spinGroup };

    // cinematic approach
    const target = bp.ring ? bp.radius * 4.4 : bp.radius * 3.6;
    this.introFrom = bp.radius * 11;
    this.introTo = target;
    this.introT = 0;
    this.controls.minDistance = surface.maxRadius * 1.25;
    this.controls.maxDistance = bp.radius * 14;
    this.controls.target.set(0, 0, 0);
  }

  private frame(): void {
    const time = this.clock.getElapsedTime();
    const sys = this.system;

    if (this.introT < 1) {
      this.introT = Math.min(1, this.introT + 0.005); // ~3.5 s approach at 60 fps
      const e = 1 - Math.pow(1 - this.introT, 3); // ease-out cubic
      const d = this.introFrom + (this.introTo - this.introFrom) * e;
      const dirV = this.camera.position.clone().normalize();
      if (dirV.lengthSq() < 0.5) dirV.set(0, 0.28, 1).normalize();
      dirV.y = THREE.MathUtils.lerp(0.5, 0.22, e);
      this.camera.position.copy(dirV.normalize().multiplyScalar(d));
    }

    if (sys) {
      sys.spinGroup.rotation.y = time * 0.012;
      sys.clouds.update(time, this.sunDir);
      sys.cities.update(time, this.sunDir);
      sys.moons.update(time);
      sys.rings?.update(time, this.sunDir);
    }
    this.starfield.update(time);
    this.controls.update();
    for (const cb of this.frameCallbacks) cb(time);
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
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Render one frame at export resolution and return it as a PNG blob. */
  async exportPNG(maxDim = 3200): Promise<Blob> {
    const w0 = window.innerWidth;
    const h0 = window.innerHeight;
    const scale = Math.min(maxDim / Math.max(w0, h0), 4);
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(1);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.render();

    const blob = await new Promise<Blob | null>((resolve) =>
      this.renderer.domElement.toBlob((b) => resolve(b), 'image/png'),
    );
    this.resize();
    if (!blob) throw new Error('Could not capture the image.');
    return blob;
  }

  private disposeSystem(): void {
    const sys = this.system;
    if (!sys) return;
    this.scene.remove(sys.root);
    sys.surface.dispose();
    sys.atmosphere.dispose();
    sys.clouds.dispose();
    sys.cities.dispose();
    sys.moons.dispose();
    sys.rings?.dispose();
    this.system = null;
  }
}
