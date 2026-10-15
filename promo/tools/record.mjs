/**
 * 真实操作录屏
 * ---------------------------------------------------------------
 * 用 CDP Page.startScreencast 录下真实浏览器操作，不是截图后拼动画。
 *  · 注入模拟光标 + 点击涟漪，让录屏有真实操作感
 *  · 页面内注入操作辅助库，按模块 ID / 选择器精确点击
 *  · 滚动用 rAF 逐帧驱动，保证画面连续
 *  · 每段 take 独立录制，帧带时间戳，供后续按拍网格重映射
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TAKES = resolve(ROOT, 'takes');
const SHELL = '/Users/yedapeng/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:8123';
const PORT = 9351;

rmSync(TAKES, { recursive: true, force: true });
mkdirSync(TAKES, { recursive: true });

/* ---------------- 站点数据预置 ---------------- */
const SEED_HEAT = `(() => {
  if (localStorage.getItem('mosaic.live.v1')) return;
  localStorage.setItem('mosaic.heat.v1', JSON.stringify({
    items:{'esp32-s3-devkitc-1':{view:16,add:8,order:2},'oled-096-i2c':{view:12,add:6,order:1},'sht31':{view:9,add:4,order:0}},
    log:[{type:'add',id:'esp32-s3-devkitc-1',at:Date.now()}]
  }));
  localStorage.setItem('mosaic.live.v1','1');
})();`;

const SCHEME_EMPTY = `localStorage.setItem('mosaic.scheme.v1', JSON.stringify({
  id:'SCLIVE', name:'我的第一个硬件方案', items:[], note:'',
  service:{assembly:false,rush:false,invoice:false}, createdAt:Date.now(), updatedAt:Date.now() }))`;

/* 冲突起始：5V 基础算力主控 + 两个外设，后面加摄像头会触发「算力档位不足」 */
const SCHEME_CONFLICT = `localStorage.setItem('mosaic.scheme.v1', JSON.stringify({
  id:'SCLIVE', name:'视觉识别小车', items:[
    {id:'arduino-uno-r4-wifi',qty:1},{id:'sht31',qty:1},{id:'oled-096-i2c',qty:1}], note:'',
  service:{assembly:false,rush:false,invoice:false}, createdAt:Date.now(), updatedAt:Date.now() }))`;

const SCHEME_FULL = `localStorage.setItem('mosaic.scheme.v1', JSON.stringify({
  id:'SCLIVE', name:'智能环境监测节点', items:[
    {id:'esp32-s3-devkitc-1',qty:1},{id:'sht31',qty:1},{id:'sgp30',qty:1},{id:'bh1750',qty:1},
    {id:'oled-096-i2c',qty:1},{id:'lora-sx1278',qty:1},{id:'psu-12v5a',qty:1},{id:'lm2596-dcdc',qty:1},
    {id:'case-3dprint',qty:1}], note:'', service:{assembly:true,rush:false,invoice:false},
  createdAt:Date.now(), updatedAt:Date.now() }))`;

