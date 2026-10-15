/**
 * 订单存储适配层
 * ---------------------------------------------------------------
 * 演示实现：进程内存 Map（Serverless 冷启动后数据会丢失）。
 *
 * 生产环境请替换为任意持久化存储，只需保持下面 4 个方法的签名不变：
 *   · Vercel + Postgres/Neon/KV
 *   · Cloudflare Workers + D1 / KV
 *   · Supabase / Firebase / 自建数据库
 *
 * 注意：订单创建与库存扣减必须放在同一事务中，避免超卖。
 */

/** @type {Map<string, object>} */
const MEM = globalThis.__MOSAIC_ORDERS__ || (globalThis.__MOSAIC_ORDERS__ = new Map());

/** @type {Map<string, object>} */
const HEAT = globalThis.__MOSAIC_HEAT__ || (globalThis.__MOSAIC_HEAT__ = new Map());

function orderNo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    'MS' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
    p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) +
    Math.floor(Math.random() * 900 + 100)
  );
}

const Store = {
  createOrder(payload) {
    const id = 'OD' + Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).slice(2, 7).toUpperCase();
    const order = Object.assign(
      {
        id,
        no: orderNo(),
        state: 'pending',
        createdAt: Date.now(),
        timeline: [{ state: 'pending', at: Date.now(), note: '订单已创建' }],
        payChannel: null,
        payNo: null,
        paidAt: null,
        tracking: null,
        carrier: null,
        refund: null,
      },
      payload
    );
    MEM.set(order.id, order);
    MEM.set(order.no, order); // 支持按订单号查询
    return order;
  },

  getOrder(idOrNo) {
    return MEM.get(idOrNo) || null;
  },

  /** 状态流转；extra 用于写入支付/物流等附加字段 */
  setState(idOrNo, state, note, extra) {
    const o = Store.getOrder(idOrNo);
    if (!o) return null;
    o.state = state;
    o.timeline = o.timeline || [];
    o.timeline.push({ state, at: Date.now(), note: note || state });
    Object.assign(o, extra || {});
    MEM.set(o.id, o);
    MEM.set(o.no, o);
    return o;
  },

  listOrders() {
    const seen = new Set();
    const out = [];
    MEM.forEach((o) => {
      if (seen.has(o.id)) return;
      seen.add(o.id);
      out.push(o);
    });
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },

  /** 热度埋点：type = view | add | order */
  recordHeat(type, moduleId) {
    const key = moduleId;
    const rec = HEAT.get(key) || { view: 0, add: 0, order: 0 };
    rec[type] = (rec[type] || 0) + 1;
    HEAT.set(key, rec);
    return rec;
  },

  heatRanking() {
    const rows = [];
    HEAT.forEach((rec, moduleId) => {
      rows.push({
        moduleId,
        raw: rec.view * 1 + rec.add * 5 + rec.order * 20,
        detail: rec,
      });
    });
    const max = Math.max(1, ...rows.map((r) => r.raw));
    return rows
      .map((r) => Object.assign(r, { localScore: Math.round((r.raw / max) * 1000) / 10 }))
      .sort((a, b) => b.raw - a.raw);
  },
};

module.exports = { Store };
