#!/usr/bin/env node
/* =============================================================
   MOSAIC 小程序工程校验器
   -------------------------------------------------------------
   三类检查：
     A. 工程静态完整性（文件、JSON、JS 语法、页面注册、事件绑定）
     B. 数据层一致性（小程序 data/modules.js vs 网页版 data.js）
     C. 校验引擎一致性（小程序 compat.js vs 网页版 core.js，逐场景比对）
   退出码：0 全部通过 / 1 存在失败项
   用法：node tools/check-miniprogram.js
   ============================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');

let pass = 0, fail = 0;
const failures = [];
function ok(name, detail) {
  pass++;
  console.log('  \x1b[32m✓\x1b[0m ' + name + (detail ? '  \x1b[90m' + detail + '\x1b[0m' : ''));
}
function bad(name, detail) {
  fail++;
  failures.push(name + (detail ? ' — ' + detail : ''));
  console.log('  \x1b[31m✗\x1b[0m ' + name + (detail ? '  \x1b[31m' + detail + '\x1b[0m' : ''));
}
function eq(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) ok(name, String(actual));
  else bad(name, '实际 ' + JSON.stringify(actual) + '，期望 ' + JSON.stringify(expected));
}
function section(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

/* =============================================================
   A. 静态完整性
   ============================================================= */
section('A · 工程静态完整性');

const appJsonPath = path.join(MP, 'app.json');
let appJson = null;
try {
  appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  ok('app.json 可解析', appJson.pages.length + ' 个页面');
} catch (e) {
  bad('app.json 解析失败', e.message);
}

const REQUIRED = ['app.js', 'app.json', 'app.wxss', 'project.config.json', 'sitemap.json'];
REQUIRED.forEach(f => {
  fs.existsSync(path.join(MP, f)) ? ok('存在 ' + f) : bad('缺少 ' + f);
});

/* 每个注册页面必须齐 4 件套 */
if (appJson) {
  appJson.pages.forEach(p => {
    const miss = ['.js', '.json', '.wxml', '.wxss']
      .filter(ext => !fs.existsSync(path.join(MP, p + ext)));
    miss.length ? bad(p + ' 缺少 ' + miss.join(' ')) : ok('页面完整 ' + p);
  });
}

/* tabBar 页面必须在 pages 中 */
if (appJson && appJson.tabBar) {
  appJson.tabBar.list.forEach(t => {
    (appJson.pages || []).includes(t.pagePath)
      ? ok('tabBar 已注册 ' + t.text)
      : bad('tabBar 页面未注册 ' + t.pagePath);
  });
  const icons = appJson.tabBar.list.filter(t => t.iconPath);
  icons.forEach(t => {
    fs.existsSync(path.join(MP, t.iconPath))
      ? ok('图标存在 ' + t.iconPath)
      : bad('图标缺失 ' + t.iconPath);
  });
  console.log('  \x1b[90m（tabBar 为纯文字模式：' + (icons.length ? icons.length + ' 个带图标' : '未配置图标，合法') + '）\x1b[0m');
}

/* 所有 json 可解析 */
const jsonFiles = [];
(function walk(dir) {
  fs.readdirSync(dir).forEach(n => {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (n.endsWith('.json')) jsonFiles.push(p);
  });
})(MP);
let jsonBad = 0;
jsonFiles.forEach(f => {
  try { JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { jsonBad++; bad('JSON 解析失败 ' + path.relative(MP, f), e.message); }
});
if (!jsonBad) ok('全部 ' + jsonFiles.length + ' 个 JSON 文件格式正确');

/* 所有 js 语法检查（不执行） */
const jsFiles = [];
(function walk(dir) {
  fs.readdirSync(dir).forEach(n => {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (n.endsWith('.js')) jsFiles.push(p);
  });
})(MP);
let jsBad = 0;
jsFiles.forEach(f => {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); }
  catch (e) { jsBad++; bad('JS 语法错误 ' + path.relative(MP, f), e.message.split('\n')[0]); }
});
if (!jsBad) ok('全部 ' + jsFiles.length + ' 个 JS 文件语法正确');

