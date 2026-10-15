const D = require('../../data/modules.js');
const Store = require('../../utils/store.js');
const Compat = require('../../utils/compat.js');

const ZONE_ORDER = ['board', 'sensor', 'actuator', 'comm', 'display', 'power', 'expand', 'mech'];
const ZONE_HINT = {
  board: '方案的大脑，先定主控再选外设',
  sensor: '感知层：温湿度、姿态、距离、气体、光学',
  actuator: '执行层：舵机、步进、无刷、推杆、继电器',
  comm: '联网层：LoRa、4G、NB-IoT、以太网、RS485',
  display: '交互层：OLED、TFT、墨水屏、编码器、摇杆',
  power: '能量层：电池组、充电管理、DC-DC、适配器',
  expand: '扩展层：IO 扩展、ADC、电机驱动、电平转换',
  mech: '结构与耗材：线材、底板、型材、外壳、PCB',
};

Page({
  data: {
    schemeName: '',
    zones: [],
    verdict: {},
    issues: [],
    resRows: [],
    pwrRows: [],
    rails: [],
    cost: {},
    summary: {},

    /* 添加模块抽屉 */
    showPicker: false,
    pickQ: '',
    pickCat: 'board',
    pickChips: [],
    pickList: [],
    pickCount: 0,
  },

  onLoad() {
    this.setData({
      pickChips: [{ id: 'all', name: '全部' }].concat(D.CATEGORIES.map(c => ({ id: c.id, name: c.name }))),
    });
    this.render();
  },
  onShow() { this.render(); },

  /* ---------------- 渲染 ---------------- */
  render() {
    const scheme = Store.scheme();
    const rep = Compat.evaluate(scheme);

    /* 分区 */
    const byCat = {};
    rep.items.forEach(({ m, qty }) => {
      (byCat[m.cat] = byCat[m.cat] || []).push({ m: m, qty: qty });
    });
    const zones = ZONE_ORDER.map(catId => {
      const cat = D.CATEGORIES.find(c => c.id === catId);
      const arr = (byCat[catId] || []).map(({ m, qty }) => ({
        id: m.id, name: m.name, brand: m.brand, qty: qty,
        priceText: '¥' + m.price.toFixed(2),
        sumText: '¥' + (m.price * qty).toFixed(2),
        driver: !!m.req.driver,
        outOfStock: Store.stockOf(m.id) === 0,
      }));
      return {
        id: catId, name: cat.name, hint: ZONE_HINT[catId],
        items: arr,
        count: arr.reduce((a, x) => a + x.qty, 0),
      };
    });

    /* 结论 */
    const V = {
      empty: { cls: 'empty', ico: '○', title: '方案还是空的', body: '点下方「添加模块」开始。建议先确定主控开发板，它是全部兼容性判断的基准。' },
      block: { cls: 'block', ico: '✕', title: '存在阻断性问题', body: '有 ' + rep.errors + ' 项冲突必须先解决，否则这套方案无法正常工作。' },
      warn: { cls: 'warn', ico: '!', title: '可以使用，但有提醒', body: '通过基本校验，有 ' + rep.warnings + ' 项提醒建议处理。' },
      ok: { cls: 'ok', ico: '✓', title: '校验全部通过', body: '总线、引脚、电平、地址、功耗与算力均无冲突，可以下单。' },
    }[rep.verdict];

    /* 问题清单（把 ok 级也显示出来，但排在后面） */
    const order = { err: 0, warn: 1, ok: 2 };
    const issues = rep.issues.slice().sort((a, b) => order[a.level] - order[b.level]).map(i => ({
      level: i.level, rule: i.rule, title: i.title, body: i.body,
      ico: i.level === 'err' ? '✕' : (i.level === 'warn' ? '!' : '✓'),
    }));

    this.setData({
      schemeName: scheme.name,
      zones: zones,
      verdict: V,
      issues: issues,
      resRows: Compat.resourceTable(rep),
      pwrRows: Compat.powerTable(rep),
      rails: rep.rails.map(r => ({ text: r.rail + 'V 轨 ' + r.amp.toFixed(2) + ' A' })),
      cost: {
        lines: rep.cost.lines.map(l => ({
          id: l.id, name: l.name, qty: l.qty,
          priceText: '¥' + l.price.toFixed(2),
          sumText: '¥' + l.sum.toFixed(2),
        })),
        subtotalText: '¥' + rep.cost.subtotal.toFixed(2),
        assemblyText: '¥' + rep.cost.assembly.toFixed(2),
        rushText: '¥' + rep.cost.rush.toFixed(2),
        shippingText: rep.cost.shipping ? '¥' + rep.cost.shipping.toFixed(2) : '免运费',
        totalText: '¥' + rep.cost.total.toFixed(2),
      },
      summary: {
        kinds: rep.cost.kinds, items: rep.cost.itemCount,
        difficulty: rep.difficulty, hours: rep.hours,
        errors: rep.errors, warnings: rep.warnings,
        canCheckout: rep.items.length > 0 && rep.errors === 0,
        btnText: !rep.items.length ? '先生成方案'
          : (rep.errors > 0 ? '有 ' + rep.errors + ' 项冲突待解决' : '生成方案并去结算'),
      },
      service: scheme.service || {},
      schemeCount: Store.count(),
    });
  },

  /* ---------------- 添加模块抽屉 ---------------- */
  openPicker() {
    this.setData({ showPicker: true }, () => this.renderPickList());
  },
  closePicker() { this.setData({ showPicker: false }); },
  noop() {},
  onPickQ(e) { this.setData({ pickQ: e.detail.value }, () => this.renderPickList()); },
  pickCatTap(e) { this.setData({ pickCat: e.currentTarget.dataset.id }, () => this.renderPickList()); },

  renderPickList() {
    const s = this.data;
    let list = D.MODULES.slice();
    if (s.pickCat !== 'all') list = list.filter(m => m.cat === s.pickCat);
    if (s.pickQ.trim()) {
      const q = s.pickQ.trim().toLowerCase();
      list = list.filter(m => (m.name + m.brand + m.tags.join('')).toLowerCase().indexOf(q) >= 0);
    }
    const scheme = Store.scheme();
    const picked = {};
    scheme.items.forEach(i => { picked[i.id] = i.qty; });
    /* 已选置后，其余按热度 */
    list.sort((a, b) => {
      const aa = picked[a.id] ? 1 : 0, bb = picked[b.id] ? 1 : 0;
      if (aa !== bb) return aa - bb;
      return b.heat.d7 - a.heat.d7;
    });
    this.setData({
      pickList: list.map(m => {
        const cat = D.CATEGORIES.find(c => c.id === m.cat);
        const stock = Store.stockOf(m.id);
        return {
          id: m.id, name: m.name, catName: cat ? cat.name : '', brand: m.brand,
          priceText: '¥' + m.price.toFixed(2),
          stockText: stock === 0 ? '缺货' : '库存 ' + stock,
          qty: picked[m.id] || 0,
          bus: m.req.bus && m.req.bus !== 'none' ? m.req.bus.toUpperCase() : '',
        };
      }),
      pickCount: list.length,
    });
  },

  pickAdd(e) {
    const id = e.currentTarget.dataset.id;
    const m = D.MODULE_MAP[id];
    const s = Store.scheme();
    const hadBoard = s.items.some(i => { const mm = D.MODULE_MAP[i.id]; return mm && mm.cat === 'board'; });
    Store.addItem(id, 1);
    Store.recordHeat('add', id);
    if (m.cat === 'board' && hadBoard) {
      wx.showToast({ title: '已替换主控', icon: 'none' });
    }
    this.renderPickList();
    this.render();
  },

  /* ---------------- 方案操作 ---------------- */
  inc(e) {
    const id = e.currentTarget.dataset.id;
    Store.setQty(id, Store.qtyOf(Store.scheme(), id) + 1);
    this.render();
  },
  dec(e) {
    const id = e.currentTarget.dataset.id;
    Store.setQty(id, Store.qtyOf(Store.scheme(), id) - 1);
    this.render();
  },
  remove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '移除模块',
      content: '确定从方案中移除「' + D.MODULE_MAP[id].name + '」？',
      success: r => {
        if (r.confirm) { Store.removeItem(id); this.render(); }
      },
    });
  },
  clearAll() {
    wx.showModal({
      title: '清空方案',
      content: '将移除方案中的全部模块，此操作不可撤销。',
      success: r => {
        if (r.confirm) { Store.resetScheme(); this.render(); }
      },
    });
  },
  rename() {
    const self = this;
    wx.showModal({
      title: '重命名方案',
      editable: true,
      placeholderText: '输入方案名称',
      content: this.data.schemeName,
      success(r) {
        if (r.confirm && r.content) {
          const s = Store.scheme();
          s.name = r.content.trim() || '未命名方案';
          Store.saveScheme(s);
          self.render();
        }
      },
    });
  },
  toggleService(e) {
    const k = e.currentTarget.dataset.k;
    const s = Store.scheme();
    s.service = s.service || {};
    s.service[k] = !s.service[k];
    Store.saveScheme(s);
    this.render();
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goCheckout() {
    if (!this.data.summary.canCheckout) {
      wx.showToast({ title: this.data.summary.btnText, icon: 'none' });
      return;
    }
    const s = Store.scheme();
    const board = Compat.items(s).find(x => x.m.cat === 'board');
    if (board) Store.recordHeat('order', board.m.id);
    wx.navigateTo({ url: '/pages/summary/summary' });
  },
});
