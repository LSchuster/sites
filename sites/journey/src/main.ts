// Entry point: boot the 3D world, wire the input panel to the route builder
// and the HUD, and choreograph trace runs.

import './style.css';
import { classifyInput } from './net/parse';
import { buildRoute, type RouteResult } from './net/route';
import { loadEarthData } from './scene/globe';
import { World } from './scene/world';
import { Hud } from './ui/hud';
import { SAMPLE_EMAIL, SAMPLE_IP, SAMPLE_URL } from './ui/samples';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const input = document.getElementById('input') as HTMLTextAreaElement;
const traceButton = document.getElementById('trace') as HTMLButtonElement;
const loading = document.getElementById('loading') as HTMLDivElement;
const closeRoute = document.getElementById('close-route') as HTMLButtonElement;

const world = new World(canvas);
const hud = new Hud();

let currentRoute: RouteResult | null = null;
let tracing = false;

async function boot(): Promise<void> {
  try {
    const earth = await loadEarthData();
    world.setEarth(earth);
  } finally {
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 700);
  }
  // shareable links: ?q=<url | ip> starts a trace immediately
  const q = new URLSearchParams(location.search).get('q');
  if (q) {
    input.value = q;
    autoGrow();
    void runTrace();
  }
}
void boot();

// --- input handling --------------------------------------------------------

function autoGrow(): void {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, window.innerHeight * 0.4)}px`;
}
input.addEventListener('input', autoGrow);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !input.value.includes('\n')) {
    e.preventDefault();
    void runTrace();
  }
});

document.querySelectorAll<HTMLButtonElement>('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const sample = chip.dataset.sample;
    input.value = sample === 'ip' ? SAMPLE_IP : sample === 'email' ? SAMPLE_EMAIL : SAMPLE_URL;
    autoGrow();
    void runTrace();
  });
});

traceButton.addEventListener('click', () => void runTrace());

closeRoute.addEventListener('click', () => {
  world.clearRoute();
  currentRoute = null;
  hud.reset();
});

// --- trace runs ------------------------------------------------------------

async function runTrace(): Promise<void> {
  if (tracing) return;
  hud.setError(null);
  let classified;
  try {
    classified = classifyInput(input.value);
  } catch (err) {
    hud.setError(err instanceof Error ? err.message : String(err));
    return;
  }

  tracing = true;
  traceButton.disabled = true;
  document.body.classList.add('tracing');
  try {
    const route = await buildRoute(classified, (message) => hud.setStatus(message));
    currentRoute = route;
    hud.showRoute(route);
    const layer = world.showRoute(route.hops);
    layer.onHopReached = (i) => hud.markHopReached(i);
    layer.onFinished = () => hud.markHopReached(route.hops.length - 1);
  } catch (err) {
    hud.setStatus(null);
    hud.setError(err instanceof Error ? err.message : String(err));
  } finally {
    tracing = false;
    traceButton.disabled = false;
    document.body.classList.remove('tracing');
  }
}

// --- hop selection / hover -------------------------------------------------

function selectHop(index: number): void {
  const route = currentRoute;
  const layer = world.routeLayer;
  if (!route || !layer) return;
  hud.selectHop(route, index);
  layer.setSelected(index);
  const pos = layer.hopPositions[index];
  if (pos) world.flyToHop(pos);
}

hud.onHopSelected = selectHop;
world.onHopClick = selectHop;
world.onHopHover = (index, x, y) => {
  hud.showTooltip(index !== null && currentRoute ? (currentRoute.hops[index] ?? null) : null, x, y);
};
