#!/usr/bin/env node
/* =============================================================
   MOSAIC 小程序运行时模拟器
   -------------------------------------------------------------
   微信开发者工具未安装时，用 Node 模拟宿主环境，真实执行
   App / Page 的生命周期与主要交互，抓静态检查发现不了的运行时错误。
   不渲染 WXML，因此只验证逻辑层。
   用法：node tools/simulate-miniprogram.js
   ============================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const MP = path.resolve(__dirname, '..', 'miniprogram');

let pass = 0, fail = 0;
const failures = [];
function ok(n, d) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + n + (d ? '  \x1b[90m' + d + '\x1b[0m' : '')); }
function bad(n, d) { fail++; failures.push(n + (d ? ' — ' + d : '')); console.log('  \x1b[31m✗\x1b[0m ' + n + (d ? '  \x1b[31m' + d + '\x1b[0m' : '')); }

/* ---------------- 宿主环境桩 ---------------- */
const storage = new Map();
const calls = { toast: [], modal: [], nav: [], clipboard: [] };

global.wx = {
  getStorageSync(k) { return storage.has(k) ? JSON.parse(storage.get(k)) : ''; },
  setStorageSync(k, v) { storage.set(k, JSON.stringify(v)); },
  removeStorageSync(k) { storage.delete(k); },
  showToast(o) { calls.toast.push(o && o.title); },
  showModal(o) {
    calls.modal.push(o && o.title);
    if (o && typeof o.success === 'function') o.success({ confirm: false, cancel: true });
  },
  showLoading() {}, hideLoading() {},
  navigateTo(o) { calls.nav.push('navigateTo ' + (o && o.url)); },
  redirectTo(o) { calls.nav.push('redirectTo ' + (o && o.url)); },
  switchTab(o) { calls.nav.push('switchTab ' + (o && o.url)); },
  navigateBack() { calls.nav.push('navigateBack'); },
  setClipboardData(o) { calls.clipboard.push(o && o.data); if (o && o.success) o.success(); },
  setNavigationBarTitle() {}, stopPullDownRefresh() {},
  getSystemInfoSync() { return { windowWidth: 375, windowHeight: 667, statusBarHeight: 20, platform: 'devtools', SDKVersion: '3.5.5' }; },
  createSelectorQuery() {
    const q = { select() { return q; }, selectAll() { return q; }, boundingClientRect() { return q; }, exec(cb) { if (cb) cb([]); } };
    return q;
  },
  nextTick(fn) { fn(); },
  getMenuButtonBoundingClientRect() { return { top: 24, height: 32, bottom: 56 }; },
  onWindowResize() {}, offWindowResize() {},
};

/* 避免支付轮询的 setInterval 把进程挂住 */
global.setInterval = () => 0;
global.clearInterval = () => {};

/* ---------------- App / Page 运行时 ---------------- */
let appCfg = null;
let appInst = null;
global.App = cfg => { appCfg = cfg; };
global.getApp = () => appInst;

let pageCfg = null;
global.Page = cfg => { pageCfg = cfg; };
global.Component = cfg => { pageCfg = cfg; };

function clone(o) { return JSON.parse(JSON.stringify(o === undefined ? null : o)); }