const ORDER_PENDING = `localStorage.setItem('mosaic.orders.v1', JSON.stringify([{
  id:'ODLIVE1', no:'MS20261015201200777', state:'pending', schemeId:'SCLIVE', schemeName:'智能环境监测节点',
  lines:[
    {id:'esp32-s3-devkitc-1',name:'ESP32-S3-DevKitC-1 (N16R8)',cat:'board',brand:'乐鑫 Espressif',price:89,qty:1,sum:89},
    {id:'sht31',name:'SHT31 高精度温湿度',cat:'sensor',brand:'Sensirion',price:26,qty:1,sum:26},
    {id:'sgp30',name:'SGP30 TVOC/eCO₂ 传感器',cat:'sensor',brand:'Sensirion',price:68,qty:1,sum:68},
    {id:'bh1750',name:'BH1750 数字光照传感器',cat:'sensor',brand:'ROHM',price:9,qty:1,sum:9},
    {id:'oled-096-i2c',name:'0.96\\" OLED 显示屏 (I2C)',cat:'display',brand:'通用',price:15,qty:1,sum:15},
    {id:'lora-sx1278',name:'LoRa SX1278 433MHz 模块',cat:'comm',brand:'Semtech',price:28,qty:1,sum:28},
    {id:'psu-12v5a',name:'12V 5A 电源适配器',cat:'power',brand:'通用',price:36,qty:1,sum:36},
    {id:'lm2596-dcdc',name:'LM2596 可调降压模块',cat:'power',brand:'TI',price:7,qty:1,sum:7},
    {id:'case-3dprint',name:'定制 3D 打印外壳',cat:'mech',brand:'平台代工',price:45,qty:1,sum:45}],
  cost:{subtotal:323,assembly:39,shipping:0,rush:0,total:362,itemCount:9,kinds:9},
  amount:362, service:{assembly:true,rush:false,invoice:false},
  contact:{name:'李工',phone:'13900008888',province:'广东省',city:'深圳市南山区',addr:'科技园南路 1 号 A 座 1201',email:'li@example.com',zip:'',full:'广东省 深圳市南山区 科技园南路 1 号 A 座 1201'},
  invoice:{title:'深圳某某科技有限公司',type:'电子普通发票',tax:'91440300MA5XXXXXXX'},
  note:'请预烧录固件并做 24 小时老化测试', payChannel:'wechat', payNo:null, paidAt:null,
  tracking:null, carrier:null, refund:null, adminNote:'',
  validation:{verdict:'ok',errors:0,warnings:0,difficulty:2,hours:3.5},
  timeline:[{state:'pending',at:Date.now()-60000,note:'订单已创建'}], createdAt:Date.now()-60000 }]))`;

/* ---------------- 页面内注入：光标 + 操作辅助库 ---------------- */
const PAGE_KIT = `(() => {
  if (window.__H) return;
  const st = document.createElement('style');
  st.textContent = \`
    #__cur{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;
      filter:drop-shadow(0 2px 6px rgba(0,0,0,.5));}
    #__rip{position:fixed;left:0;top:0;width:14px;height:14px;border-radius:50%;z-index:2147483646;
      pointer-events:none;border:2px solid rgba(167,139,250,.95);opacity:0;transform:translate(-50%,-50%);}
    .nav{position:static !important;}
  \`;
  document.head.appendChild(st);
  const c = document.createElement('div');
  c.id = '__cur';
  c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2l7 18 2.4-7.2L20.6 10z" fill="#fff" stroke="#101014" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const rp = document.createElement('div'); rp.id = '__rip';
  document.body.appendChild(c); document.body.appendChild(rp);

  /* 强制持续重绘：页面静止时合成器不出帧，screencast 会掉到 0.5fps。
     实测：CSS 动画（仅合成器）无效；rAF 每帧改真实样式可稳定 59.8fps。 */
  const kick = document.createElement('div');
  kick.style.cssText = 'position:fixed;right:0;top:0;width:3px;height:3px;background:#fff;'
    + 'opacity:.02;pointer-events:none;z-index:2147483647;';
  document.body.appendChild(kick);
  (function kickLoop() {
    kick.style.transform = 'translateY(' + (kick.__n = (kick.__n || 0) + 1) % 2 + 'px)';
    requestAnimationFrame(kickLoop);
  })();

  const wait = ms => new Promise(r => setTimeout(r, ms));
  let pos = { x: 960, y: 640 };
  c.style.transform = 'translate(957px,638px)';

  const move = (x, y, ms) => new Promise(res => {
    const from = { ...pos }, t0 = performance.now(), dur = ms || 420;
    (function step(){
      const p = Math.min(1, (performance.now() - t0) / dur);
      const e = p < .5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2)/2;
      pos = { x: from.x + (x - from.x)*e, y: from.y + (y - from.y)*e };
      c.style.transform = 'translate(' + (pos.x-3) + 'px,' + (pos.y-2) + 'px)';
      p < 1 ? requestAnimationFrame(step) : res(1);
    })();
  });

  const ripple = () => {
    rp.style.left = pos.x + 'px'; rp.style.top = pos.y + 'px';
    rp.style.transition = 'none'; rp.style.opacity = '.95';
    rp.style.width = '10px'; rp.style.height = '10px';
    requestAnimationFrame(() => {
      rp.style.transition = 'all .44s cubic-bezier(.2,.7,.3,1)';
      rp.style.opacity = '0'; rp.style.width = '58px'; rp.style.height = '58px';
    });
  };

  /* 把光标移到元素中心并点击 */
  const hit = async (el, hold) => {
    if (!el) return false;
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    await wait(170);
    const r = el.getBoundingClientRect();
    await move(r.left + r.width * 0.5, r.top + r.height * 0.5, hold || 420);
    await wait(80);
    ripple();
    await wait(60);
    el.click();
    await wait(170);
    return true;
  };

  window.__H = {
    wait, move,
    /* 点击任意选择器 */
    click: async (sel, nth, hold) => {
      const els = [...document.querySelectorAll(sel)];
      return await hit(els[nth || 0], hold) ? 'OK' : 'MISS:' + sel;
    },
    /* 切换工作台的模块分类 */
    cat: async (c, hold) => {
      const b = document.querySelector('#pickCats [data-cat="' + c + '"]');
      return await hit(b, hold || 440) ? 'OK' : 'MISS:' + c;
    },
    /* 按模块 ID 精确加购 */
    add: async (id, hold) => {
      const row = document.querySelector('#pickList .pick-row[data-id="' + id + '"]');
      if (!row) return 'MISS:' + id;
      return await hit(row, hold || 380) ? 'OK' : 'MISS:' + id;
    },
    /* 逐字符输入 */
    type: async (sel, text, delay) => {
      const el = document.querySelector(sel);
      if (!el) return 'MISS:' + sel;
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      await wait(150);
      const r = el.getBoundingClientRect();
      await move(r.left + Math.min(r.width * 0.4, 160), r.top + r.height / 2, 330);
      ripple(); el.focus();
      for (let i = 0; i < text.length; i++) {
        el.value = text.slice(0, i + 1);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        await wait(delay || 55);
      }
      return 'OK';
    },
    /* rAF 平滑滚动 */
    scroll: (y, ms) => new Promise(res => {
      const from = scrollY, t0 = performance.now(), dur = ms || 1600;
      (function step(){
        const p = Math.min(1, (performance.now() - t0) / dur);
        const e = p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;
        scrollTo(0, from + (y - from) * e);
        p < 1 ? requestAnimationFrame(step) : res(1);
      })();
    }),
    /* 滚动到某元素 */
    toSel: (sel, off) => {
      const e = document.querySelector(sel);
      return e ? e.getBoundingClientRect().top + scrollY - (off == null ? 90 : off) : 0;
    },
    setSel: (sel, val) => {
      const e = document.querySelector(sel);
      if (!e) return 'MISS';
      e.value = val; e.dispatchEvent(new Event('change', { bubbles: true }));
      return 'OK';
    },
  };
})()`;

