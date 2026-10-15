/**
 * 全量渲染：合成页逐帧渲染 → JPEG 序列 → H.264 MP4 → 混音封装
 * 用法: node src/render.mjs [起始帧] [结束帧]     默认 0..899
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SHELL = '/Users/yedapeng/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const PORT = 9344;
const PAGE = 'file:///tmp/mosaic-video/compose-live/index.html';
const FRAMES = '/tmp/mosaic-video/frames-live';
const FPS = 30, TOTAL = 900;

const from = Number(process.argv[2] || 0);
const to = Number(process.argv[3] || TOTAL - 1);

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const chrome = spawn(SHELL, ['--headless', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb',
  '--allow-file-access-from-files', '--disable-web-security', '--disable-lcd-text',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/mosaic-render-live-profile', 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 120; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(250); }

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(ok => ws.addEventListener('open', ok, { once: true }));
let id = 0; const pend = new Map(); const errs = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('console.error: ' + (m.params.args || []).map(a => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pend.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: PAGE });

async function ev(expr, awaitPromise) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!awaitPromise });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

for (let i = 0; i < 80; i++) { if (await ev('window.__ready === true').catch(() => false)) break; await sleep(400); }
if (!(await ev('window.__ready === true').catch(() => false))) {
  console.error('合成页未就绪'); console.error(errs.slice(0, 5).join('\n')); chrome.kill(); process.exit(1);
}
console.log('合成页就绪，开始逐帧渲染');

const t0 = Date.now();
let written = 0;
for (let f = from; f <= to; f++) {
  // seek 后等两帧 rAF，确保样式全部合成完毕再截图
  await ev(`(async () => { await window.seek(${f}); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return 1; })()`, true);
  const r = await send('Page.captureScreenshot', {
    format: 'jpeg', quality: 93,
    clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 },
  });
  writeFileSync(`${FRAMES}/f${String(f).padStart(4, '0')}.jpg`, Buffer.from(r.data, 'base64'));
  written++;
  if (f % 50 === 0 || f === to) {
    const el = (Date.now() - t0) / 1000;
    const rate = (f - from + 1) / el;
    const eta = (to - f) / (rate || 1);
    console.log(`  帧 ${String(f).padStart(4)}/${to}  ${rate.toFixed(1)} 帧/秒  已用 ${el.toFixed(0)}s  预计剩余 ${eta.toFixed(0)}s`);
  }
}
console.log(`\n渲染完成：${written} 帧，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (errs.length) { console.log('控制台错误:'); [...new Set(errs)].slice(0, 6).forEach(e => console.log('  ' + String(e).slice(0, 180))); }
else console.log('控制台无错误');
chrome.kill();

/* ---------- 编码视频轨 ---------- */
console.log('\n编码 H.264 视频轨…');
execFileSync('/tmp/mosaic-video/src/encode', ['--frames', FRAMES, '--out', '/tmp/mosaic-video/video_only_live.mp4',
  '--w', '1920', '--h', '1080', '--fps', String(FPS), '--bitrate', '15000000'], { stdio: 'inherit' });

/* ---------- 编码音频轨（独立编码，避免双轨同时写入死锁） ---------- */
console.log('\n编码 AAC 音频轨…');
execFileSync('/tmp/mosaic-video/src/aac', ['/tmp/mosaic-video/audio/final_mix.wav',
  '/tmp/mosaic-video/audio/final_mix.m4a'], { stdio: 'inherit' });

/* ---------- 无损封装（passthrough，视频不重编码） ---------- */
console.log('\n封装音视频…');
execFileSync('/tmp/mosaic-video/src/mux', ['--video', '/tmp/mosaic-video/video_only_live.mp4',
  '--audio', '/tmp/mosaic-video/audio/final_mix.m4a', '--out', '/tmp/mosaic-video/MOSAIC_live.mp4',
  '--dur', '30'], { stdio: 'inherit' });

console.log('\n输出: /tmp/mosaic-video/MOSAIC_live.mp4');
process.exit(0);
