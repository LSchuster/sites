import './style.css';
import { parseInput } from './data/parse';
import { profileData } from './data/profile';
import { buildBlueprint, type PlanetBlueprint } from './gen/blueprint';
import { World } from './scene/world';
import { attachInspector } from './ui/inspect';
import { SAMPLES } from './samples';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const canvas = $<HTMLCanvasElement>('stage');
const panel = $<HTMLElement>('panel');
const input = $<HTMLTextAreaElement>('data-input');
const errorBox = $<HTMLParagraphElement>('panel-error');
const dock = $<HTMLElement>('dock');
const stats = $<HTMLElement>('stats');
const dropveil = $<HTMLElement>('dropveil');
const toast = $<HTMLDivElement>('toast');

let world: World;
try {
  world = new World(canvas);
} catch {
  document.body.innerHTML =
    '<div style="position:fixed;inset:0;display:grid;place-items:center;padding:2rem;text-align:center;color:#dfe9f2;font-family:system-ui;background:#02040a">' +
    'Your browser could not create a WebGL context — dataplant needs one to grow planets.</div>';
  throw new Error('WebGL unavailable');
}
attachInspector(world, canvas);

let currentRaw: string | null = null;
let remixCount = 0;

function showToast(msg: string, ms = 2600): void {
  toast.textContent = msg;
  toast.hidden = false;
  window.setTimeout(() => (toast.hidden = true), ms);
}

function showError(msg: string): void {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function renderStats(bp: PlanetBlueprint): void {
  const p = bp.profile;
  const rows: Array<[string, string]> = [
    ['world', `${bp.palette.name} · seed ${bp.seed.toString(16)}`],
    ['source', `${p.parsed.format.toUpperCase()} · ${fmt(p.parsed.bytes)} bytes`],
    ['structures', `${fmt(p.leafCount)} fields · ${fmt(p.containerCount)} groups`],
    ['moons', bp.moons.length ? bp.moons.map((m) => m.name).slice(0, 4).join(', ') + (bp.moons.length > 4 ? '…' : '') : 'none'],
    ['city lights', fmt(Math.min(bp.cities.length, 3200))],
    ['rings', bp.ring ? 'yes — array-rich data' : 'no'],
  ];
  if (p.parsed.truncated) rows.push(['note', 'large input — first slice shown']);
  stats.innerHTML =
    '<div class="stats-title">This world</div>' +
    rows.map(([k, v]) => `${k} <span class="v">${escapeHtml(v)}</span>`).join('<br>');
  stats.hidden = false;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generate(raw: string, remix = 0): void {
  errorBox.hidden = true;
  try {
    const parsed = parseInput(raw);
    const profile = profileData(parsed, raw);
    const bp = buildBlueprint(profile, remix);
    world.setBlueprint(bp);
    currentRaw = raw;
    renderStats(bp);
    panel.classList.add('hidden');
    dock.hidden = false;
    showToast(`A ${bp.palette.name.toLowerCase()} world has formed — drag to explore`);
  } catch (e) {
    showError(e instanceof Error ? e.message : 'That data resisted terraforming. Try another paste.');
    panel.classList.remove('hidden');
  }
}

// --- panel wiring -----------------------------------------------------------

$<HTMLButtonElement>('generate-btn').addEventListener('click', () => {
  remixCount = 0;
  generate(input.value);
});

$<HTMLButtonElement>('panel-close').addEventListener('click', () => {
  panel.classList.add('hidden');
});

for (const chip of document.querySelectorAll<HTMLButtonElement>('.chip')) {
  chip.addEventListener('click', () => {
    const sample = SAMPLES[chip.dataset['sample'] ?? ''];
    if (sample) {
      input.value = sample;
      remixCount = 0;
      generate(sample);
    }
  });
}

const fileInput = $<HTMLInputElement>('file-input');
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  await loadFile(file);
  fileInput.value = '';
});

async function loadFile(file: File): Promise<void> {
  if (file.size > 32 * 1024 * 1024) {
    showError('That file is over 32 MB — export a smaller slice and try again.');
    panel.classList.remove('hidden');
    return;
  }
  const text = await file.text();
  input.value = text.length > 400_000 ? text.slice(0, 400_000) : text;
  remixCount = 0;
  generate(text);
}

// --- dock -------------------------------------------------------------------

$<HTMLButtonElement>('dock-data').addEventListener('click', () => {
  panel.classList.toggle('hidden');
});

$<HTMLButtonElement>('dock-remix').addEventListener('click', () => {
  if (currentRaw === null) return;
  remixCount++;
  generate(currentRaw, remixCount);
});

$<HTMLButtonElement>('dock-export').addEventListener('click', async () => {
  const sys = world.currentSystem;
  if (!sys) return;
  showToast('Rendering high-resolution image…');
  try {
    const blob = await world.exportPNG();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dataplant-${sys.blueprint.palette.name.toLowerCase()}-${sys.blueprint.seed.toString(16)}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    showToast('Saved — your world, framed.');
  } catch {
    showToast('Export failed — try a smaller window.');
  }
});

// --- drag & drop ------------------------------------------------------------

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  dropveil.hidden = false;
});
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropveil.hidden = true;
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropveil.hidden = true;
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    await loadFile(file);
    return;
  }
  const text = e.dataTransfer?.getData('text/plain');
  if (text) {
    input.value = text;
    remixCount = 0;
    generate(text);
  }
});

// --- keyboard ---------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!panel.classList.contains('hidden')) panel.classList.add('hidden');
    else panel.classList.remove('hidden');
  }
});

// --- first impression: grow a world from the page's own description ---------

const GENESIS = JSON.stringify({
  dataplant: 'turn data into a planet',
  how: ['paste JSON, CSV or text', 'watch a world form', 'explore and export it'],
  mapping: {
    volume: 'planet size',
    groups: 'moons',
    fields: 'city lights',
    types: 'biome and oceans',
    depth: 'clouds',
    arrays: 'rings',
  },
  private: true,
  server_calls: 0,
});
// `?sample=json|csv|text` deep-links a sample world (also handy for testing).
const sampleParam = new URLSearchParams(location.search).get('sample');
const initial = SAMPLES[sampleParam ?? ''] ?? GENESIS;
if (SAMPLES[sampleParam ?? '']) input.value = initial;
generate(initial);
panel.classList.remove('hidden'); // keep the invitation on screen at launch
