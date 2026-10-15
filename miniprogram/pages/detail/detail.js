const D = require('../../data/modules.js');
const Store = require('../../utils/store.js');
const Compat = require('../../utils/compat.js');

const BUS_LABEL = {
  i2c: 'I2C', spi: 'SPI', uart: 'UART', gpio: 'GPIO', pwm: 'PWM',
  adc: 'ADC', i2s: 'I2S', csi: 'CSI', onewire: '单总线', none: '无需总线',
};

Page({
  data: {
    m: null,
    specRows: [],
    reqRows: [],
    compat: null,
    related: [],
    qty: 1,
    heatRank: 0,
    heatScore: 0,
    deltaText: '',
    deltaUp: false,
    deltaDown: false,
    stockText: '',
    stockCls: '',
  },

  onLoad(opt) {
    const m = D.MODULE_MAP[opt.id];
    if (!m) {
      wx.showToast({ title: '模块不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    Store.recordHeat('view', m.id);

    const cat = D.CATEGORIES.find(c => c.id === m.cat);
    const stock = Store.stockOf(m.id);
    const isBoard = m.cat === 'board';

    /* 规格表 */
    const specRows = m.specs.map(s => ({ k: s[0], v: s[1] }));

    /* 接口与供电表 */
    const reqRows = (isBoard ? [
      { k: '逻辑电平', v: m.caps.v + 'V' },
      { k: '算力档位', v: D.CLASS_LABEL[m.caps.cls] },
      { k: 'GPIO 可用', v: m.caps.gpio + ' 个' },
      { k: 'I2C / SPI / UART', v: m.caps.i2c + ' / ' + m.caps.spi + ' / ' + m.caps.uart },
      { k: 'PWM / ADC', v: m.caps.pwm + ' / ' + m.caps.adc },
      { k: '5V 供电能力', v: (m.caps.mA5 / 1000).toFixed(2) + ' A' },
      { k: '3.3V 供电能力', v: (m.caps.mA33 / 1000).toFixed(2) + ' A' },
      { k: '无线能力', v: [m.caps.wifi && 'WiFi', m.caps.ble && 'BLE', m.caps.can && 'CAN'].filter(Boolean).join(' / ') || '无' },
    ] : [
      { k: '总线接口', v: BUS_LABEL[m.req.bus] || '—' },
      { k: 'I2C 地址', v: m.req.addrHex || '—' },
      { k: '供电电压', v: m.req.v ? m.req.v + ' V' : '无需供电' },
      { k: '典型电流', v: m.req.mA ? m.req.mA + ' mA' : '—' },
      { k: '峰值电流', v: m.req.peak ? m.req.peak + ' mA' : '—' },
      { k: '占用 IO', v: m.req.pins + ' 个' },
      { k: '最低算力', v: D.CLASS_LABEL[m.req.cls] },
      { k: '需要驱动板', v: m.req.driver ? '是' : '否' },
      { k: '需要外接电源', v: m.req.ext ? '是' + (m.req.rail ? '（' + m.req.rail + 'V）' : '') : '否' },
      { k: '协议要求', v: m.req.proto ? (D.PROTO_META[m.req.proto] ? D.PROTO_META[m.req.proto].label : m.req.proto) : '—' },
    ]).filter(r => r.v !== '—' || r.k === 'I2C 地址');

    /* 兼容性 */
    const scheme = Store.scheme();
    const hasBoard = scheme.items.some(i => { const mm = D.MODULE_MAP[i.id]; return mm && mm.cat === 'board'; });
    let compat = null;
    if (!isBoard) {
      if (!hasBoard) {
        compat = { cls: 'info', title: '尚未确定主控', body: '先在方案中加入一块主控开发板，才能针对本模块给出总线、电平与功耗的兼容性结论。' };
      } else {
        const r = Compat.checkOne(m.id, scheme);
        const mine = r.report.issues.filter(x => (x.body || '').indexOf(m.name) >= 0 || (x.title || '').indexOf(m.name) >= 0);
        const errs = mine.filter(x => x.level === 'err');
        if (errs.length) {
          compat = { cls: 'err', title: '与当前方案存在冲突', body: '加入后会产生 ' + errs.length + ' 项冲突，需要先解决。', items: errs };
        } else if (mine.length) {
          compat = { cls: 'warn', title: '可以加入，但有 ' + mine.filter(x => x.level === 'warn').length + ' 项提醒', body: '功能上可用，建议按下面提示补齐配件。', items: mine };
        } else {
          compat = { cls: 'ok', title: '与当前方案兼容', body: '已通过总线数量、引脚占用、电平匹配、地址冲突、功耗预算与算力档位校验。' };
        }
        compat.boardName = r.report.board ? r.report.board.name : '';
        compat.totalText = '¥' + r.report.cost.total.toFixed(2);
        compat.kinds = r.report.cost.kinds;
        compat.items = compat.items || [];
      }
    } else {
      const curBoard = scheme.items.map(i => D.MODULE_MAP[i.id]).find(x => x && x.cat === 'board');
      compat = (curBoard && curBoard.id !== m.id)
        ? { cls: 'warn', title: '将替换当前主控', body: '方案中已有「' + curBoard.name + '」。主控同时只能有一个，加入本模块会自动移除原有主控。' }
        : { cls: 'ok', title: '这是方案的主控基准', body: '主控决定可用总线数量、逻辑电平、供电能力与算力档位，是全部外设兼容性判断的基准。' };
    }

    /* 热度排名 */
    const Heat = require('../../utils/heat.js');
    const list = Heat.ranking({ range: '7d' });
    const idx = list.findIndex(x => x.id === m.id);
    const hs = Heat.score(m, Store.localHeatScore(), '7d');

    /* 相关推荐 */
    const related = D.MODULES.filter(x => x.id !== m.id)
      .map(x => ({ x: x, d: (x.cat === m.cat ? 0 : 100) + Math.abs(x.price - m.price) }))
      .sort((a, b) => a.d - b.d).slice(0, 4)
      .map(o => ({
        id: o.x.id, name: o.x.name, brand: o.x.brand,
        priceText: '¥' + o.x.price.toFixed(2),
      }));

    this.setData({
      m: {
        id: m.id, name: m.name, en: m.en, brand: m.brand, blurb: m.blurb,
        catName: cat ? cat.name : '', tags: m.tags,
        priceText: '¥' + m.price.toFixed(2),
      },
      specRows: specRows,
      reqRows: reqRows,
      compat: compat,
      related: related,
      qty: Store.qtyOf(scheme, m.id) || 1,
      heatRank: idx >= 0 ? idx + 1 : 0,
      heatScore: hs.score,
      deltaText: (m.heat.delta >= 0 ? '+' : '') + m.heat.delta.toFixed(1) + '%',
      deltaUp: m.heat.delta > 0,
      deltaDown: m.heat.delta < 0,
      stockText: stock === 0 ? '缺货' : '现货 ' + stock + ' 件',
      stockCls: stock === 0 ? 'out' : (stock < 30 ? 'low' : ''),
      needShifter: m.req && m.req.v && /^5/.test(m.req.v),
    });
  },

  inc() { this.setData({ qty: Math.min(99, this.data.qty + 1) }); },
  dec() { this.setData({ qty: Math.max(1, this.data.qty - 1) }); },

  add() {
    Store.addItem(this.data.m.id, this.data.qty);
    Store.recordHeat('add', this.data.m.id);
    wx.showToast({ title: '已加入方案', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 700);
  },

  buyNow() {
    Store.addItem(this.data.m.id, this.data.qty);
    Store.recordHeat('add', this.data.m.id);
    const scheme = Store.scheme();
    const hasBoard = scheme.items.some(i => { const mm = D.MODULE_MAP[i.id]; return mm && mm.cat === 'board'; });
    if (!hasBoard) {
      wx.showToast({ title: '方案还没有主控，建议先选一块开发板', icon: 'none', duration: 2200 });
      return;
    }
    wx.navigateTo({ url: '/pages/summary/summary' });
  },

  goDetail(e) {
    wx.redirectTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },
  goBuilder() { wx.switchTab({ url: '/pages/builder/builder' }); },
});
