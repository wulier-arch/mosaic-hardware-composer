#!/usr/bin/env node
/* =============================================================
   网页版冒烟测试
   -------------------------------------------------------------
   起本地静态服务 → headless Chromium 逐页加载 → 断言标题、关键 DOM、
   控制台错误与未捕获异常。用于推送前的回归自检。
   用法：node tools/smoke-web.mjs
   ============================================================= */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const PORT = 8099;

const CANDIDATES = [
  '/Users/yedapeng/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
];
const SHELL = CANDIDATES.find(p => existsSync(p));
if (!SHELL) { console.error('未找到 chrome-headless-shell，跳过网页冒烟测试'); process.exit(0); }

/* 页面清单：路径、期望标题关键词、必须存在的选择器 */
const PAGES = [
  ['/', 'MOSAIC', 'section.section'],
  ['/catalog.html', '模块库', '.card, .grid, main'],
  ['/module.html?id=sht31', 'SHT31', 'h1, .spec, main'],
  ['/builder.html', '选型', '.zone, .workbench, main'],
  ['/checkout.html', '结算', 'form, .form, main'],
  ['/pay.html', '支付', '.qr, .pay, main'],
  ['/orders.html', '订单', 'main'],
  ['/admin.html', '后台', 'main'],
  ['/docs.html', '需求', 'main'],
  ['/submit.html', '提交', 'main'],
  ['/404.html', '页面不存在', 'body'],
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    if (!statSync(file).isFile()) throw new Error('not file');
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readFileSync(join(ROOT, '404.html')));
  }
});
await new Promise(ok => server.listen(PORT, '127.0.0.1', ok));

const chrome = spawn(SHELL, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--force-color-profile=srgb', '--remote-debugging-port=9411',
  '--user-data-dir=/tmp/mosaic-smoke', 'about:blank',
], { stdio: 'ignore' });

let ready = false;
for (let i = 0; i < 80; i++) {
  try { const r = await fetch('http://127.0.0.1:9411/json/version'); if (r.ok) { ready = true; break; } } catch {}
  await sleep(200);
}
if (!ready) { console.error('Chromium 未就绪'); chrome.kill(); server.close(); process.exit(1); }

const target = await (await fetch('http://127.0.0.1:9411/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(ok => ws.addEventListener('open', ok, { once: true }));

let id = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  } else if (m.method) events.push(m);
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { resolve: res, reject: rej });
  ws.send(JSON.stringify({ id: i, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

let pass = 0, fail = 0;
const failures = [];

for (const [p, kw, sel] of PAGES) {
  events.length = 0;
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${p}` });
  await sleep(1100);

  const errs = events.filter(m =>
    (m.method === 'Runtime.exceptionThrown') ||
    (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') ||
    (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
  ).map(m => {
    if (m.method === 'Runtime.exceptionThrown') return m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || '');
    if (m.method === 'Log.entryAdded') return m.params.entry.text;
    return (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
  }).filter(t => t && !/favicon/i.test(t));

  const r = await send('Runtime.evaluate', {
    expression: `JSON.stringify({ title: document.title, has: !!document.querySelector(${JSON.stringify(sel)}), h: document.body.scrollHeight, w: document.documentElement.scrollWidth })`,
    returnByValue: true,
  });
  const info = JSON.parse(r.result.value);

  const problems = [];
  if (errs.length) problems.push('控制台错误 ' + errs.length + ' 条：' + errs[0].slice(0, 120));
  if (!info.title || !info.title.includes(kw)) problems.push('标题不符「' + info.title + '」');
  if (!info.has) problems.push('缺少选择器 ' + sel);
  if (info.w > 1460) problems.push('横向溢出 ' + info.w + 'px');

  if (problems.length) { fail++; failures.push(p + ' — ' + problems.join('；')); console.log('  \x1b[31m✗\x1b[0m ' + p + '  \x1b[31m' + problems.join('；') + '\x1b[0m'); }
  else { pass++; console.log('  \x1b[32m✓\x1b[0m ' + p + '  \x1b[90m' + info.title.slice(0, 28) + ' · ' + info.h + 'px\x1b[0m'); }
}

console.log('\n' + '─'.repeat(56));
console.log('\x1b[1m结果：\x1b[0m' + pass + ' 通过 / ' + fail + ' 失败');
chrome.kill(); server.close();
if (fail) { failures.forEach(f => console.log('  · ' + f)); process.exit(1); }
console.log('\x1b[32m全部通过\x1b[0m');
process.exit(0);