/* setData 支持 'a.b.c' 路径键 */
function applyPath(target, key, value) {
  const parts = key.split('.');
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function instantiate(cfg) {
  const inst = Object.create(null);
  Object.keys(cfg).forEach(k => { if (k !== 'data') inst[k] = cfg[k]; });
  inst.data = clone(cfg.data || {});
  inst.setData = function (patch, cb) {
    if (!patch || typeof patch !== 'object') throw new Error('setData 入参不是对象');
    Object.keys(patch).forEach(k => {
      if (patch[k] === undefined) throw new Error('setData 传入 undefined：' + k);
      applyPath(inst.data, k, patch[k]);
    });
    if (typeof cb === 'function') cb.call(inst);
  };
  return inst;
}

function loadApp() {
  require(path.join(MP, 'app.js'));
  if (!appCfg) throw new Error('app.js 未调用 App()');
  appInst = instantiate(appCfg);
  appInst.globalData = appCfg.globalData || {};
  if (typeof appInst.onLaunch === 'function') appInst.onLaunch.call(appInst, {});
  if (typeof appInst.onShow === 'function') appInst.onShow.call(appInst, {});
}

function loadPage(rel, options) {
  pageCfg = null;
  const jsPath = path.join(MP, rel + '.js');
  delete require.cache[require.resolve(jsPath)];
  require(jsPath);
  if (!pageCfg) throw new Error(rel + ' 未调用 Page()');
  const inst = instantiate(pageCfg);
  const seq = [];
  const run = (name, arg) => {
    if (typeof inst[name] === 'function') { inst[name].call(inst, arg); seq.push(name); }
  };
  return { inst, run, seq, options };
}

/* ---------------- 开始 ---------------- */
console.log('\n\x1b[1m小程序运行时模拟（逻辑层）\x1b[0m');

try {
  loadApp();
  ok('App 启动与 onLaunch', '演示方案已写入本地存储');
} catch (e) {
  bad('App 启动失败', e.message);
}

/* 每个页面：生命周期 + 代表性交互 */
const PAGES = [
  {
    rel: 'pages/index/index', name: '首页', options: {},
    steps: p => {
      p.run('onLoad', {}); p.run('onShow');
      p.run('onRange', { currentTarget: { dataset: { r: '7d' } } });
      p.run('onRange', { currentTarget: { dataset: { r: '30d' } } });
      p.run('onCatTap', { currentTarget: { dataset: { id: 'sensor' } } });
      p.run('onHeatCat', { detail: { value: 0 } });          /* picker：0 = 全部 */
      p.run('onHeatCat', { detail: { value: 1 } });          /* picker：第 1 个分类 */
      p.run('onHeatCatTap', { currentTarget: { dataset: { id: 'sensor' } } });
      p.run('onHeatTap', { currentTarget: { dataset: { id: 'sht31' } } });
      p.run('refreshScheme'); p.run('refreshHeat');
    },
  },
  {
    rel: 'pages/catalog/catalog', name: '模块库', options: {},
    steps: p => {
      p.run('onLoad', {}); p.run('onShow');
      p.run('onSearch', { detail: { value: 'esp32' } });
      p.run('onSearch', { detail: { value: '' } });
      p.run('pick', { currentTarget: { dataset: { k: 'cat', v: 'sensor' } } });
      p.run('pick', { currentTarget: { dataset: { k: 'bus', v: 'i2c' } } });
      p.run('onPrice', { detail: { value: 500 } });
      p.run('onSort', { detail: { value: 1 } });
      p.run('onStockOnly', { detail: { value: ['1'] } });
      p.run('onStockOnly', { detail: { value: [] } });
      p.run('resetAll');
      p.run('add', { currentTarget: { dataset: { id: 'bh1750' } } });
      p.run('add', { currentTarget: { dataset: { id: 'rpi-5-8gb' } } });   /* 替换主控分支 */
    },
  },
  {
    rel: 'pages/detail/detail', name: '模块详情', options: { id: 'sht31' },
    steps: p => {
      p.run('onLoad', p.options);
      p.run('inc'); p.run('dec'); p.run('dec');
      p.run('add');
      p.run('buyNow');
    },
  },
  {
    rel: 'pages/builder/builder', name: '选型工作台', options: {},
    steps: p => {
      p.run('onLoad', {}); p.run('onShow');
      p.run('openPicker'); p.run('onPickQ', { detail: { value: 'sg' } });
      p.run('pickCatTap', { currentTarget: { dataset: { id: 'sensor' } } });
      p.run('pickAdd', { currentTarget: { dataset: { id: 'sht31' } } });
      p.run('closePicker');
      p.run('inc', { currentTarget: { dataset: { id: 'sht31' } } });
      p.run('dec', { currentTarget: { dataset: { id: 'sht31' } } });
      p.run('toggleService', { currentTarget: { dataset: { k: 'assembly' } } });
      p.run('toggleService', { currentTarget: { dataset: { k: 'rush' } } });
      p.run('toggleService', { currentTarget: { dataset: { k: 'invoice' } } });
      p.run('toggleService', { currentTarget: { dataset: { k: 'assembly' } } });
      p.run('goDetail', { currentTarget: { dataset: { id: 'sht31' } } });
      p.run('render');
    },
  },
  {
    rel: 'pages/summary/summary', name: '方案汇总', options: {},
    steps: p => {
      p.run('onShow'); p.run('render');
      p.run('copyBom');
      p.run('goCheckout');
    },
  },
  {
    rel: 'pages/checkout/checkout', name: '结算下单', options: {},
    steps: p => {
      p.run('onLoad', {});
      p.run('onInput', { currentTarget: { dataset: { k: 'name' } }, detail: { value: '张三' } });
      p.run('onInput', { currentTarget: { dataset: { k: 'phone' } }, detail: { value: '13800138000' } });
      p.run('onInput', { currentTarget: { dataset: { k: 'addr' } }, detail: { value: '浙江省杭州市余杭区文一西路 969 号' } });
      p.run('onProvince', { detail: { value: '浙江省' } });
      p.run('toggleInvoice'); p.run('toggleAgree');
      p.run('pickChannel', { currentTarget: { dataset: { id: 'wechat' } } });
      p.run('validate');
      p.run('renderCost');
      p.run('onUnload');
    },
  },
  {
    rel: 'pages/orders/orders', name: '我的订单', options: {},
    steps: p => {
      p.run('onShow'); p.run('render');
      p.run('pickFilter', { currentTarget: { dataset: { id: 'all' } } });
      p.run('pickFilter', { currentTarget: { dataset: { id: 'pending' } } });
      p.run('goCatalog');
    },
  },
  {
    rel: 'pages/mine/mine', name: '我的', options: {},
    steps: p => {
      p.run('onShow'); p.run('render');
      p.run('copyLink');
      p.run('goBuilder'); p.run('goOrders'); p.run('goCatalog');
    },
  },
];

PAGES.forEach(pg => {
  try {
    const p = loadPage(pg.rel, pg.options);
    pg.steps(p);
    ok(pg.name + ' 生命周期与交互', p.seq.join(' → '));
  } catch (e) {
    bad(pg.name + ' 运行时错误', e.message + (e.stack ? '\n      ' + e.stack.split('\n')[1].trim() : ''));
  }
});

/* ---------------- 数据流断言 ---------------- */
console.log('\n\x1b[1m数据流断言\x1b[0m');
try {
  const D = require(path.join(MP, 'data', 'modules.js'));
  const Store = require(path.join(MP, 'utils', 'store.js'));
  const Compat = require(path.join(MP, 'utils', 'compat.js'));

  const s0 = Store.scheme();
  s0.items.length > 0 ? ok('App 初始化写入了演示方案', s0.items.length + ' 个模块') : bad('演示方案未写入');

  Store.addItem('bh1750', 1);
  const q1 = Store.qtyOf(Store.scheme(), 'bh1750');
  q1 >= 1 ? ok('加购后数量递增', 'bh1750 × ' + q1) : bad('加购未生效');

  Store.setQty('bh1750', 0);
  Store.qtyOf(Store.scheme(), 'bh1750') === 0 ? ok('数量置 0 时自动移除') : bad('数量置 0 未移除');

  Store.addItem('rpi-5-8gb', 1);
  const boards = Store.scheme().items.filter(i => D.MODULE_MAP[i.id] && D.MODULE_MAP[i.id].cat === 'board');
  boards.length === 1 && boards[0].id === 'rpi-5-8gb'
    ? ok('主控互斥：新主控替换旧主控', boards[0].id)
    : bad('主控互斥失效', JSON.stringify(boards));

  const o = Store.createOrder({ items: Store.scheme().items, total: 100, address: { name: '张三' } });
  Store.order(o.id) ? ok('订单创建并可查询', o.no) : bad('订单创建失败');
  const o2 = Store.setState(o.id, 'paid', '支付成功');
  o2.state === 'paid' && o2.timeline.length >= 2 ? ok('订单状态流转与时间线', o2.timeline.length + ' 条') : bad('状态流转失败');

  Store.recordHeat('view', 'sht31');
  Store.localHeatScore() ? ok('热度埋点与本地得分可用') : bad('热度得分为空');

  const rep = Compat.evaluate(Store.scheme());
  rep.items.length > 0 ? ok('当前方案可评估', 'verdict=' + rep.verdict + ' ¥' + rep.cost.total) : bad('方案评估为空');

  Store.resetDemo();
  Store.scheme().items.length === 0 ? ok('重置演示数据生效') : bad('重置未清空方案');
} catch (e) {
  bad('数据流断言异常', e.message);
}

console.log('\n' + '─'.repeat(56));
console.log('\x1b[1m结果：\x1b[0m' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) {
  console.log('\x1b[31m失败项：\x1b[0m');
  failures.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log('\x1b[32m全部通过\x1b[0m');
process.exit(0);
