/**
 * 站点素材抓取：把 MOSAIC 各页面的真实画面抓成长图 / 视口图，
 * 供后续 3D 合成页当作纹理使用。
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync } from 'node:fs';

const SHELL = '/Users/yedapeng/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:8123';
const PORT = 9341;
const OUT = resolve(ROOT, 'compose/site');
mkdirSync(OUT, { recursive: true });

const VW = 1680, VH = 1050, DSF = 1.5;
const MAXH = 2700;   // 长图最高 CSS 像素

const SEED = `(() => {
  if (localStorage.getItem('mosaic.vid.v1')) return;
  localStorage.setItem('mosaic.scheme.v1', JSON.stringify({
    id:'SCVID', name:'智能环境监测节点',
    items:[{id:'esp32-s3-devkitc-1',qty:1},{id:'sht31',qty:1},{id:'sgp30',qty:1},{id:'bh1750',qty:1},
           {id:'oled-096-i2c',qty:1},{id:'lora-sx1278',qty:1},{id:'psu-12v5a',qty:1},{id:'lm2596-dcdc',qty:1},
           {id:'case-3dprint',qty:1}],
    note:'', service:{assembly:true,rush:false,invoice:false},
    createdAt:Date.now(), updatedAt:Date.now()
  }));
  localStorage.setItem('mosaic.heat.v1', JSON.stringify({
    items:{'esp32-s3-devkitc-1':{view:14,add:7,order:2},'oled-096-i2c':{view:11,add:5,order:1}},
    log:[{type:'add',id:'esp32-s3-devkitc-1',at:Date.now()}]
  }));
  localStorage.setItem('mosaic.orders.v1', JSON.stringify([{
    id:'ODVID1', no:'MS20261013200300456', state:'pending', schemeId:'SCVID', schemeName:'智能环境监测节点',
    lines:[
      {id:'esp32-s3-devkitc-1',name:'ESP32-S3-DevKitC-1 (N16R8)',cat:'board',brand:'乐鑫 Espressif',price:89,qty:1,sum:89},
      {id:'sht31',name:'SHT31 高精度温湿度',cat:'sensor',brand:'Sensirion',price:26,qty:1,sum:26},
      {id:'sgp30',name:'SGP30 TVOC/eCO₂ 传感器',cat:'sensor',brand:'Sensirion',price:68,qty:1,sum:68},
      {id:'bh1750',name:'BH1750 数字光照传感器',cat:'sensor',brand:'ROHM',price:9,qty:1,sum:9},
      {id:'oled-096-i2c',name:'0.96\\" OLED 显示屏 (I2C)',cat:'display',brand:'通用',price:15,qty:1,sum:15},
      {id:'lora-sx1278',name:'LoRa SX1278 433MHz 模块',cat:'comm',brand:'Semtech',price:28,qty:1,sum:28},
      {id:'psu-12v5a',name:'12V 5A 电源适配器',cat:'power',brand:'通用',price:36,qty:1,sum:36},
      {id:'lm2596-dcdc',name:'LM2596 可调降压模块',cat:'power',brand:'TI',price:7,qty:1,sum:7},
      {id:'case-3dprint',name:'定制 3D 打印外壳',cat:'mech',brand:'平台代工',price:45,qty:1,sum:45}
    ],
    cost:{subtotal:323,assembly:39,shipping:0,rush:0,total:362,itemCount:9,kinds:9},
    amount:362, service:{assembly:true,rush:false,invoice:false},
    contact:{name:'李工',phone:'13900008888',province:'广东省',city:'深圳市南山区',addr:'科技园南路 1 号 A 座 1201',email:'li@example.com',zip:'',full:'广东省 深圳市南山区 科技园南路 1 号 A 座 1201'},
    invoice:{title:'深圳某某科技有限公司',type:'电子普通发票',tax:'91440300MA5XXXXXXX'},
    note:'请预烧录固件并做 24 小时老化测试',
    payChannel:'wechat', payNo:null, paidAt:null, tracking:null, carrier:null, refund:null,
    validation:{verdict:'ok',errors:0,warnings:0,difficulty:2,hours:3.5},
    timeline:[{state:'pending',at:Date.now()-120000,note:'订单已创建'}],
    createdAt:Date.now()-120000
  }]));
  localStorage.setItem('mosaic.vid.v1','1');
})();`;

const chrome = spawn(SHELL, ['--headless', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/mosaic-vid-profile', 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(200); }

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(ok => ws.addEventListener('open', ok, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } });
const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pend.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DSF, mobile: false });

async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function goto(url) {
  await send('Page.navigate', { url });
  await sleep(1700);
  // 把吸顶导航改成静态定位：滚动截图时导航只出现在文档顶部，不会重复浮在画面中部
  await ev(`(() => {
    const st = document.createElement('style');
    st.textContent = '.nav{position:static !important;} .toast-host{display:none !important;}';
    document.head.appendChild(st);
    return 1;
  })()`);
  await sleep(250);
}

async function shot(name, { scrollTo = null, clipH = null, clipX = 0, clipW = null, wait = 700 } = {}) {
  if (scrollTo != null) {
    await ev(typeof scrollTo === 'string'
      ? `(() => { const e = document.querySelector(${JSON.stringify(scrollTo)}); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 90); return window.scrollY; })()`
      : `window.scrollTo(0, ${scrollTo}); window.scrollY`);
    await sleep(wait);
  }
  const m = await send('Page.getLayoutMetrics');
  const cw = clipW || VW;
  const ch = clipH || Math.min(MAXH, Math.ceil(m.cssContentSize.height));
  const r = await send('Page.captureScreenshot', {
    format: 'jpeg', quality: 92, captureBeyondViewport: true,
    clip: { x: clipX, y: 0, width: cw, height: ch, scale: 1 },
  });
  writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(r.data, 'base64'));
  const kb = Math.round(Buffer.from(r.data, 'base64').length / 1024);
  console.log(`  ${name.padEnd(20)} ${cw}×${ch} CSS  ${kb}KB`);
  return { name, w: cw, h: ch };
}

const manifest = [];
console.log('抓取站点素材…');

/* 首页 */
await goto(BASE + '/index.html');
manifest.push(await shot('home-full', { clipH: 2700 }));
manifest.push(await shot('home-heat', { scrollTo: '#heat', clipH: 900 }));

