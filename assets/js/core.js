/* =============================================================
   MOSAIC · 核心运行时
   -------------------------------------------------------------
   模块划分：
     U        — 通用工具
     ICO      — 线性图标集
     Store    — 本地持久化（方案草稿 / 订单 / 热度埋点 / 后台会话）
     Compat   — 兼容性校验引擎（9 条规则 + 资源占用 + 功耗 + 成本 + 难度）
     Heat     — 选型热度引擎（基线 × 本机行为加权）
     Pay      — 支付适配层（微信 / 支付宝 / 演示，预留真实服务端接入）
     UI       — 导航、页脚、Toast、抽屉、弹层、二维码占位渲染
   ============================================================= */
(function (global) {
  'use strict';
  const D = global.MosaicData;

  /* ============ U · 通用工具 ============ */
  const U = {
    $(sel, root) { return (root || document).querySelector(sel); },
    $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); },
    on(node, ev, fn, opt) { if (node) node.addEventListener(ev, fn, opt); return node; },
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    money(n, withCur) {
      const v = Number(n || 0);
      const s = v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return (withCur === false ? '' : D.SITE.currency) + s;
    },
    int(n) { return Number(n || 0).toLocaleString('zh-CN'); },
    pct(n, d) { return (Number(n) >= 0 ? '+' : '') + Number(n).toFixed(d == null ? 1 : d) + '%'; },
    params() { return Object.fromEntries(new URLSearchParams(location.search).entries()); },
    uid(prefix) {
      const t = Date.now().toString(36).toUpperCase();
      const r = Math.random().toString(36).slice(2, 7).toUpperCase();
      return (prefix || '') + t + r;
    },
    orderNo() {
      const d = new Date();
      const p = n => String(n).padStart(2, '0');
      return `MS${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
             `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}` +
             Math.floor(Math.random() * 900 + 100);
    },
    date(ts, withTime) {
      const d = new Date(ts);
      const p = n => String(n).padStart(2, '0');
      const base = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      return withTime ? `${base} ${p(d.getHours())}:${p(d.getMinutes())}` : base;
    },
    debounce(fn, wait) {
      let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), wait || 220); };
    },
    clamp(n, a, b) { return Math.min(b, Math.max(a, n)); },
    hash(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return Math.abs(h >>> 0);
    },
    /* 可复现的伪随机（同 id 每次结果一致，用于趋势线与二维码占位） */
    rng(seed) {
      let s = U.hash(String(seed)) || 1;
      return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s = s >>> 0; return s / 4294967296; };
    },
    copy(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      return Promise.resolve();
    },
    download(filename, content, mime) {
      const blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
    },
    qtyOf(scheme, id) {
      const it = (scheme.items || []).find(i => i.id === id);
      return it ? it.qty : 0;
    },
  };

  /* ============ ICO · 线性图标 ============ */
  const P = {
    chip: 'M7 7h10v10H7zM9 3v2M12 3v2M15 3v2M9 19v2M12 19v2M15 19v2M3 9h2M3 12h2M3 15h2M19 9h2M19 12h2M19 15h2',
    wave: 'M2 12h3l2-6 3 12 3-9 2 5 2-3h5',
    gear: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5v.2a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H10a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V10a1.6 1.6 0 001.5 1h.2a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
    battery: 'M3 8h13a2 2 0 012 2v4a2 2 0 01-2 2H3zM20 11v2M6 11v2M9 11v2',
    signal: 'M4 20V10M9 20V6M14 20V13M19 20V4',
    screen: 'M3 4h18v12H3zM8 20h8M12 16v4',
    cube: 'M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2zM12 12.4l8-4.4M12 12.4v8.8M12 12.4L4 8',
    layers: 'M12 2.8l9 4.6-9 4.6-9-4.6zM3 12l9 4.6 9-4.6M3 16.6l9 4.6 9-4.6',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    doc: 'M6 2.5h8l4 4v15H6zM14 2.5v4h4M9 12h6M9 16h6',
    sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
    shield: 'M12 2.5l8 3v6c0 5-3.4 9-8 10.5C7.4 20.5 4 16.5 4 11.5v-6zM9 12l2 2 4-4',
    list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
    flame: 'M12 22c4 0 7-2.7 7-6.6 0-4.6-4-6.4-4-10.4 0-1-.5-2-1.5-3-.3 2-1.4 3-2.5 4C9 8 8 9.6 8 11.4c-1-.6-1.6-1.6-1.8-2.6C5 10 5 12 5 13.4 5 18.3 8 22 12 22z',
    cart: 'M2.5 3h2.6l2.4 12h11l2-8H6M9 20.5h.01M18 20.5h.01',
    console: 'M3 4h18v16H3zM7 9l3 3-3 3M13 15h4',
    cap: 'M2.5 8.5L12 4l9.5 4.5L12 13zM6 10.6V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.4',
    wrench: 'M14.5 6a4.5 4.5 0 005.8 5.8l-9 9a2.5 2.5 0 01-3.6-3.6l9-9z',
    rocket: 'M12 2.5c3 2 5 5.5 5 9.5l-5 3-5-3c0-4 2-7.5 5-9.5zM9.5 16.5L7 21M14.5 16.5L17 21M12 9.5h.01',
    book: 'M4 4h6a2 2 0 012 2v14a2 2 0 00-2-2H4zM20 4h-6a2 2 0 00-2 2v14a2 2 0 012-2h6z',
    sparkle: 'M12 2.5l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
    search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
    filter: 'M3 5h18l-7 8v6l-4-2v-4z',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
    close: 'M6 6l12 12M18 6L6 18',
    check: 'M4 12.5l5 5L20 6.5',
    warn: 'M12 3l9.5 17H2.5zM12 9v5M12 17.5h.01',
    info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    download: 'M12 3v12M7 11l5 5 5-5M4 21h16',
    box: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
    truck: 'M2 6h11v10H2zM13 10h5l3 3v3h-8M6 19.5h.01M17 19.5h.01',
    card: 'M2.5 5.5h19v13h-19zM2.5 10h19M6 14.5h4',
    qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM6 6h1M17 6h1M6 17h1M14 14h3v3h-3zM19 14h2v2M14 19h2v2M19 19h2v2',
    menu: 'M3 6h18M3 12h18M3 18h18',
    chevron: 'M9 5l7 7-7 7',
    down: 'M6 9l6 6 6-6',
    refresh: 'M21 12a9 9 0 11-3-6.7M21 4v5h-5',
    eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
    cpu: 'M9 9h6v6H9zM4 4h16v16H4z',
    plug: 'M9 3v6M15 3v6M6 9h12v4a6 6 0 01-12 0zM12 19v3',
    clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5V12l3 2',
    pin: 'M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
    lock: 'M5 11h14v10H5zM8.5 11V7.5a3.5 3.5 0 017 0V11',
    star: 'M12 3l2.8 6 6.2.8-4.5 4.3 1.1 6.1L12 17.3 6.4 20.2l1.1-6.1L3 9.8l6.2-.8z',
    zap: 'M13 2L4 14h7l-1 8 9-12h-7z',
    swap: 'M7 4v12M3.5 12.5L7 16l3.5-3.5M17 20V8M13.5 11.5L17 8l3.5 3.5',
  };
  const ICO = {
    has(n) { return !!P[n]; },
    svg(n, size, extra) {
      const d = P[n] || P.box;
      return `<svg viewBox="0 0 24 24" width="${size || 20}" height="${size || 20}" fill="none" ` +
             `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ` +
             `aria-hidden="true" ${extra || ''}><path d="${d}"/></svg>`;
    },
    /* 实心版本（用于星级、火焰） */
    solid(n, size, color) {
      const d = P[n] || P.box;
      return `<svg viewBox="0 0 24 24" width="${size || 14}" height="${size || 14}" fill="${color || 'currentColor'}" ` +
             `stroke="none" aria-hidden="true"><path d="${d}"/></svg>`;
    },
  };

  /* ============ Store · 本地持久化 ============ */
  const KEY = {
    scheme: 'mosaic.scheme.v1',
    schemes: 'mosaic.schemes.v1',
    orders: 'mosaic.orders.v1',
    heat: 'mosaic.heat.v1',
    admin: 'mosaic.admin.v1',
    form: 'mosaic.checkout.v1',
  };
  const Store = {
    read(k, fallback) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    write(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch (e) { return false; }
    },
    remove(k) { try { localStorage.removeItem(k); } catch (e) {} },

    /* --- 当前方案草稿 --- */
    emptyScheme(name) {
      return {
        id: U.uid('SC'),
        name: name || '未命名方案',
        items: [],
        note: '',
        service: { assembly: false, rush: false, invoice: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    },
    scheme() {
      let s = Store.read(KEY.scheme, null);
      if (!s || !Array.isArray(s.items)) { s = Store.emptyScheme(); Store.write(KEY.scheme, s); }
      return s;
    },
    saveScheme(s) { s.updatedAt = Date.now(); Store.write(KEY.scheme, s); return s; },
    resetScheme() { const s = Store.emptyScheme(); Store.write(KEY.scheme, s); return s; },
    addItem(id, qty) {
      const s = Store.scheme();
      const ex = s.items.find(i => i.id === id);
      const m = D.MODULE_MAP[id];
      if (!m) return s;
      /* 主控类互斥：同分类只能有一个主控 */
      if (m.cat === 'board' && ex === undefined) {
        s.items = s.items.filter(i => (D.MODULE_MAP[i.id] || {}).cat !== 'board');
      }
      if (ex) ex.qty = U.clamp(ex.qty + (qty || 1), 1, 99);
      else s.items.push({ id, qty: qty || 1 });
      return Store.saveScheme(s);
    },
    setQty(id, qty) {
      const s = Store.scheme();
      const it = s.items.find(i => i.id === id);
      if (!it) return s;
      if (qty <= 0) s.items = s.items.filter(i => i.id !== id);
      else it.qty = U.clamp(qty, 1, 99);
      return Store.saveScheme(s);
    },
    removeItem(id) {
      const s = Store.scheme();
      s.items = s.items.filter(i => i.id !== id);
      return Store.saveScheme(s);
    },
    clearItems() { const s = Store.scheme(); s.items = []; return Store.saveScheme(s); },
    count() { return Store.scheme().items.reduce((a, i) => a + i.qty, 0); },

    /* --- 方案模板库 --- */
    schemes() { return Store.read(KEY.schemes, []); },
    saveAsTemplate() {
      const s = Store.scheme();
      const list = Store.schemes();
      const copy = JSON.parse(JSON.stringify(s));
      copy.id = U.uid('SC');
      copy.name = s.name;
      copy.savedAt = Date.now();
      const i = list.findIndex(x => x.name === copy.name);
      if (i >= 0) list[i] = copy; else list.unshift(copy);
      Store.write(KEY.schemes, list.slice(0, 40));
      return copy;
    },
    loadTemplate(id) {
      const t = Store.schemes().find(x => x.id === id);
      if (!t) return null;
      const s = JSON.parse(JSON.stringify(t));
      s.id = U.uid('SC'); s.updatedAt = Date.now();
      Store.write(KEY.scheme, s);
      return s;
    },
    deleteTemplate(id) { Store.write(KEY.schemes, Store.schemes().filter(x => x.id !== id)); },

    /* --- 订单 --- */
    orders() { return Store.read(KEY.orders, []); },
    order(id) { return Store.orders().find(o => o.id === id || o.no === id); },
    putOrder(o) {
      const list = Store.orders();
      const i = list.findIndex(x => x.id === o.id);
      if (i >= 0) list[i] = o; else list.unshift(o);
      Store.write(KEY.orders, list);
      return o;
    },
    createOrder(payload) {
      const o = Object.assign({
        id: U.uid('OD'),
        no: U.orderNo(),
        state: 'pending',
        createdAt: Date.now(),
        timeline: [{ state: 'pending', at: Date.now(), note: '订单已创建' }],
        payChannel: null, payNo: null, paidAt: null,
        tracking: null, carrier: null, adminNote: '', refund: null,
      }, payload);
      return Store.putOrder(o);
    },
    setState(id, state, note, extra) {
      const o = Store.order(id);
      if (!o) return null;
      o.state = state;
      o.timeline = o.timeline || [];
      o.timeline.push({ state, at: Date.now(), note: note || (D.STATE_MAP[state] || {}).name });
      Object.assign(o, extra || {});
      return Store.putOrder(o);
    },
    /* 库存（本地模拟：真实环境由服务端扣减） */
    stockDelta(id, delta) {
      const inv = Store.read('mosaic.stock.v1', {});
      const base = (D.MODULE_MAP[id] || {}).stock || 0;
      inv[id] = U.clamp((inv[id] == null ? base : inv[id]) + delta, 0, 99999);
      Store.write('mosaic.stock.v1', inv);
      return inv[id];
    },
    stockOf(id) {
      const inv = Store.read('mosaic.stock.v1', {});
      return inv[id] == null ? ((D.MODULE_MAP[id] || {}).stock || 0) : inv[id];
    },
    resetDemo() {
      Store.remove(KEY.orders); Store.remove('mosaic.stock.v1');
      Store.remove(KEY.scheme); Store.remove(KEY.heat); Store.remove(KEY.form);
    },

    /* --- 后台会话 --- */
    adminIn() { const a = Store.read(KEY.admin, null); return !!(a && a.at && Date.now() - a.at < 8 * 3600 * 1000); },
    adminLogin(pwd) {
      if (pwd === 'mosaic-admin') { Store.write(KEY.admin, { at: Date.now() }); return true; }
      return false;
    },
    adminOut() { Store.remove(KEY.admin); },

    /* --- 结算表单草稿 --- */
    form() { return Store.read(KEY.form, {}); },
    saveForm(f) { Store.write(KEY.form, f); },
  };

  /* ============ Compat · 兼容性校验引擎 ============ */
  const Compat = {
    RULES: [
      { id: 'R0', level: 'err', title: '缺少主控开发板' },
      { id: 'R1', level: 'err', title: '接口数量超限' },
      { id: 'R2', level: 'err', title: 'GPIO 引脚不足' },
      { id: 'R3', level: 'warn', title: '逻辑电平不匹配' },
      { id: 'R4', level: 'warn', title: 'I2C 地址冲突' },
      { id: 'R5', level: 'err', title: '供电能力不足' },
      { id: 'R6', level: 'err', title: '算力档位不足' },
      { id: 'R7', level: 'err', title: '缺少必需的总线协议' },
      { id: 'R8', level: 'warn', title: '缺少驱动板或外接电源' },
    ],

    /* 展开方案为明细列表 */
    items(scheme) {
      return (scheme.items || [])
        .map(i => { const m = D.MODULE_MAP[i.id]; return m ? { m, qty: i.qty } : null; })
        .filter(Boolean);
    },

    /* 汇总单价与总价 */
    cost(scheme, opts) {
      const o = opts || {};
      const items = Compat.items(scheme);
      const lines = items.map(({ m, qty }) => ({
        id: m.id, name: m.name, cat: m.cat, brand: m.brand,
        price: m.price, qty, sum: m.price * qty, unit: '件',
      }));
      const subtotal = lines.reduce((a, l) => a + l.sum, 0);
      const svc = scheme.service || {};
      const assembly = svc.assembly ? D.SHIPPING.assemblyFee : 0;
      const goods = subtotal + assembly;
      const shipBase = goods >= D.SHIPPING.freeThreshold ? 0 : D.SHIPPING.fee;
      const shipping = goods > 0 ? shipBase : 0;
      const rush = svc.rush ? Math.round(goods * D.SHIPPING.rushFeeRate * 100) / 100 : 0;
      const total = goods + shipping + rush;
      return { lines, subtotal, assembly, shipping, rush, total, itemCount: items.reduce((a, x) => a + x.qty, 0), kinds: lines.length };
    },

    /* 主校验入口 */
    evaluate(scheme) {
      const items = Compat.items(scheme);
      const issues = [];
      const boardEntry = items.find(x => x.m.cat === 'board');
      const board = boardEntry ? boardEntry.m : null;

      /* 资源占用统计 */
      const res = { i2c: 0, spi: 0, uart: 0, i2s: 0, csi: 0, pwm: 0, adc: 0, gpio: 0, onewire: 0, addr: {} };
      items.forEach(({ m, qty }) => {
        const r = m.req;
        if (m.cat === 'board' || m.cat === 'mech' || m.cat === 'power') return;
        for (let k = 0; k < qty; k++) {
          if (r.bus === 'i2c') { res.i2c++; if (r.addrHex) (res.addr[r.addrHex] = res.addr[r.addrHex] || []).push(m.id); }
          else if (r.bus === 'spi') res.spi++;
          else if (r.bus === 'uart') res.uart++;
          else if (r.bus === 'i2s') res.i2s++;
          else if (r.bus === 'csi') res.csi++;
          else if (r.bus === 'pwm') res.pwm++;
          else if (r.bus === 'adc') res.adc++;
          else if (r.bus === 'onewire') res.onewire++;
          res.gpio += r.pins || 0;
        }
      });

      /* 电源负载 */
      const load = { v5: 0, v33: 0, v12: 0, peak5: 0 };
      const supplies = { v5: 0, v33: 0, v12: 0 };
      const rails = {};
      items.forEach(({ m, qty }) => {
        if (m.cat === 'power') {
          const r = m.req;
          if (r.kind === 'source' || r.kind === 'converter') {
            if (r.vout) supplies['v' + String(r.vout).replace('.', '')] = (supplies['v' + String(r.vout).replace('.', '')] || 0) + (r.aout || 0);
            if (r.vout === 5) supplies.v5 += (r.aout || 0);
            if (r.vout === 3.3) supplies.v33 += (r.aout || 0);
            if (r.vout === 12) supplies.v12 += (r.aout || 0);
            if (r.vout === 11.1) supplies.v12 += 3;   /* 3S 锂电等效可用 12V 轨 */
            if (r.vout === 7.4) supplies.v5 += 2;     /* 2S 锂电降压后可用 5V 轨 */
          }
          return;
        }
        if (m.cat === 'mech' && !m.req.mA) return;
        const r = m.req;
        const amp = (r.peak || r.mA || 0) / 1000 * qty;
        if (r.rail) rails[r.rail] = (rails[r.rail] || 0) + amp;
        if (r.ext && r.rail) { /* 外接电源设备不计入主控 5V/3.3V 预算 */ }
        else if (r.v && /5/.test(r.v)) { load.v5 += amp; load.peak5 += amp; }
        else if (r.v && /3\.3/.test(r.v)) { load.v33 += amp; }
      });
      if (board) { supplies.v5 += (board.caps.mA5 || 0) / 1000; supplies.v33 += (board.caps.mA33 || 0) / 1000; }

      /* --- R0 --- */
      if (!board) {
        issues.push({
          rule: 'R0', level: items.length ? 'err' : 'warn',
          title: items.length ? '方案缺少主控开发板' : '方案为空',
          body: items.length
            ? '所有外设都需要一个主控来驱动。请先在「主控开发板」分类中选择一块开发板，再继续添加模块。'
            : '从左侧分类开始添加模块，建议先确定主控开发板，它是整个方案的兼容性基准。',
        });
      }

      if (board) {
        const c = board.caps;
        /* --- R1 接口数量 --- */
        const busChecks = [
          { key: 'uart', label: 'UART', need: res.uart, cap: c.uart },
          { key: 'i2s', label: 'I2S', need: res.i2s, cap: c.i2s },
          { key: 'csi', label: 'CSI 摄像头接口', need: res.csi, cap: c.csi },
          { key: 'adc', label: 'ADC 通道', need: res.adc, cap: c.adc },
          { key: 'pwm', label: 'PWM 通道', need: res.pwm, cap: c.pwm },
        ];
        busChecks.forEach(b => {
          if (b.cap === 0 && b.need > 0) {
            issues.push({ rule: 'R1', level: 'err', title: `${b.label} 不可用`, body: `${board.name} 不提供 ${b.label}，但方案中有 ${b.need} 个模块需要它。请更换主控或移除相关模块。` });
          } else if (b.need > b.cap) {
            issues.push({ rule: 'R1', level: 'err', title: `${b.label} 数量超限`, body: `需要 ${b.need} 路，${board.name} 仅提供 ${b.cap} 路，超出 ${b.need - b.cap} 路。可减少模块数量或改用 I2C 扩展方案。` });
          }
        });
        /* SPI 从设备：每个控制器最多 3 个 CS */
        const spiCap = c.spi * 3;
        if (res.spi > spiCap) {
          issues.push({ rule: 'R1', level: 'err', title: 'SPI 从设备数量超限', body: `方案中有 ${res.spi} 个 SPI 设备，${board.name} 的 ${c.spi} 个 SPI 控制器最多挂载 ${spiCap} 个从设备。` });
        }

        /* --- R2 GPIO --- */
        if (res.gpio > c.gpio) {
          issues.push({ rule: 'R2', level: 'err', title: 'GPIO 引脚不足', body: `所有模块合计占用 ${res.gpio} 个 IO，${board.name} 可用 ${c.gpio} 个，超出 ${res.gpio - c.gpio} 个。可加装 PCF8574 扩展 8 路 IO，或改用 I2C 接口的模块。` });
        }

        /* --- R3 逻辑电平 --- */
        const hasShifter = items.some(x => x.m.id === 'level-shifter-4ch');
        const fiveV = items.filter(x => x.m.req.v && /^5/.test(x.m.req.v) && x.m.cat !== 'board' && x.m.cat !== 'power');
        if (c.v === 3.3 && fiveV.length && !hasShifter) {
          issues.push({
            rule: 'R3', level: 'warn', title: '逻辑电平不匹配',
            body: `${board.name} 的 IO 为 3.3V 逻辑，但方案中有 ${fiveV.length} 个 5V 器件（${fiveV.slice(0, 3).map(x => x.m.name).join('、')}${fiveV.length > 3 ? ' 等' : ''}）。5V 输出直接进 3.3V 引脚可能损坏主控，建议加入「4 路双向电平转换」模块。`,
          });
        }
        if (c.v === 3.3 && fiveV.length && hasShifter) {
          issues.push({ rule: 'R3', level: 'ok', title: '电平已由转换模块处理', body: `方案含「4 路双向电平转换」，可覆盖 4 路 5V 信号。若 5V 器件超过 4 路，请增加转换模块数量。` });
        }

        /* --- R4 I2C 地址冲突 --- */
        const conflicts = Object.entries(res.addr).filter(([, arr]) => new Set(arr).size > 1 || arr.length > 1);
        const hasMux = items.some(x => x.m.id === 'tca9548a');
        if (conflicts.length && !hasMux) {
          conflicts.forEach(([addr, arr]) => {
            const names = [...new Set(arr)].map(id => D.MODULE_MAP[id].name);
            issues.push({
              rule: 'R4', level: 'warn', title: `I2C 地址 ${addr.toUpperCase()} 冲突`,
              body: `以下模块固定使用同一地址：${names.join('、')}。它们无法挂载在同一条 I2C 总线上，建议加入「TCA9548A I2C 多路复用器」（可分出 8 条支路），或通过 ADDR/AD0 跳线改地址。`,
            });
          });
        }
        if (conflicts.length && hasMux) {
          issues.push({ rule: 'R4', level: 'ok', title: '地址冲突已由多路复用器解决', body: `方案含 TCA9548A，可将冲突器件分挂在不同支路上。请在代码中依次切换通道读取。` });
        }

        /* --- R5 供电能力 --- */
        const cap5 = supplies.v5, cap33 = supplies.v33;
        if (load.peak5 > cap5 + 0.001) {
          issues.push({
            rule: 'R5', level: 'err', title: '5V 供电能力不足',
            body: `5V 负载峰值约 ${load.peak5.toFixed(2)} A，可用供电约 ${cap5.toFixed(2)} A，缺口 ${(load.peak5 - cap5).toFixed(2)} A。建议加入「12V 5A 电源适配器 + LM2596 降压模块」，或把大电流执行器改为独立供电。`,
          });
        } else if (load.peak5 > cap5 * 0.75 && cap5 > 0) {
          issues.push({ rule: 'R5', level: 'warn', title: '5V 供电余量偏低', body: `5V 负载峰值 ${load.peak5.toFixed(2)} A，可用 ${cap5.toFixed(2)} A，余量不足 25%。舵机与电机启动瞬间可能拉低电压导致主控复位，建议加大电源或加装大电容。` });
        }
        if (load.v33 > cap33 + 0.001) {
          issues.push({ rule: 'R5', level: 'err', title: '3.3V 供电能力不足', body: `3.3V 负载约 ${load.v33.toFixed(2)} A，可用约 ${cap33.toFixed(2)} A，缺口 ${(load.v33 - cap33).toFixed(2)} A。建议加入独立的 3.3V LDO 供电。` });
        }

        /* --- R6 算力档位 --- */
        const need = Math.max(0, ...items.filter(x => x.m.cat !== 'board').map(x => x.m.req.cls || 0));
        if (need > c.cls) {
          const heavy = items.filter(x => (x.m.req.cls || 0) > c.cls).map(x => x.m.name);
          issues.push({
            rule: 'R6', level: 'err', title: '主控算力档位不足',
            body: `${board.name} 属于「${D.CLASS_LABEL[c.cls]}」，而 ${heavy.join('、')} 需要「${D.CLASS_LABEL[need]}」。建议升级主控（如 Raspberry Pi 5 / Jetson Orin Nano）。`,
          });
        }

        /* --- R7 协议 --- */
        const protos = new Set(items.filter(x => x.m.req.proto).map(x => x.m.req.proto));
        protos.forEach(p => {
          if (p === 'wifi' && !c.wifi) issues.push({ rule: 'R7', level: 'err', title: '缺少 WiFi 能力', body: `${board.name} 不支持 WiFi，但方案中有模块需要无线联网。` });
          if (p === 'ble' && !c.ble && !c.wifi) issues.push({ rule: 'R7', level: 'warn', title: '缺少蓝牙能力', body: `${board.name} 不支持蓝牙，需要蓝牙连接的模块将无法工作，可加装 HC-05 或更换主控。` });
          if (p === 'can' && !c.can) issues.push({ rule: 'R7', level: 'err', title: '主控不含 CAN 控制器', body: `CAN 收发模块需要主控内置 CAN 控制器。${board.name} 不提供，请改用 STM32F407 等带 CAN 的主控。` });
        });

        /* --- R8 驱动 / 外接电源 --- */
        const drivers = items.filter(x => x.m.req.driver).map(x => x.m);
        const motors = items.filter(x => x.m.cat === 'actuator').map(x => x.m);
        const hasMotorDriver = items.some(x => ['tb6612', 'l298n', 'a4988', 'tmc2209', 'pca9685', 'esc-30a'].includes(x.m.id));
        if (motors.length && !hasMotorDriver && !drivers.some(d => d.cat === 'expand')) {
          issues.push({ rule: 'R8', level: 'warn', title: '执行器缺少驱动板', body: `方案含 ${motors.length} 个执行器，但没有任何电机 / 舵机驱动板。主控 IO 无法直接驱动电机，建议加入 TB6612（直流电机）、A4988（步进）或 PCA9685（舵机）。` });
        }
        const extNeed = items.filter(x => x.m.req.ext && x.m.req.rail);
        if (extNeed.length) {
          const railSet = new Set(extNeed.map(x => x.m.req.rail));
          /* 电源轨判定：只要存在电压不低于目标轨的电源，即可通过 DC-DC / LDO 降压得到该轨。
             留 1V 容差，用于覆盖 3S 锂电（11.1V 标称 / 12.6V 满电）驱动 12V 器件的常见场景。 */
          const powerVouts = items.filter(x => x.m.cat === 'power' && x.m.req.vout).map(x => x.m.req.vout);
          const maxVout = powerVouts.length ? Math.max.apply(null, powerVouts) : 0;
          const missing = [];
          railSet.forEach(r => { if (!(maxVout >= r - 1)) missing.push(r); });
          if (missing.length) {
            issues.push({
              rule: 'R8', level: 'warn', title: `${missing.join('V / ')}V 独立电源缺失`,
              body: `${extNeed.map(x => x.m.name).slice(0, 3).join('、')} 等模块需要独立外接电源（峰值电流远超主控供电能力），但方案中没有提供足够电压的电源或电池组。建议加入 12V 电源适配器（配 LM2596 降压）或 3S 锂电。`,
            });
          }
        }
        /* 5V 独立供电缺失（舵机类） */
        const servoNeed = items.filter(x => x.m.req.ext && x.m.req.rail === 5);
        if (servoNeed.length && !items.some(x => x.m.cat === 'power')) {
          issues.push({ rule: 'R8', level: 'warn', title: '舵机/大电流器件需要独立 5V', body: `${servoNeed.map(x => x.m.name).join('、')} 启动电流大，务必独立供电，不要从主控 5V 引脚取电，否则会导致主控复位。` });
        }
      }

      /* 电源轨提示 */
      const railNotes = Object.entries(rails).map(([v, a]) => ({ rail: Number(v), amp: a }));

      /* 成本 */
      const cost = Compat.cost(scheme);

      /* 难度评分 */
      let diff = 1;
      if (cost.kinds > 2) diff++;
      if (cost.kinds > 6) diff++;
      if (items.some(x => x.m.req.driver)) diff++;
      if (items.some(x => ['proto-board', 'pcb-fab'].includes(x.m.id))) diff++;
      if (items.some(x => x.m.req.rail === 12)) diff++;
      if (items.some(x => (x.m.req.cls || 0) >= 2)) diff++;
      diff = U.clamp(diff, 1, 5);
      const hours = Math.round((0.5 + cost.kinds * 0.28 + (items.some(x => x.m.req.driver) ? 0.6 : 0) + (items.some(x => ['proto-board', 'pcb-fab'].includes(x.m.id)) ? 1.6 : 0)) * 10) / 10;

      const errs = issues.filter(i => i.level === 'err').length;
      const warns = issues.filter(i => i.level === 'warn').length;

      return {
        items, board, res, load, supplies, rails: railNotes, cost, issues,
        errors: errs, warnings: warns,
        pass: items.length > 0 && errs === 0,
        difficulty: diff,
        hours,
        verdict: !items.length ? 'empty' : (errs ? 'block' : (warns ? 'warn' : 'ok')),
      };
    },

    /* 单模块与当前方案的兼容性（详情页用） */
    checkOne(moduleId, scheme) {
      const s = JSON.parse(JSON.stringify(scheme || Store.scheme()));
      if (!s.items.find(i => i.id === moduleId)) s.items.push({ id: moduleId, qty: 1 });
      const r = Compat.evaluate(s);
      return { report: r, added: !(scheme || Store.scheme()).items.find(i => i.id === moduleId) };
    },

    /* 资源占用表（用于展示） */
    resourceTable(rep) {
      if (!rep.board) return [];
      const c = rep.board.caps;
      const rows = [
        { label: 'GPIO 引脚', need: rep.res.gpio, cap: c.gpio, unit: '个' },
        { label: 'I2C 设备', need: rep.res.i2c, cap: c.i2c * 8, unit: '个', note: '每条总线理论可挂 8+ 个不同地址器件' },
        { label: 'SPI 从设备', need: rep.res.spi, cap: c.spi * 3, unit: '个' },
        { label: 'UART 串口', need: rep.res.uart, cap: c.uart, unit: '路' },
        { label: 'PWM 通道', need: rep.res.pwm, cap: c.pwm, unit: '路' },
        { label: 'ADC 通道', need: rep.res.adc, cap: c.adc, unit: '路' },
      ].filter(r => r.cap > 0 || r.need > 0);
      return rows.map(r => Object.assign({}, r, { pct: r.cap ? U.clamp(r.need / r.cap * 100, 0, 100) : 100, over: r.need > r.cap }));
    },

    /* 电源预算表 */
    powerTable(rep) {
      const rows = [
        { label: '5V 轨', need: rep.load.peak5, cap: rep.supplies.v5, unit: 'A' },
        { label: '3.3V 轨', need: rep.load.v33, cap: rep.supplies.v33, unit: 'A' },
      ];
      return rows.map(r => Object.assign({}, r, { pct: r.cap ? U.clamp(r.need / r.cap * 100, 0, 100) : (r.need ? 100 : 0), over: r.need > r.cap }));
    },
  };

  /* ============ Heat · 选型热度引擎 ============ */
  const Heat = {
    /* 埋点：type = view | add | order */
    record(type, id) {
      const ev = Store.read(KEY.heat, { items: {}, log: [] });
      ev.items[id] = ev.items[id] || { view: 0, add: 0, order: 0 };
      ev.items[id][type] = (ev.items[id][type] || 0) + 1;
      ev.log.unshift({ type, id, at: Date.now() });
      ev.log = ev.log.slice(0, 400);
      Store.write(KEY.heat, ev);
      return ev;
    },
    events() { return Store.read(KEY.heat, { items: {}, log: [] }); },
    clearEvents() { Store.remove(KEY.heat); },

    /* 本机行为得分（0–100），无行为返回 null */
    localScore() {
      const ev = Heat.events().items || {};
      const ids = Object.keys(ev);
      if (!ids.length) return null;
      const raw = {};
      let max = 0;
      ids.forEach(id => {
        const e = ev[id];
        raw[id] = e.view * 1 + e.add * 5 + e.order * 20;
        max = Math.max(max, raw[id]);
      });
      if (!max) return null;
      const out = {};
      ids.forEach(id => { out[id] = raw[id] / max * 100; });
      return out;
    },

    /* 同时接受时间范围 id（7d / 30d）与数据键（d7 / d30），避免调用方传错导致热度归零 */
    keyOf(rangeOrKey) {
      if (rangeOrKey === 'd7' || rangeOrKey === 'd30') return rangeOrKey;
      const r = D.HEAT_META.ranges.find(x => x.id === rangeOrKey);
      return r ? r.key : 'd7';
    },

    /* 综合热度：基线 × 0.7 + 本机 × 0.3（无本机数据时退回纯基线） */
    score(module, local, rangeKey) {
      const base = module.heat[Heat.keyOf(rangeKey)] || 0;
      if (!local) return { score: base, local: null, weighted: false };
      const l = local[module.id] || 0;
      const s = U.clamp(base * 0.7 + l * 0.3, 0, 100);
      return { score: Math.round(s * 10) / 10, local: Math.round(l * 10) / 10, weighted: true };
    },

    ranking(opts) {
      const o = Object.assign({ range: '7d', cat: 'all', limit: 0, includeLocal: true }, opts || {});
      const rk = Heat.keyOf(o.range);
      const local = o.includeLocal ? Heat.localScore() : null;
      let list = D.MODULES.filter(m => o.cat === 'all' || m.cat === o.cat);
      list = list.map(m => {
        const s = Heat.score(m, local, rk);
        /* 30 日口径的环比 = 7日 vs 30日 的偏离；7 日口径用种子 delta */
        const delta = o.range === '7d' ? m.heat.delta : Math.round((m.heat.d7 - m.heat.d30) / m.heat.d30 * 1000) / 10;
        return { module: m, score: s.score, local: s.local, weighted: s.weighted, delta, base: m.heat[rk] };
      }).sort((a, b) => b.score - a.score || b.delta - a.delta);
      if (o.limit) list = list.slice(0, o.limit);
      return list;
    },

    /* 分类热度聚合 */
    categoryHeat(range) {
      const rk = Heat.keyOf(range);
      const acc = {};
      D.CATEGORIES.forEach(c => { acc[c.id] = { cat: c, sum: 0, n: 0, top: null }; });
      D.MODULES.forEach(m => {
        const a = acc[m.cat];
        a.sum += m.heat[rk]; a.n++;
        if (!a.top || m.heat[rk] > a.top.heat[rk]) a.top = m;
      });
      const rows = Object.values(acc).map(a => ({ cat: a.cat, avg: Math.round(a.sum / a.n * 10) / 10, n: a.n, top: a.top }));
      const max = Math.max(...rows.map(r => r.avg), 1);
      return rows.map(r => Object.assign(r, { pct: Math.round(r.avg / max * 100) })).sort((a, b) => b.avg - a.avg);
    },

    /* 迷你趋势线（14 点，种子可复现，末端收敛到当前值） */
    sparkline(module, range) {
      const rnd = U.rng(module.id + (range || '7d'));
      const n = 14;
      const end = module.heat[Heat.keyOf(range)];
      const slope = (module.heat.delta || 0) / 100 / n * 2.2;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const target = end * (1 - slope * (1 - t));
        const noise = (rnd() - 0.5) * end * 0.055;
        pts.push(Math.max(1, target + noise));
      }
      pts[n - 1] = end;
      return pts;
    },

    sparkSVG(pts, opts) {
      const o = Object.assign({ w: 88, h: 26, color: '#6d4ee0' }, opts || {});
      const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
      const d = pts.map((v, i) => {
        const x = (i / (pts.length - 1)) * o.w;
        const y = o.h - ((v - min) / span) * (o.h - 4) - 2;
        return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ');
      return `<svg class="spark" width="${o.w}" height="${o.h}" viewBox="0 0 ${o.w} ${o.h}" aria-hidden="true">` +
             `<path d="${d}" fill="none" stroke="${o.color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    },

    /* 热度条渲染（列表行） */
    rowHTML(entry, rank, opts) {
      const o = opts || {};
      const m = entry.module;
      const cat = D.CATEGORIES.find(c => c.id === m.cat);
      const cls = entry.delta > 0 ? 'up' : (entry.delta < 0 ? 'down' : 'flat');
      const arrow = entry.delta > 0 ? '▲' : (entry.delta < 0 ? '▼' : '—');
      const top = rank <= 3 ? ` top${rank}` : '';
      return `<div class="heat-row${top}" data-module="${m.id}" role="button" tabindex="0">
        <span class="heat-rank">${String(rank).padStart(2, '0')}</span>
        <div>
          <span class="heat-name">${U.esc(m.name)}${entry.weighted ? ' <span class="tag tag-accent" style="font-size:.6rem">本机加权</span>' : ''}</span>
          <span class="heat-sub">${U.esc(cat ? cat.name : '')} · ${U.esc(m.brand)}${o.showSpark === false ? '' : ''}</span>
          <div class="heat-bar"><i style="width:${entry.score}%"></i></div>
        </div>
        <div style="text-align:right">
          <span class="heat-val">${entry.score.toFixed(1)}</span>
          <span class="heat-delta ${cls}">${arrow} ${U.pct(entry.delta)}</span>
        </div>
      </div>`;
    },
  };

  /* ============ Pay · 支付适配层 ============ */
  const Pay = {
    channels: D.PAY_CHANNELS,
    channel(id) { return D.PAY_CHANNELS.find(c => c.id === id) || null; },

    /* 生成支付凭据。
       真实接入时：这里改为 POST /api/pay/{channel}/create，由服务端返回 code_url / qr_code。
       前端只负责把返回的字符串渲染成二维码，其余逻辑完全一致。 */
    create(order, channelId) {
      const ch = Pay.channel(channelId) || Pay.channel('mock');
      const amount = Number(order.amount || 0);
      const seed = `${order.no}-${ch.id}-${amount}`;
      const code = ch.id === 'wechat'
        ? `weixin://wxpay/bizpayurl?pr=${U.hash(seed).toString(36).toUpperCase()}`
        : ch.id === 'alipay'
          ? `https://qr.alipay.com/${U.hash(seed + 'a').toString(36)}${U.hash(seed + 'b').toString(36).slice(0, 6)}`
          : `mosaic://demo/pay/${order.no}`;
      return {
        channel: ch.id, channelName: ch.name, mode: ch.mode,
        code, amount,
        payNo: 'PAY' + U.hash(seed).toString(36).toUpperCase().slice(0, 14),
        createdAt: Date.now(),
        expireAt: Date.now() + 30 * 60 * 1000,
        mock: ch.id === 'mock',
        /* 生产环境：服务端下单接口路径 */
        endpoint: ch.id === 'mock' ? null : `/api/pay/${ch.id}/create`,
      };
    },

    /* 查询订单支付状态。真实环境改为 GET /api/orders/{no}/status */
    query(orderId) {
      const o = Store.order(orderId);
      return o ? { state: o.state, paid: ['paid', 'picking', 'shipped', 'done'].includes(o.state), paidAt: o.paidAt } : null;
    },

    /* 支付成功落库。真实环境由服务端异步回调触发，前端只做展示。
       这里额外在订单上记录回调来源，便于后台审计。 */
    settle(orderId, payCred, via) {
      const o = Store.order(orderId);
      if (!o) return null;
      if (['paid', 'picking', 'shipped', 'done'].includes(o.state)) return o;
      const now = Date.now();
      /* 扣减库存（本地模拟） */
      (o.lines || []).forEach(l => Store.stockDelta(l.id, -l.qty));
      return Store.setState(orderId, 'paid', `支付成功 · ${payCred ? payCred.channelName : '未知渠道'}`, {
        payChannel: payCred ? payCred.channel : o.payChannel,
        payNo: payCred ? payCred.payNo : o.payNo,
        paidAt: now,
        settleVia: via || 'client-simulate',
      });
    },

    /* 支付二维码占位渲染：确定性伪随机矩阵，仅用于视觉占位 */
    qrSVG(text, opts) {
      const o = Object.assign({ size: 216, modules: 25 }, opts || {});
      const n = o.modules, cell = o.size / n, rnd = U.rng(text);
      const m = [];
      for (let y = 0; y < n; y++) { m[y] = []; for (let x = 0; x < n; x++) m[y][x] = 0; }
      const finder = (ox, oy) => {
        for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
          const edge = x === 0 || y === 0 || x === 6 || y === 6;
          const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          m[oy + y][ox + x] = (edge || core) ? 1 : 0;
        }
      };
      finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const inFinder = (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
        if (inFinder) continue;
        m[y][x] = rnd() > 0.52 ? 1 : 0;
      }
      /* 定时图案 */
      m[n - 8][8] = 1;
      let rects = '';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (m[y][x]) rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
      }
      return `<svg width="${o.size}" height="${o.size}" viewBox="0 0 ${o.size} ${o.size}" role="img" aria-label="支付二维码占位">` +
             `<rect width="${o.size}" height="${o.size}" fill="#ffffff"/>` +
             `<g fill="#101014" shape-rendering="crispEdges">${rects}</g></svg>`;
    },
  };

  /* ============ UI · 外壳 ============ */
  const NAV_ITEMS = [
    { href: 'index.html', label: '首页' },
    { href: 'submit.html', label: '作品提交' },
    { href: 'catalog.html', label: '模块库' },
    { href: 'builder.html', label: '选型工作台' },
    { href: 'orders.html', label: '我的订单' },
    { href: 'docs.html', label: '需求说明' },
    { href: 'admin.html', label: '后台' },
  ];

  const UI = {
    brandHTML() {
      return `<a class="brand" href="index.html" aria-label="MOSAIC 首页">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
            <rect x="3" y="3" width="8" height="8" rx="1.4" fill="#a78bfa"/>
            <rect x="13" y="3" width="8" height="8" rx="1.4" fill="#f2f1ee" fill-opacity=".55"/>
            <rect x="3" y="13" width="8" height="8" rx="1.4" fill="#f2f1ee" fill-opacity=".55"/>
            <rect x="13" y="13" width="8" height="8" rx="1.4" fill="#2d81ff"/>
          </svg>
        </span>
        <span>
          <span class="brand-name">${D.SITE.name} <span style="color:var(--faint);font-weight:500">${D.SITE.cn}</span></span>
          <span class="brand-sub">Hardware Composer</span>
        </span>
      </a>`;
    },
    navHTML(active) {
      const links = NAV_ITEMS.map(i =>
        `<a href="${i.href}"${i.href === active ? ' class="active" aria-current="page"' : ''}>${i.label}</a>`).join('');
      return `<nav class="nav no-print" id="siteNav">
        <div class="nav-inner">
          ${UI.brandHTML()}
          <button class="nav-toggle" id="navToggle" aria-label="展开导航" aria-expanded="false">${ICO.svg('menu', 20)}</button>
          <div class="nav-links" id="navLinks">
            ${links}
            <div class="nav-cta">
              <a class="btn btn-ghost btn-sm" href="builder.html">
                ${ICO.svg('sliders', 15)} 当前方案 <span class="nav-badge" id="navCount">0</span>
              </a>
              <a class="btn btn-primary btn-sm" href="catalog.html">开始选型</a>
            </div>
          </div>
        </div>
      </nav>`;
    },
    footHTML() {
      return `<footer class="foot no-print">
        <div class="wrap">
          <div class="foot-grid">
            <div>
              ${UI.brandHTML()}
              <p class="muted" style="margin-top:14px;max-width:34ch;font-size:.85rem">${D.SITE.desc}</p>
              <div class="row row-wrap" style="margin-top:14px">
                <span class="tag tag-line">${ICO.svg('shield', 13)} 兼容性校验</span>
                <span class="tag tag-line">${ICO.svg('card', 13)} 微信支付 / 支付宝</span>
              </div>
            </div>
            <div>
              <h4>选型</h4>
              <div class="foot-links">
                <a href="catalog.html">模块库</a>
                <a href="catalog.html?cat=board">主控开发板</a>
                <a href="catalog.html?cat=sensor">传感器</a>
                <a href="catalog.html?cat=actuator">电机与执行器</a>
                <a href="builder.html">选型工作台</a>
              </div>
            </div>
            <div>
              <h4>交易</h4>
              <div class="foot-links">
                <a href="checkout.html">结算下单</a>
                <a href="orders.html">订单查询</a>
                <a href="admin.html">后台处理</a>
                <a href="docs.html#pay">支付接入</a>
                <a href="docs.html#deploy">部署说明</a>
              </div>
            </div>
            <div>
              <h4>文档</h4>
              <div class="foot-links">
                <a href="docs.html#modules">核心功能模块</a>
                <a href="docs.html#personas">用户画像</a>
                <a href="docs.html#flow">使用流程</a>
                <a href="docs.html#pages">页面结构</a>
                <a href="docs.html#responsive">响应式设计</a>
              </div>
            </div>
          </div>
          <div class="foot-bottom">
            <span>© ${new Date().getFullYear()} ${D.SITE.name} ${D.SITE.cn} · ${D.SITE.version} · 演示环境</span>
            <span>数据存储于本机 localStorage · 支付为演示通道，不产生真实资金往来</span>
          </div>
        </div>
      </footer>`;
    },
    /* 注入导航与页脚 */
    mount(active) {
      const navHost = U.$('#navHost');
      if (navHost) navHost.outerHTML = UI.navHTML(active);
      const footHost = U.$('#footHost');
      if (footHost) footHost.outerHTML = UI.footHTML();
      if (!U.$('.toast-host')) {
        const h = document.createElement('div');
        h.className = 'toast-host'; h.id = 'toastHost';
        document.body.appendChild(h);
      }
      const sc = document.createElement('div');
      sc.className = 'scrim'; sc.id = 'scrim';
      document.body.appendChild(sc);

      const t = U.$('#navToggle');
      U.on(t, 'click', () => {
        const l = U.$('#navLinks');
        const open = l.classList.toggle('open');
        t.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      U.on(U.$('#scrim'), 'click', () => UI.closeOverlays());
      U.on(document, 'keydown', e => { if (e.key === 'Escape') UI.closeOverlays(); });
      UI.syncCount();
    },
    syncCount() {
      const n = Store.count();
      const b = U.$('#navCount');
      if (b) { b.textContent = n; b.style.display = n ? 'inline-grid' : 'none'; }
    },
    toast(msg, kind, ms) {
      const host = U.$('#toastHost') || document.body;
      const el = document.createElement('div');
      el.className = 'toast ' + (kind || 'ok');
      const ico = kind === 'err' ? 'warn' : (kind === 'warn' ? 'info' : 'check');
      el.innerHTML = ICO.svg(ico, 17) + `<span>${msg}</span>`;
      host.appendChild(el);
      setTimeout(() => {
        el.style.transition = 'opacity .3s, transform .3s';
        el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
        setTimeout(() => el.remove(), 320);
      }, ms || 2600);
    },
    closeOverlays() {
      U.$$('.drawer.open, .modal.open').forEach(n => n.classList.remove('open'));
      const sc = U.$('#scrim'); if (sc) sc.classList.remove('open');
    },
    openDrawer(id) {
      const d = U.$('#' + id); if (!d) return;
      d.classList.add('open'); const sc = U.$('#scrim'); if (sc) sc.classList.add('open');
      document.body.style.overflow = 'hidden';
    },
    closeDrawer(id) {
      const d = U.$('#' + id); if (d) d.classList.remove('open');
      const sc = U.$('#scrim'); if (sc) sc.classList.remove('open');
      document.body.style.overflow = '';
    },
    openModal(id) { UI.openDrawer(id); },
    closeModal(id) { UI.closeDrawer(id); },
    /* 星级 */
    stars(n, max) {
      let h = '';
      for (let i = 1; i <= (max || 5); i++) {
        h += `<span style="color:${i <= n ? 'var(--accent-deep)' : 'var(--line-mid)'}">${ICO.solid('star', 13)}</span>`;
      }
      return `<span class="row" style="gap:1px">${h}</span>`;
    },
    /* 空态 */
    empty(title, desc, actionHTML) {
      return `<div class="empty">
        ${ICO.svg('box', 46)}
        <div class="empty-title">${U.esc(title)}</div>
        <div style="font-size:.85rem;max-width:44ch;margin:0 auto 16px">${desc || ''}</div>
        ${actionHTML || ''}
      </div>`;
    },
    /* 模块视觉（分类线稿） */
    modVisual(m) {
      const cat = D.CATEGORIES.find(c => c.id === m.cat);
      return `<div class="mod-visual">${ICO.svg(cat ? cat.icon : 'cube', 62)}</div>`;
    },
    /* 模块卡 */
    modCard(m, opts) {
      const o = opts || {};
      const qty = o.qty || 0;
      const stock = Store.stockOf(m.id);
      const stockCls = stock === 0 ? 'out' : (stock < 30 ? 'low' : '');
      const stockTxt = stock === 0 ? '缺货' : `库存 ${U.int(stock)}`;
      return `<article class="mod-card${qty ? ' selected' : ''}" data-module="${m.id}">
        ${UI.modVisual(m)}
        <div class="mod-body">
          <div>
            <div class="mod-brand">${U.esc(m.brand)}</div>
            <h3 class="mod-name"><a href="module.html?id=${m.id}">${U.esc(m.name)}</a></h3>
          </div>
          <div class="mod-chips">${m.tags.slice(0, 3).map(t => `<span class="tag">${U.esc(t)}</span>`).join('')}</div>
          <p class="mod-blurb">${U.esc(m.blurb)}</p>
          <div class="mod-foot">
            <div>
              <div class="price"><span class="cur">${D.SITE.currency}</span>${m.price.toFixed(2)}</div>
              <div class="stock ${stockCls}">${stockTxt}</div>
            </div>
            <div class="row" style="gap:6px">
              ${qty ? `<span class="tag tag-accent">已选 ×${qty}</span>` : ''}
              <button class="btn btn-ghost btn-sm js-add" data-id="${m.id}" ${stock === 0 ? 'disabled' : ''}>
                ${qty ? ICO.svg('plus', 14) : ICO.svg('plus', 14)} ${qty ? '加一' : '加入'}
              </button>
            </div>
          </div>
        </div>
      </article>`;
    },
    /* 详情/汇总里的明细行 */
    lineRow(l, opts) {
      const o = opts || {};
      return `<div class="spread" style="padding:9px 0;border-bottom:1px solid var(--line)">
        <div style="min-width:0">
          <div style="font-size:.87rem;font-weight:500">${U.esc(l.name)}</div>
          <div class="mono" style="font-size:.7rem;color:var(--faint)">${U.esc(l.brand)} · ${U.money(l.price)} × ${l.qty}</div>
        </div>
        <div class="row" style="gap:10px">
          <span class="mono" style="font-weight:600">${U.money(l.sum)}</span>
          ${o.removable ? `<button class="icon-btn js-remove" data-id="${l.id}" aria-label="移除" style="width:26px;height:26px">${ICO.svg('close', 14)}</button>` : ''}
        </div>
      </div>`;
    },
    /* 状态徽标 */
    stateTag(state) {
      const s = D.STATE_MAP[state] || { name: state, tone: 'line' };
      return `<span class="tag tag-${s.tone}"><span class="dot"></span>${s.name}</span>`;
    },
    /* 渲染所有 [data-ico] 占位 */
    hydrateIcons(root) {
      U.$$('[data-ico]', root).forEach(n => {
        const name = n.getAttribute('data-ico');
        const size = Number(n.getAttribute('data-size') || 20);
        n.innerHTML = ICO.svg(name, size);
        n.removeAttribute('data-ico');
      });
    },
  };

  /* ============ 全局暴露 ============ */
  global.Mosaic = { U, ICO, Store, Compat, Heat, Pay, UI, D };
})(window);