/* ---------------- CDP ---------------- */
const chrome = spawn(SHELL, ['--headless', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/mosaic-live-profile', 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 120; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(250); }

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(ok => ws.addEventListener('open', ok, { once: true }));
let id = 0; const pend = new Map();
let recFrames = []; let recOn = false; let recT0 = 0;
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
  if (m.method === 'Page.screencastFrame') {
    if (recOn) recFrames.push({ ts: m.params.metadata.timestamp, data: m.params.data });
    send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pend.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

async function ev(expr, awaitPromise) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!awaitPromise });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

/* 上一次注入的种子脚本 id，用于替换 */
let seedScriptId = null;

async function record(name, url, seedExpr, script, settle = 1500) {
  /* 关键：种子必须在页面脚本之前执行。
     若在 navigate 之后再 ev(seed)，页面已经读完 localStorage，
     支付页会显示「未找到订单」、后台会停在登录门。
     因此用 addScriptToEvaluateOnNewDocument 注入，保证先于页面脚本运行。 */
  if (seedScriptId) { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedScriptId }).catch(() => {}); seedScriptId = null; }
  if (seedExpr) {
    const r = await send('Page.addScriptToEvaluateOnNewDocument', { source: seedExpr });
    seedScriptId = r.identifier;
  }
  await send('Page.navigate', { url });
  await sleep(settle);
  await ev(PAGE_KIT);
  await sleep(300);
  recFrames = []; recOn = true; recT0 = Date.now();
  await send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 2 });
  let ret;
  try { ret = await ev(script, true); } catch (e) { ret = 'ERR:' + e.message.slice(0, 120); }
  await sleep(500);
  await send('Page.stopScreencast').catch(() => {});
  recOn = false;

  const wall = (Date.now() - recT0) / 1000;
  const dir = resolve(TAKES, name);
  mkdirSync(dir, { recursive: true });
  const meta = [];
  recFrames.forEach((f, i) => {
    writeFileSync(resolve(dir, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(f.data, 'base64'));
    meta.push({ i, ts: +f.ts.toFixed(3) });
  });
  writeFileSync(resolve(dir, 'meta.json'), JSON.stringify({
    name, wall: +wall.toFixed(2), count: recFrames.length, fps: +(recFrames.length / wall).toFixed(2), result: ret, frames: meta,
  }, null, 2));
  console.log(`  ${name.padEnd(10)} ${String(recFrames.length).padStart(4)} 帧 / ${wall.toFixed(1).padStart(5)}s = ${(recFrames.length / wall).toFixed(1).padStart(4)} fps   ${ret}`);
  return { name, wall, count: recFrames.length };
}