/* 模块库 */
await goto(BASE + '/catalog.html');
manifest.push(await shot('catalog-full', { clipH: 2100 }));
await ev(`document.querySelector('#fCat [data-val="sensor"]').click()`); await sleep(700);
manifest.push(await shot('catalog-sensor', { clipH: 1500 }));

/* 模块详情 */
await goto(BASE + '/module.html?id=esp32-s3-devkitc-1');
manifest.push(await shot('module-top', { clipH: 1100 }));
manifest.push(await shot('module-spec', { scrollTo: 1150, clipH: 1000 }));

/* 选型工作台 */
await goto(BASE + '/builder.html');
manifest.push(await shot('builder-full', { clipH: 1300 }));
manifest.push(await shot('builder-check', { scrollTo: '#col-check', clipH: 1100 }));

/* 结算 */
await goto(BASE + '/checkout.html');
manifest.push(await shot('checkout-top', { clipH: 1250 }));
manifest.push(await shot('checkout-form', { scrollTo: '#sec2', clipH: 1200 }));

/* 支付 */
await goto(BASE + '/pay.html?order=ODVID1');
manifest.push(await shot('pay-qr', { clipH: 1050 }));
await ev(`document.querySelector('#simulate').click()`); await sleep(1100);
manifest.push(await shot('pay-done', { clipH: 1050 }));

/* 后台 */
await goto(BASE + '/admin.html');
await ev(`document.querySelector('#pwd').value='mosaic-admin'; document.querySelector('#loginBtn').click(); 'go'`).catch(() => {});
await sleep(2400);
await ev(`(() => { const st=document.createElement('style'); st.textContent='.nav{position:static !important;}'; document.head.appendChild(st); return 1; })()`);
await sleep(300);
manifest.push(await shot('admin-dash', { clipH: 1100 }));
// 依次流转：待付款 → 已付款 → 备货中，然后打开发货弹层
const click = (label) => ev(`(() => { const b=[...document.querySelectorAll('#tabBody [data-act]')].find(x=>x.textContent.trim()===${JSON.stringify(label)}); if(b){b.click(); return 1;} return 0; })()`);
await click('确认收款'); await sleep(700);
await click('开始备货'); await sleep(700);
await click('发货'); await sleep(900);
await ev(`(() => { const t=document.querySelector('#tracking'); if(t) t.value='SF9988776655'; return document.querySelector('#shipModal')?.classList.contains('open') ? 1 : 0; })()`);
await sleep(500);
manifest.push(await shot('admin-ship', { clipH: 1100 }));

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\n共 ${manifest.length} 张素材 → ${OUT}`);
chrome.kill();
process.exit(0);
