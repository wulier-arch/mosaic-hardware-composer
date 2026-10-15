const D = require('../../data/modules.js');
const Store = require('../../utils/store.js');
const Heat = require('../../utils/heat.js');

const BUS_LABEL = {
  i2c: 'I2C', spi: 'SPI', uart: 'UART', gpio: 'GPIO', pwm: 'PWM',
  adc: 'ADC', i2s: 'I2S', csi: 'CSI', onewire: '单总线', none: '无总线',
};
const VOLT_LABEL = { '3.3': '3.3V', '5': '5V', '12': '12V', other: '其他 / 宽压' };
const SORTS = [
  { id: 'heat', name: '综合热度' },
  { id: 'price-asc', name: '价格从低到高' },
  { id: 'price-desc', name: '价格从高到低' },
  { id: 'stock', name: '库存从多到少' },
];

Page({
  data: {
    q: '',
    cat: 'all',
    bus: 'all',
    volt: 'all',
    price: 2200,
    sort: 'heat',
    stockOnly: false,
    showFilter: false,

    catChips: [],
    busChips: [],
    voltChips: [],
    sortOptions: SORTS,
    sortName: '综合热度',
    resultCount: 0,
    list: [],
    schemeCount: 0,
  },

  onLoad() {
    this.buildChips();
    this.render();
  },

  onShow() {
    this.setData({ schemeCount: Store.count() });
    this.render();
  },

  buildChips() {
    const catCount = {};
    const busCount = {};
    const voltCount = {};
    D.MODULES.forEach(m => {
      catCount[m.cat] = (catCount[m.cat] || 0) + 1;
      const b = m.req.bus || 'none';
      busCount[b] = (busCount[b] || 0) + 1;
      const v = m.req.v;
      let key = 'other';
      if (v === '3.3') key = '3.3';
      else if (v === '5') key = '5';
      else if (v === '12' || v === '11.1') key = '12';
      voltCount[key] = (voltCount[key] || 0) + 1;
    });
    this.setData({
      catChips: [{ id: 'all', name: '全部', cnt: D.MODULES.length }].concat(
        D.CATEGORIES.map(c => ({ id: c.id, name: c.name, cnt: catCount[c.id] || 0 }))),
      busChips: [{ id: 'all', name: '全部接口', cnt: D.MODULES.length }].concat(
        Object.keys(BUS_LABEL).filter(k => k !== 'none').map(k => ({ id: k, name: BUS_LABEL[k], cnt: busCount[k] || 0 }))),
      voltChips: [{ id: 'all', name: '全部电压', cnt: D.MODULES.length }].concat(
        Object.keys(VOLT_LABEL).map(k => ({ id: k, name: VOLT_LABEL[k], cnt: voltCount[k] || 0 }))),
    });
  },

  filtered() {
    const s = this.data;
    let list = D.MODULES.slice();
    if (s.cat !== 'all') list = list.filter(m => m.cat === s.cat);
    if (s.bus !== 'all') list = list.filter(m => (m.req.bus || 'none') === s.bus);
    if (s.volt !== 'all') {
      list = list.filter(m => {
        const v = m.req.v;
        if (s.volt === 'other') return !v || ['3.3', '5', '12', '11.1'].indexOf(v) < 0;
        if (s.volt === '12') return v === '12' || v === '11.1';
        return v === s.volt;
      });
    }
    list = list.filter(m => m.price <= s.price);
    if (s.stockOnly) list = list.filter(m => Store.stockOf(m.id) > 0);
    if (s.q.trim()) {
      const q = s.q.trim().toLowerCase();
      list = list.filter(m => (m.name + m.brand + m.blurb + m.tags.join('')).toLowerCase().indexOf(q) >= 0);
    }
    const local = Store.localHeatScore();
    const cmp = {
      heat: (a, b) => Heat.score(b, local, 'd7').score - Heat.score(a, local, 'd7').score,
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      stock: (a, b) => Store.stockOf(b.id) - Store.stockOf(a.id),
    }[s.sort];
    return list.sort(cmp);
  },

  render() {
    const list = this.filtered().map(m => {
      const cat = D.CATEGORIES.find(c => c.id === m.cat);
      const stock = Store.stockOf(m.id);
      const qty = Store.qtyOf(Store.scheme(), m.id);
      return {
        id: m.id, name: m.name, brand: m.brand, catName: cat ? cat.name : '',
        blurb: m.blurb, tags: m.tags.slice(0, 3),
        priceText: '¥' + m.price.toFixed(2),
        stock: stock,
        stockText: stock === 0 ? '缺货' : '库存 ' + stock,
        stockCls: stock === 0 ? 'out' : (stock < 30 ? 'low' : ''),
        qty: qty,
        bus: m.req.bus && m.req.bus !== 'none' ? BUS_LABEL[m.req.bus] : '—',
        volt: m.req.v ? m.req.v + 'V' : '—',
      };
    });
    this.setData({ list: list, resultCount: list.length, schemeCount: Store.count() });
  },

  onSearch(e) { this.setData({ q: e.detail.value }, () => this.render()); },
  toggleFilter() { this.setData({ showFilter: !this.data.showFilter }); },

  pick(e) {
    const k = e.currentTarget.dataset.k;
    const v = e.currentTarget.dataset.v;
    const patch = {}; patch[k] = v;
    this.setData(patch, () => this.render());
  },
  onPrice(e) { this.setData({ price: e.detail.value }, () => this.render()); },
  onSort(e) {
    const opt = SORTS[e.detail.value];
    this.setData({ sort: opt.id, sortName: opt.name }, () => this.render());
  },
  onStockOnly(e) {
    this.setData({ stockOnly: e.detail.value.length > 0 }, () => this.render());
  },
  resetAll() {
    this.setData({ q: '', cat: 'all', bus: 'all', volt: 'all', price: 2200, sort: 'heat', sortName: '综合热度', stockOnly: false },
      () => this.render());
  },

  add(e) {
    const id = e.currentTarget.dataset.id;
    const m = D.MODULE_MAP[id];
    const s = Store.scheme();
    const hadBoard = s.items.some(i => { const mm = D.MODULE_MAP[i.id]; return mm && mm.cat === 'board'; });
    if (m.cat === 'board' && hadBoard) {
      const oldBoard = s.items.map(i => D.MODULE_MAP[i.id]).find(x => x && x.cat === 'board');
      wx.showToast({ title: '已替换主控「' + (oldBoard ? oldBoard.name.slice(0, 8) : '') + '…」', icon: 'none', duration: 1800 });
    } else {
      wx.showToast({ title: '已加入方案', icon: 'success', duration: 900 });
    }
    Store.addItem(id, 1);
    Store.recordHeat('add', id);
    this.render();
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },
  goBuilder() { wx.switchTab({ url: '/pages/builder/builder' }); },
});