console.log('开始录制真实操作…\n');
const report = [];

/* ===== 1. 首页滚动 + 热度切换 ===== */
report.push(await record('home', BASE + '/index.html', SEED_HEAT, `(async () => {
  await __H.wait(400);
  await __H.move(1240, 520, 620); await __H.wait(300);
  await __H.scroll(__H.toSel('#categories', 40), 2600); await __H.wait(420);
  await __H.scroll(__H.toSel('#heat', 20), 2200); await __H.wait(520);
  await __H.click('#heatRange [data-range="30d"]', 0, 460); await __H.wait(760);
  await __H.click('#heatRange [data-range="7d"]', 0, 420); await __H.wait(640);
  await __H.scroll(__H.toSel('#how', 40), 1700); await __H.wait(380);
  await __H.scroll(__H.toSel('#personas', 40), 1700); await __H.wait(520);
  return 'done';
})()`, 1800));

/* ===== 2. 模块库：分类筛选 + 搜索 + 加购 ===== */
report.push(await record('catalog', BASE + '/catalog.html', `localStorage.removeItem('mosaic.scheme.v1')`, `(async () => {
  await __H.wait(400);
  await __H.click('#fCat [data-val="sensor"]', 0, 520); await __H.wait(780);
  await __H.type('#q', '温湿', 95); await __H.wait(720);
  await __H.click('#q', 0, 300); await __H.wait(200);
  await __H.type('#q', '', 20); await __H.wait(700);
  await __H.click('#viewSwitch [data-view="list"]', 0, 440); await __H.wait(720);
  await __H.click('#viewSwitch [data-view="card"]', 0, 420); await __H.wait(660);
  await __H.click('#fCat [data-val="board"]', 0, 480); await __H.wait(720);
  await __H.click('#results .js-add', 0, 400); await __H.wait(760);
  await __H.click('#fCat [data-val="display"]', 0, 460); await __H.wait(680);
  await __H.click('#results .js-add', 0, 400); await __H.wait(700);
  await __H.move(1620, 300, 520); await __H.wait(560);
  return 'done';
})()`, 1700));

/* ===== 3. 工作台：从空方案逐个加模块，看校验实时变化 ===== */
report.push(await record('builder', BASE + '/builder.html', SCHEME_EMPTY, `(async () => {
  await __H.wait(500);
  await __H.add('esp32-s3-devkitc-1', 520); await __H.wait(760);
  await __H.cat('sensor'); await __H.wait(120);
  await __H.add('sht31', 400); await __H.wait(620);
  await __H.add('sgp30', 380); await __H.wait(620);
  await __H.add('bh1750', 360); await __H.wait(640);
  await __H.cat('display'); await __H.wait(120);
  await __H.add('oled-096-i2c', 380); await __H.wait(680);
  await __H.cat('comm'); await __H.wait(120);
  await __H.add('lora-sx1278', 380); await __H.wait(720);
  await __H.cat('power'); await __H.wait(120);
  await __H.add('psu-12v5a', 380); await __H.wait(600);
  await __H.add('lm2596-dcdc', 340); await __H.wait(760);
  await __H.move(1430, 260, 620); await __H.wait(560);
  await __H.move(1430, 470, 480); await __H.wait(560);
  await __H.move(1430, 700, 480); await __H.wait(640);
  return 'done';
})()`, 1700));

