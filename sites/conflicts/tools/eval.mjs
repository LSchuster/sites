/**
 * Evaluate a JS expression in the running app and print the result.
 *
 * The measurement side of tools/shot.mjs: same headless-Edge-over-CDP setup,
 * but instead of capturing pixels it returns values — text metrics, canvas
 * probes, computed styles. Async expressions are awaited.
 *
 * Usage: node tools/eval.mjs <url> <expression> [waitMs]
 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , url = 'http://localhost:5173/', expression = '1+1', waitMs = '3000'] = process.argv;

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9335;
const PROFILE = join(tmpdir(), `cdp-eval-${Date.now()}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

const browser = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--window-size=1500,950',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
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

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    }
  });
  const send = (method, params = {}) => {
    const mid = ++id;
    ws.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((resolve, reject) => pending.set(mid, { resolve, reject }));
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url });
  await sleep(Number(waitMs));

  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    console.error('threw:', res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(res.result.value, null, 2));
  }
} finally {
  browser.kill();
  await sleep(300);
  try {
    rmSync(PROFILE, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

process.exit();
