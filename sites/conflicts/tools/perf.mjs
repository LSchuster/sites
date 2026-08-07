/**
 * Frame-rate measurement over the DevTools Protocol.
 *
 * Measures the three states that actually matter: idle, timeline playback, and an
 * active pan. Pan is the expensive one — it invalidates the cached vector layers —
 * so it is the number to watch after any renderer change.
 *
 * Usage: node tools/perf.mjs [url]
 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:5173/';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9334;
const PROFILE = join(tmpdir(), `cdp-perf-${Date.now()}`);
const W = 1500;
const H = 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** Sample frame intervals for `ms`, then report the distribution. */
const PROBE = (ms) => `new Promise(resolve => {
  const gaps = [];
  let prev = performance.now();
  const t0 = prev;
  const tick = (now) => {
    gaps.push(now - prev);
    prev = now;
    if (now - t0 < ${ms}) requestAnimationFrame(tick);
    else {
      gaps.sort((a, b) => a - b);
      const at = (p) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))];
      resolve({
        frames: gaps.length,
        fps: +(1000 / (gaps.reduce((s, g) => s + g, 0) / gaps.length)).toFixed(1),
        median: +at(0.5).toFixed(1),
        p95: +at(0.95).toFixed(1),
        worst: +gaps[gaps.length - 1].toFixed(1),
      });
    }
  };
  requestAnimationFrame(tick);
})`;

const browser = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    `--window-size=${W},${H}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  let version = null;
  for (let i = 0; i < 60; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!version) throw new Error('DevTools never became ready');

  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await cdp.send('Page.navigate', { url });
  await sleep(5000);

  const measure = async (label, ms = 2000) => {
    const r = await cdp.send('Runtime.evaluate', { expression: PROBE(ms), awaitPromise: true, returnByValue: true });
    const v = r.result.value;
    console.log(
      `  ${label.padEnd(22)} ${String(v.fps).padStart(5)} fps   ` +
        `median ${String(v.median).padStart(5)} ms   p95 ${String(v.p95).padStart(6)} ms   ` +
        `worst ${String(v.worst).padStart(6)} ms`,
    );
    return v;
  };

  console.log(`\n${url}  (${W}×${H}, headless, software rendering)\n`);
  await measure('idle');

  // Playback: click the play button. It sits after the prev-snapshot step
  // button: 24px padding + 28px step + 18px gap + half of its 40px width.
  const PLAY_X = 90;
  const click = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    for (const type of ['mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    }
  };
  await click(PLAY_X, H - 173);
  await sleep(400);
  await measure('playback (0.5× default)');
  await click(PLAY_X, H - 173); // pause
  await sleep(300);

  // Pan: press, drag across the map, hold.
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 750, y: 400 });
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: 750, y: 400, button: 'left', clickCount: 1,
  });
  // Fire the moves without awaiting each ack: awaiting them serialises this loop
  // behind a busy renderer and the probe never gets to finish.
  const panning = measure('panning', 1800);
  for (let i = 0; i < 60; i++) {
    void cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 750 + Math.sin(i / 6) * 220,
      y: 400 + Math.cos(i / 6) * 90,
      button: 'left',
      buttons: 1,
    });
    await sleep(28);
  }
  await panning;
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: 750, y: 400, button: 'left', clickCount: 1,
  });
  await sleep(400);

  // Hovering runs the country hit test (spherical point-in-polygon per feature).
  const hovering = measure('hover sweep', 1600);
  for (let i = 0; i < 55; i++) {
    void cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 400 + i * 12,
      y: 300 + Math.sin(i / 4) * 120,
    });
    await sleep(25);
  }
  await hovering;
  console.log('');
} finally {
  browser.kill();
  await sleep(300);
  try {
    rmSync(PROFILE, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

process.exit(0);