/* ===== 4. 制造算力冲突 → 替换主控解决 ===== */
report.push(await record('conflict', BASE + '/builder.html', SCHEME_CONFLICT, `(async () => {
  await __H.wait(500);
  await __H.move(1430, 420, 560); await __H.wait(520);
  await __H.cat('sensor'); await __H.wait(120);
  await __H.add('ov2640', 460); await __H.wait(900);
  // 冲突出现：滚到右侧报告
  await __H.move(1430, 300, 560); await __H.wait(700);
  await __H.move(1430, 560, 480); await __H.wait(760);
  // 回到左侧，切换主控
  await __H.cat('board'); await __H.wait(140);
  await __H.add('esp32-s3-devkitc-1', 480); await __H.wait(1000);
  await __H.move(1430, 300, 560); await __H.wait(700);
  await __H.move(1430, 520, 460); await __H.wait(760);
  return 'done';
})()`, 1700));

/* ===== 5. 结算填单 ===== */
report.push(await record('checkout', BASE + '/checkout.html', SCHEME_FULL, `(async () => {
  await __H.wait(500);
  await __H.type('[name="name"]', '李工', 75);
  await __H.type('[name="phone"]', '13900008888', 62);
  await __H.setSel('#province', '广东省'); await __H.wait(320);
  await __H.type('[name="city"]', '深圳市南山区', 62);
  await __H.type('[name="addr"]', '科技园南路 1 号 A 座 1201', 44);
  await __H.type('[name="email"]', 'li@example.com', 46);
  await __H.click('#needInv', 0, 400); await __H.wait(440);
  await __H.type('[name="invTitle"]', '深圳某某科技有限公司', 40);
  await __H.type('[name="invTax"]', '91440300MA5XXXXXXX', 34);
  await __H.click('#agree', 0, 430); await __H.wait(520);
  await __H.move(1530, 880, 470); await __H.wait(540);
  return 'done';
})()`, 1700));

/* ===== 6. 支付 ===== */
report.push(await record('pay', BASE + '/pay.html?order=ODLIVE1', ORDER_PENDING, `(async () => {
  await __H.wait(500);
  await __H.click('#chTabs [data-ch="alipay"]', 0, 520); await __H.wait(800);
  await __H.click('#chTabs [data-ch="wechat"]', 0, 480); await __H.wait(840);
  await __H.move(755, 615, 480); await __H.wait(660);
  await __H.click('#simulate', 0, 460); await __H.wait(1600);
  await __H.move(1245, 700, 520); await __H.wait(640);
  return 'done';
})()`, 1700));

/* ===== 7. 后台流转 + 发货 + 库存 ===== */
report.push(await record('admin', BASE + '/admin.html',
  ORDER_PENDING + `;localStorage.setItem('mosaic.admin.v1', JSON.stringify({ at: Date.now() }))`, `(async () => {
  await __H.wait(600);
  await __H.click('#tabBody [data-act="paid"]', 0, 560); await __H.wait(780);
  await __H.click('#tabBody [data-act="picking"]', 0, 520); await __H.wait(780);
  await __H.click('#tabBody [data-act="shipped"]', 0, 520); await __H.wait(800);
  await __H.type('#tracking', 'SF9988776655', 70); await __H.wait(430);
  await __H.click('#shipConfirm', 0, 520); await __H.wait(950);
  await __H.move(1185, 420, 560); await __H.wait(520);
  await __H.click('#tabs [data-tab="inventory"]', 0, 480); await __H.wait(820);
  await __H.move(960, 520, 560); await __H.wait(620);
  return 'done';
})()`, 1800));

console.log('\n=== 录制汇总 ===');
let tf = 0, tw = 0;
report.forEach(r => { tf += r.count; tw += r.wall; });
console.log(`共 ${report.length} 段 take，${tf} 帧，原始时长 ${tw.toFixed(1)}s`);
writeFileSync(resolve(TAKES, 'summary.json'), JSON.stringify({ report, totalFrames: tf, totalWall: +tw.toFixed(2) }, null, 2));
chrome.kill();
process.exit(0);
