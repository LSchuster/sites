/**
 * Screenshot the running app via the Chrome DevTools Protocol.
 *
 * Why not `--screenshot`? That flag needs `--virtual-time-budget` to wait for
 * async work, and under virtual time this browser never fires requestAnimationFrame
 * — so the canvas is captured blank no matter how long you wait. Driving CDP lets
 * the page run on real time, where the rAF render loop behaves normally.
 *
 * No dependencies: Node 22 ships a global WebSocket.
 *
 * Usage: node tools/shot.mjs <url> <out.png> [waitMs] [width] [height] [click] [evalJs] [wheel]
 *   click:  "x,y" or "x,y;x,y" — clicks before capturing
 *   evalJs: JS run after load, before clicks — e.g. set the locale:
 *           "localStorage.setItem('conflicts.locale','de'); location.reload()"
 *   wheel:  "x,y,deltaY" or several separated by ";" — zooms before clicks
 *           (battle dots only exist past zoom 1.8)
 */
import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [
  ,
  ,
  url = 'http://localhost:5173/',
  out = 'shot.png',
  waitMs = '3500',
  w = '1500',
  h = '950',
  click = '', // "x,y" — clicks before capturing, for testing selection/hover
  evalJs = '',
  wheel = '',
] = process.argv;

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
const PROFILE = join(tmpdir(), `cdp-shot-${Date.now()}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

const browser = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    `--window-size=${w},${h}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  // Wait for the debugging endpoint to come up.
  let version = null;
  for (let i = 0; i < 60; i++) {
    try {
      version = await getJson('/json/version');
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!version) throw new Error('DevTools endpoint never became ready');

  const targets = await getJson('/json/list');
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new CDP(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Surface page errors instead of silently screenshotting a broken page.
  const errors = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: Number(w),
    height: Number(h),
    deviceScaleFactor: 1,
    mobile: false,
  });

  await cdp.send('Page.navigate', { url });
  await sleep(Number(waitMs));

  // Confirm rAF is actually running before we trust the canvas.
  const raf = await cdp.send('Runtime.evaluate', {
    expression: `new Promise(r => { let n = 0; const t0 = performance.now();
      const tick = () => { n++; if (performance.now() - t0 < 300) requestAnimationFrame(tick); else r(n); };
      requestAnimationFrame(tick); })`,
    awaitPromise: true,
  });
  console.log(`rAF frames in 300ms: ${raf.result.value}`);

  if (evalJs) {
    await cdp.send('Runtime.evaluate', { expression: evalJs });
    // A reload inside evalJs needs the app to boot again.
    await sleep(Number(waitMs));
    console.log('ran eval step');
  }

  // Zoom steps: negative deltaY zooms in. Repeated small steps beat one large
  // one — d3-zoom clamps per-event deltas.
  for (const step of wheel.split(';').filter(Boolean)) {
    const [wxs, wys, dys] = step.split(',');
    const x = Number(wxs);
    const y = Number(wys);
    const deltaY = Number(dys);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x,
      y,
      deltaX: 0,
      deltaY,
      modifiers: 0,
    });
    await sleep(350);
    console.log(`wheel ${deltaY} at ${x},${y}`);
  }

  // "x,y" or several separated by ";" — e.g. scrub the timeline, then pick a bubble.
  for (const step of click.split(';').filter(Boolean)) {
    const [cxs, cys] = step.split(',');
    const x = Number(cxs);
    const y = Number(cys);
    // Move first: hover state and the hit-test cache both depend on it.
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await sleep(200);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', {
        type,
        x,
        y,
        button: 'left',
        clickCount: 1,
      });
    }
    await sleep(1100);
    console.log(`clicked at ${x},${y}`);
  }

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`wrote ${out}`);
  if (errors.length) {
    console.log(`\npage errors (${errors.length}):`);
    for (const e of errors.slice(0, 10)) console.log('  ' + e);
  }
} finally {
  browser.kill();
  await sleep(300);
  try {
    rmSync(PROFILE, { recursive: true, force: true });
  } catch {
    /* profile cleanup is best-effort */
  }
}

process.exit(0);