/* WXML 事件绑定必须存在于对应 JS */
const jsMethodsCache = {};
function methodsOf(pageDir) {
  if (jsMethodsCache[pageDir]) return jsMethodsCache[pageDir];
  const js = fs.readFileSync(path.join(MP, pageDir + '.js'), 'utf8');
  const set = new Set();
  const re = /^\s{2,4}([A-Za-z_$][\w$]*)\s*[(:]/gm;
  let m;
  while ((m = re.exec(js))) set.add(m[1]);
  jsMethodsCache[pageDir] = set;
  return set;
}
if (appJson) {
  let bindBad = 0, bindTotal = 0;
  appJson.pages.forEach(p => {
    const wxmlPath = path.join(MP, p + '.wxml');
    if (!fs.existsSync(wxmlPath)) return;
    const wxml = fs.readFileSync(wxmlPath, 'utf8');
    const methods = methodsOf(p);
    const re = /\b(?:bind|catch)(?::)?([a-zA-Z]+)\s*=\s*"([^"{}]+)"/g;
    let m;
    while ((m = re.exec(wxml))) {
      const handler = m[2].trim();
      bindTotal++;
      if (!methods.has(handler)) {
        bindBad++;
        bad(p + ' 事件 ' + m[1] + '=' + handler + ' 在 JS 中不存在');
      }
    }
  });
  if (!bindBad) ok('WXML 事件绑定全部可解析', bindTotal + ' 处');
}

/* 禁用项：真实支付、真实网络请求（参赛定位为纯前端演示） */
let payCalls = 0, reqCalls = 0;
jsFiles.forEach(f => {
  const s = fs.readFileSync(f, 'utf8');
  if (/wx\.requestPayment\s*\(/.test(s)) { payCalls++; bad('存在真实支付调用 ' + path.relative(MP, f)); }
  if (/wx\.request\s*\(/.test(s)) { reqCalls++; bad('存在网络请求 ' + path.relative(MP, f)); }
});
if (!payCalls) ok('无 wx.requestPayment 调用（符合纯前端演示定位）');
if (!reqCalls) ok('无 wx.request 调用（无后端依赖）');

/* 体积 */
let bytes = 0;
(function walk(dir) {
  fs.readdirSync(dir).forEach(n => {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p); else bytes += st.size;
  });
})(MP);
const kb = bytes / 1024;
kb < 2048 ? ok('代码包体积 ' + kb.toFixed(1) + ' KB（上限 2048 KB）')
          : bad('代码包超过 2MB 主包上限', kb.toFixed(1) + ' KB');

/* =============================================================
   载入两套引擎
   ============================================================= */
section('B · 数据层一致性');

const MP_D = require(path.join(MP, 'data', 'modules.js'));

/* 网页版 core.js 依赖 window / document / localStorage，做最小桩 */
global.window = global;
global.document = {
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement() { return { style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } }; },
  body: { appendChild() {}, style: {}, classList: { add() {}, remove() {} } },
  documentElement: { style: {} },
};
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
global.location = { href: 'http://localhost/', search: '', hash: '' };
try {
  Object.defineProperty(global, 'navigator', { value: { userAgent: 'node' }, configurable: true });
} catch (e) { /* Node 已有只读 navigator，忽略 */ }
global.requestAnimationFrame = cb => setTimeout(cb, 0);
global.URL = global.URL || function () {};

const WEB_D = require(path.join(ROOT, 'assets', 'js', 'data.js'));
require(path.join(ROOT, 'assets', 'js', 'core.js'));
const WEB = global.Mosaic;

eq('模块总数一致', MP_D.MODULES.length, WEB_D.MODULES.length);
eq('主控数量一致', MP_D.BOARDS.length, WEB_D.BOARDS.length);
eq('分类数量一致', MP_D.CATEGORIES.length, WEB_D.CATEGORIES.length);
eq('模块 ID 集合一致',
  MP_D.MODULES.map(m => m.id).sort(),
  WEB_D.MODULES.map(m => m.id).sort());

/* 逐模块比对关键字段 */
const FIELD_BAD = [];
MP_D.MODULES.forEach(m => {
  const w = WEB_D.MODULE_MAP[m.id];
  if (!w) { FIELD_BAD.push(m.id + ' 网页版不存在'); return; }
  ['name', 'cat', 'price', 'stock'].forEach(k => {
    if (m[k] !== w[k]) FIELD_BAD.push(m.id + '.' + k + ' ' + m[k] + '≠' + w[k]);
  });
  if (JSON.stringify(m.req) !== JSON.stringify(w.req)) FIELD_BAD.push(m.id + '.req 不一致');
  if (w.caps && JSON.stringify(m.caps) !== JSON.stringify(w.caps)) FIELD_BAD.push(m.id + '.caps 不一致');
});
FIELD_BAD.length
  ? bad('模块字段一致性', FIELD_BAD.slice(0, 5).join('；') + (FIELD_BAD.length > 5 ? ' 等 ' + FIELD_BAD.length + ' 处' : ''))
  : ok('全部模块字段逐项一致', 'name/cat/price/stock/req/caps');

/* =============================================================
   C. 引擎一致性
   ============================================================= */
section('C · 校验引擎一致性');

const MP_C = require(path.join(MP, 'utils', 'compat.js'));
const WEB_C = WEB.Compat;

