/**
 * 合成页预览：渲染指定帧为 PNG，用于快速视觉校验
 * 用法: node src/preview.mjs 30 150 380 500 700 860
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync } from 'node:fs';

const SHELL = '/Users/yedapeng/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const PORT = 9342;
const PAGE = 'file://' + resolve(ROOT, 'compose/index.html');
const OUT = resolve(ROOT, 'preview');
mkdirSync(OUT, { recursive: true });

const chrome = spawn(SHELL, ['--headless', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb',
  '--allow-file-access-from-files', '--disable-web-security',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/mosaic-prev-profile', 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(200); }

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(ok => ws.addEventListener('open', ok, { once: true }));
let id = 0; const pend = new Map(); const errs = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('console.error: ' + (m.params.args || []).map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push(m.params.entry.text);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pend.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: PAGE });

async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

// 等待就绪
let ready = false;
for (let i = 0; i < 60; i++) {
  try { ready = await ev('window.__ready === true'); } catch {}
  if (ready) break;
  await sleep(400);
}
if (!ready) { console.error('合成页未就绪'); console.error(errs.slice(0, 6).join('\n')); chrome.kill(); process.exit(1); }
console.log('合成页就绪');
const info = await ev('JSON.stringify(window.VIDEO)');
console.log('时间轴:', info);
const planeInfo = await ev(`JSON.stringify([...document.querySelectorAll('.plane')].map(p => ({ id: p.id, w: p.offsetWidth, h: p.offsetHeight, iw: p.querySelector('img').naturalWidth, ih: p.querySelector('img').naturalHeight, sw: p.querySelector('img').style.width })))`);
console.log('平面:', planeInfo);

const frames = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
const list = frames.length ? frames : [15, 60, 150, 210, 300, 380, 450, 520, 600, 700, 780, 850, 890];

for (const f of list) {
  await ev(`window.seek(${f})`);
  await sleep(120);
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
  const buf = Buffer.from(r.data, 'base64');
  writeFileSync(`${OUT}/f${String(f).padStart(4, '0')}.png`, buf);
  const T = (f / 30).toFixed(2);
  console.log(`  帧 ${String(f).padStart(4)} (t=${T}s)  ${Math.round(buf.length / 1024)}KB`);
}

if (errs.length) { console.log('\n控制台错误:'); [...new Set(errs)].slice(0, 8).forEach(e => console.log('  ' + String(e).split('\n')[0].slice(0, 200))); }
else console.log('\n控制台无错误');
chrome.kill();
process.exit(0);
