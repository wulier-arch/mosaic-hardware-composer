/* =============================================================
   本地存储层（小程序版）
   方案草稿 / 订单 / 选型热度埋点 / 库存，全部落在 wx storage
   ============================================================= */
const D = require('../data/modules.js');

const KEY = {
  scheme: 'mosaic_scheme_v1',
  orders: 'mosaic_orders_v1',
  heat: 'mosaic_heat_v1',
  stock: 'mosaic_stock_v1',
  form: 'mosaic_form_v1',
};

function read(k, fallback) {
  try { const v = wx.getStorageSync(k); return (v === '' || v == null) ? fallback : v; }
  catch (e) { return fallback; }
}
function write(k, v) { try { wx.setStorageSync(k, v); return true; } catch (e) { return false; } }
function uid(prefix) {
  return (prefix || '') + Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 7).toUpperCase();
}
function orderNo() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return 'MS' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
    p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + Math.floor(Math.random() * 900 + 100);
}

const Store = {
  KEY,

  /* ---------------- 当前方案草稿 ---------------- */
  emptyScheme(name) {
    return {
      id: uid('SC'), name: name || '未命名方案', items: [], note: '',
      service: { assembly: false, rush: false, invoice: false },
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  },
  scheme() {
    let s = read(KEY.scheme, null);
    if (!s || !s.items) { s = Store.emptyScheme(); write(KEY.scheme, s); }
    return s;
  },
  saveScheme(s) { s.updatedAt = Date.now(); write(KEY.scheme, s); return s; },
  resetScheme(name) { const s = Store.emptyScheme(name); write(KEY.scheme, s); return s; },

  addItem(id, qty) {
    const s = Store.scheme();
    const m = D.MODULE_MAP[id];
    if (!m) return s;
    const ex = s.items.find(i => i.id === id);
    /* 主控互斥：同时只能有一个主控 */
    if (m.cat === 'board' && !ex) {
      s.items = s.items.filter(i => {
        const mm = D.MODULE_MAP[i.id];
        return !(mm && mm.cat === 'board');
      });
    }
    if (ex) ex.qty = Math.min(99, ex.qty + (qty || 1));
    else s.items.push({ id: id, qty: qty || 1 });
    return Store.saveScheme(s);
  },
  setQty(id, qty) {
    const s = Store.scheme();
    const it = s.items.find(i => i.id === id);
    if (!it) return s;
    if (qty <= 0) s.items = s.items.filter(i => i.id !== id);
    else it.qty = Math.min(99, qty);
    return Store.saveScheme(s);
  },
  removeItem(id) {
    const s = Store.scheme();
    s.items = s.items.filter(i => i.id !== id);
    return Store.saveScheme(s);
  },
  clearItems() { const s = Store.scheme(); s.items = []; return Store.saveScheme(s); },
  qtyOf(scheme, id) {
    const it = (scheme.items || []).find(i => i.id === id);
    return it ? it.qty : 0;
  },
  count() { return Store.scheme().items.reduce((a, i) => a + i.qty, 0); },

  /* ---------------- 库存（本地模拟） ---------------- */
  stockOf(id) {
    const inv = read(KEY.stock, {});
    const m = D.MODULE_MAP[id];
    return inv[id] == null ? ((m && m.stock) || 0) : inv[id];
  },
  stockDelta(id, delta) {
    const inv = read(KEY.stock, {});
    const base = Store.stockOf(id);
    inv[id] = Math.max(0, base + delta);
    write(KEY.stock, inv);
    return inv[id];
  },

  /* ---------------- 订单 ---------------- */
  orders() { return read(KEY.orders, []); },
  order(id) { return Store.orders().find(o => o.id === id || o.no === id); },
  putOrder(o) {
    const list = Store.orders();
    const i = list.findIndex(x => x.id === o.id);
    if (i >= 0) list[i] = o; else list.unshift(o);
    write(KEY.orders, list);
    return o;
  },
  createOrder(payload) {
    const o = Object.assign({
      id: uid('OD'), no: orderNo(), state: 'pending', createdAt: Date.now(),
      timeline: [{ state: 'pending', at: Date.now(), note: '订单已创建' }],
      payChannel: null, payNo: null, paidAt: null,
      tracking: null, carrier: null, note: '',
    }, payload);
    return Store.putOrder(o);
  },
  setState(id, state, note, extra) {
    const o = Store.order(id);
    if (!o) return null;
    o.state = state;
    o.timeline = o.timeline || [];
    o.timeline.push({ state: state, at: Date.now(), note: note || (D.STATE_MAP && D.STATE_MAP[state] ? D.STATE_MAP[state].name : state) });
    Object.assign(o, extra || {});
    return Store.putOrder(o);
  },

  /* ---------------- 选型热度埋点 ---------------- */
  heat() { return read(KEY.heat, { items: {}, log: [] }); },
  recordHeat(type, id) {
    const ev = Store.heat();
    ev.items[id] = ev.items[id] || { view: 0, add: 0, order: 0 };
    ev.items[id][type] = (ev.items[id][type] || 0) + 1;
    ev.log.unshift({ type: type, id: id, at: Date.now() });
    ev.log = ev.log.slice(0, 300);
    write(KEY.heat, ev);
    return ev;
  },
  clearHeat() { write(KEY.heat, { items: {}, log: [] }); },

  /* 本机行为得分（0–100），无行为返回 null */
  localHeatScore() {
    const items = Store.heat().items || {};
    const ids = Object.keys(items);
    if (!ids.length) return null;
    const raw = {};
    let max = 0;
    ids.forEach(id => {
      const e = items[id];
      raw[id] = e.view * 1 + e.add * 5 + e.order * 20;
      if (raw[id] > max) max = raw[id];
    });
    if (!max) return null;
    const out = {};
    ids.forEach(id => { out[id] = raw[id] / max * 100; });
    return out;
  },

  /* ---------------- 结算表单草稿 ---------------- */
  form() { return read(KEY.form, {}); },
  saveForm(f) { write(KEY.form, f); },

  /* ---------------- 重置演示数据 ---------------- */
  resetDemo() {
    [KEY.scheme, KEY.orders, KEY.heat, KEY.stock, KEY.form].forEach(k => {
      try { wx.removeStorageSync(k); } catch (e) {}
    });
  },
};

module.exports = Store;