/* 场景集：覆盖 9 条规则与各种边界 */
const SCENARIOS = [
  { name: '空方案', items: [] },
  { name: '仅主控', items: [{ id: 'esp32-s3-devkitc-1', qty: 1 }] },
  { name: '预置演示方案', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'sht31', qty: 1 }, { id: 'sgp30', qty: 1 },
    { id: 'bh1750', qty: 1 }, { id: 'oled-096-i2c', qty: 1 }, { id: 'lora-sx1278', qty: 1 },
    { id: 'psu-12v5a', qty: 1 }, { id: 'lm2596-dcdc', qty: 1 }, { id: 'case-3dprint', qty: 1 },
  ] },
  { name: '无主控但有外设', items: [{ id: 'sht31', qty: 1 }, { id: 'oled-096-i2c', qty: 1 }] },

  /* R4 · I2C 地址冲突 */
  { name: 'R4 两个 SHT31 地址冲突', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'sht31', qty: 2 }] },
  { name: 'R4 冲突 + TCA9548A 已解决', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'sht31', qty: 2 }, { id: 'tca9548a', qty: 1 }] },

  /* R3 · 逻辑电平 */
  { name: 'R3 5V 继电器挂 3.3V 主控（无转换）', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'relay-2ch', qty: 1 }] },
  { name: 'R3 同场景 + 电平转换模块', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'relay-2ch', qty: 1 }, { id: 'level-shifter-4ch', qty: 1 }] },

  /* R8 · 驱动板与独立电源 */
  { name: 'R8 舵机缺独立电源', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'sg90', qty: 2 }] },
  { name: 'R8 舵机 + 12V 电源 + LM2596', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'sg90', qty: 2 },
    { id: 'psu-12v5a', qty: 1 }, { id: 'lm2596-dcdc', qty: 1 }] },
  { name: 'R8 直流电机缺驱动板', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'n20-motor', qty: 2 }] },
  { name: 'R8 直流电机 + TB6612', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'n20-motor', qty: 2 }, { id: 'tb6612', qty: 1 }] },

  /* R6 · 算力档位 */
  { name: 'R6 低算力主控挂中算力传感器', items: [
    { id: 'rpi-pico-2-w', qty: 1 }, { id: 'sgp30', qty: 1 }] },
  { name: 'R6 高算力主控无压力', items: [
    { id: 'rpi-5-8gb', qty: 1 }, { id: 'sgp30', qty: 1 }] },

  /* R2 · GPIO 引脚 */
  { name: 'R2 矩阵键盘 ×4 超 GPIO', items: [
    { id: 'rpi-pico-2-w', qty: 1 }, { id: 'keypad-4x4', qty: 4 }] },

  /* R7 · 总线协议能力 */
  { name: 'R7 ESP32 无 CAN 控制器', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'tja1050', qty: 1 }] },
  { name: 'R7 STM32F407 自带 CAN', items: [
    { id: 'stm32f407-disc', qty: 1 }, { id: 'tja1050', qty: 1 }] },

  /* R1 · 接口数量 / 不可用 */
  { name: 'R1 UART 数量超限', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'air724ug', qty: 1 }, { id: 'bc26', qty: 1 },
    { id: 'hc-05', qty: 1 }, { id: 'rs485-max485', qty: 1 }] },
  { name: 'R1 Arduino UNO 无 CSI 接口', items: [
    { id: 'arduino-uno-r4-wifi', qty: 1 }, { id: 'ov2640', qty: 1 }] },
  { name: 'R1 Arduino UNO 无 I2S 接口', items: [
    { id: 'arduino-uno-r4-wifi', qty: 1 }, { id: 'inmp441', qty: 1 }] },

  /* R5 · 供电能力 */
  { name: 'R5 灯环 ×2 超出 5V 供给', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'neopixel-ring16', qty: 2 }] },
  { name: 'R5 灯环 ×1 余量偏低', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'neopixel-ring16', qty: 1 }] },

  /* 成本与服务 */
  { name: '含装配服务与加急', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'sht31', qty: 1 }],
    service: { assembly: true, rush: true, invoice: true } },
  { name: '数量为 5 的同型号模块', items: [
    { id: 'esp32-s3-devkitc-1', qty: 1 }, { id: 'bh1750', qty: 5 }] },
];

let scenOk = 0, scenBad = 0;

/* 场景里引用的模块 ID 必须真实存在，否则两个引擎会一致地忽略它 → 假通过 */
const unknownIds = [];
SCENARIOS.forEach(sc => sc.items.forEach(it => {
  if (!MP_D.MODULE_MAP[it.id]) unknownIds.push(sc.name + ' → ' + it.id);
}));
unknownIds.length
  ? bad('场景引用了不存在的模块 ID', unknownIds.join('；'))
  : ok('场景模块 ID 全部有效', SCENARIOS.reduce((a, s) => a + s.items.length, 0) + ' 处引用');

