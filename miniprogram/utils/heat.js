/* =============================================================
   选型热度引擎（小程序版）
   与网页版一致：热度 = 基线 × 0.7 + 本机选型行为加权 × 0.3
   ============================================================= */
const D = require('../data/modules.js');
const Store = require('./store.js');

const Heat = {
  /* 时间范围 id 与数据键互转 */
  keyOf(rangeOrKey) {
    if (rangeOrKey === 'd7' || rangeOrKey === 'd30') return rangeOrKey;
    return rangeOrKey === '30d' ? 'd30' : 'd7';
  },

  /* 综合热度 */
  score(module, local, range) {
    const base = module.heat[Heat.keyOf(range)] || 0;
    if (!local) return { score: base, weighted: false };
    const l = local[module.id] || 0;
    const s = Math.min(100, Math.max(0, base * 0.7 + l * 0.3));
    return { score: Math.round(s * 10) / 10, weighted: true };
  },

  /* 排行 */
  ranking(opt) {
    const o = Object.assign({ range: '7d', cat: 'all', limit: 0 }, opt || {});
    const rk = Heat.keyOf(o.range);
    const local = Store.localHeatScore();
    let list = D.MODULES.filter(m => o.cat === 'all' || m.cat === o.cat);
    list = list.map(m => {
      const s = Heat.score(m, local, rk);
      const delta = o.range === '7d'
        ? m.heat.delta
        : Math.round((m.heat.d7 - m.heat.d30) / m.heat.d30 * 1000) / 10;
      const cat = D.CATEGORIES.find(c => c.id === m.cat);
      return {
        id: m.id, name: m.name, brand: m.brand, catName: cat ? cat.name : '',
        score: s.score, weighted: s.weighted,
        delta: delta, deltaText: (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%',
        deltaUp: delta > 0, deltaDown: delta < 0,
        barWidth: Math.round(s.score),
        price: m.price, priceText: '¥' + m.price.toFixed(2),
      };
    }).sort((a, b) => b.score - a.score || b.delta - a.delta);
    if (o.limit) list = list.slice(0, o.limit);
    list.forEach((it, i) => { it.rank = i + 1; it.rankText = (i + 1 < 10 ? '0' : '') + (i + 1); });
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
    const rows = Object.keys(acc).map(k => {
      const a = acc[k];
      return { catId: a.cat.id, catName: a.cat.name, avg: Math.round(a.sum / a.n * 10) / 10, n: a.n, topName: a.top ? a.top.name : '' };
    });
    const max = Math.max.apply(null, rows.map(r => r.avg).concat([1]));
    return rows.map(r => Object.assign(r, { pct: Math.round(r.avg / max * 100) }))
      .sort((a, b) => b.avg - a.avg);
  },

  /* 迷你趋势线（14 点，种子可复现） */
  sparkline(module, range) {
    const seedStr = module.id + (range || '7d');
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    let s = (h >>> 0) || 1;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s = s >>> 0; return s / 4294967296; };
    const n = 14;
    const end = module.heat[Heat.keyOf(range)];
    const slope = (module.heat.delta || 0) / 100 / n * 2.2;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const target = end * (1 - slope * (1 - t));
      pts.push(Math.max(1, target + (rnd() - 0.5) * end * 0.055));
    }
    pts[n - 1] = end;
    /* 归一化成 0–100 的百分比，供 wxml 画柱状趋势 */
    const min = Math.min.apply(null, pts), max = Math.max.apply(null, pts), span = (max - min) || 1;
    return pts.map(v => Math.round((v - min) / span * 76) + 12);
  },
};

module.exports = Heat;