SCENARIOS.forEach(sc => {
  const scheme = { items: sc.items, service: sc.service || { assembly: false, rush: false, invoice: false } };
  let a, b;
  try { a = MP_C.evaluate(JSON.parse(JSON.stringify(scheme))); }
  catch (e) { bad(sc.name + ' 小程序引擎抛错', e.message); scenBad++; return; }
  try { b = WEB_C.evaluate(JSON.parse(JSON.stringify(scheme))); }
  catch (e) { bad(sc.name + ' 网页版引擎抛错', e.message); scenBad++; return; }

  const diffs = [];
  if (a.verdict !== b.verdict) diffs.push('verdict ' + a.verdict + '≠' + b.verdict);
  if (a.errors !== b.errors) diffs.push('errors ' + a.errors + '≠' + b.errors);
  if (a.warnings !== b.warnings) diffs.push('warnings ' + a.warnings + '≠' + b.warnings);
  if (Math.abs(a.cost.total - b.cost.total) > 0.001) diffs.push('total ' + a.cost.total + '≠' + b.cost.total);
  if (a.difficulty !== b.difficulty) diffs.push('difficulty ' + a.difficulty + '≠' + b.difficulty);
  if (Math.abs(a.hours - b.hours) > 0.001) diffs.push('hours ' + a.hours + '≠' + b.hours);
  const ra = a.issues.map(i => i.rule + ':' + i.level).sort().join(',');
  const rb = b.issues.map(i => i.rule + ':' + i.level).sort().join(',');
  if (ra !== rb) diffs.push('规则集 [' + ra + ']≠[' + rb + ']');
  if (a.res.gpio !== b.res.gpio) diffs.push('gpio ' + a.res.gpio + '≠' + b.res.gpio);
  if (a.res.i2c !== b.res.i2c) diffs.push('i2c ' + a.res.i2c + '≠' + b.res.i2c);

  if (diffs.length) { scenBad++; bad(sc.name, diffs.join('；')); }
  else { scenOk++; ok(sc.name, 'verdict=' + a.verdict + ' err=' + a.errors + ' warn=' + a.warnings + ' ¥' + a.cost.total); }
});
console.log('  \x1b[90m场景一致：' + scenOk + '/' + SCENARIOS.length + '\x1b[0m');

/* 9 条规则是否都被场景触发到 */
const ALL_RULES = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];
const hitRules = new Set();
SCENARIOS.forEach(sc => {
  try {
    MP_C.evaluate({ items: sc.items, service: {} }).issues.forEach(i => hitRules.add(i.rule));
  } catch (e) { /* 已在上面报错 */ }
});
const missRules = ALL_RULES.filter(r => !hitRules.has(r));
missRules.length
  ? bad('规则覆盖不全', '未触发 ' + missRules.join(','))
  : ok('9 条规则全部被场景覆盖', ALL_RULES.join(' '));

/* 资源表 / 功耗表 / 单模块检查 */
const demo = { items: SCENARIOS[2].items, service: {} };
const rep = MP_C.evaluate(JSON.parse(JSON.stringify(demo)));
const rt = MP_C.resourceTable(rep);
const pt = MP_C.powerTable(rep);
rt.length > 0 ? ok('资源占用表可生成', rt.length + ' 行') : bad('资源占用表为空');
pt.length === 2 ? ok('功耗预算表可生成', pt.map(r => r.label + ' ' + r.needText + '/' + r.capText + 'A').join('，'))
                : bad('功耗预算表行数异常', pt.length);
const one = MP_C.checkOne('sht31', { items: [{ id: 'esp32-s3-devkitc-1', qty: 1 }], service: {} });
one.added && one.report.items.length === 2
  ? ok('单模块兼容性检查可用', 'sht31 → ' + one.report.verdict)
  : bad('单模块兼容性检查异常');

/* 成本口径 */
const c = MP_C.cost({ items: [{ id: 'esp32-s3-devkitc-1', qty: 1 }], service: { assembly: true } });
c.assembly > 0 ? ok('装配服务费计入', '¥' + c.assembly) : bad('装配服务费未计入');
const c2 = MP_C.cost({ items: [], service: {} });
c2.total === 0 ? ok('空方案总额为 0') : bad('空方案总额异常', c2.total);

/* =============================================================
   汇总
   ============================================================= */
console.log('\n' + '─'.repeat(56));
console.log('\x1b[1m结果：\x1b[0m' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) {
  console.log('\x1b[31m失败项：\x1b[0m');
  failures.forEach(f => console.log('  · ' + f));
  process.exit(1);
} else {
  console.log('\x1b[32m全部通过\x1b[0m');
  process.exit(0);
}
