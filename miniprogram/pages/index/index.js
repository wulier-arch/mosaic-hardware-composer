const D = require('../../data/modules.js');
const Store = require('../../utils/store.js');
const Heat = require('../../utils/heat.js');

const app = getApp();

Page({
  data: {
    stats: [],
    categories: [],
    heatRange: '7d',
    heatCat: 'all',
    heatList: [],
    heatCats: [],
    heatCatName: '全部分类',
    heatUpdated: '',
    catOptions: [],
    flow: [],
    personas: [],
    schemeCount: 0,
    schemeTotal: '¥0.00',
  },

  onLoad() {
    const totalStock = D.MODULES.reduce((a, m) => a + m.stock, 0);
    this.setData({
      stats: [
        { k: '在售模块', v: String(D.MODULES.length) },
        { k: '硬件分类', v: String(D.CATEGORIES.length) },
        { k: '校验规则', v: '9' },
        { k: '现货库存', v: totalStock.toLocaleString('zh-CN') },
      ],
      categories: D.CATEGORIES.map(c => {
        const items = D.MODULES.filter(m => m.cat === c.id);
        return {
          id: c.id, name: c.name, en: c.en, desc: c.desc,
          count: items.length,
          minPrice: '¥' + Math.min.apply(null, items.map(m => m.price)).toFixed(2),
        };
      }),
      catOptions: [{ id: 'all', name: '全部分类' }].concat(
        D.CATEGORIES.map(c => ({ id: c.id, name: c.name }))),
      flow: D.FLOW,
      personas: D.PERSONAS,
    });
    this.refreshHeat();
  },

  onShow() {
    this.refreshScheme();
  },

  refreshScheme() {
    const s = Store.scheme();
    const Compat = require('../../utils/compat.js');
    const cost = Compat.cost(s);
    this.setData({ schemeCount: cost.itemCount, schemeTotal: '¥' + cost.total.toFixed(2) });
  },

  refreshHeat() {
    const list = Heat.ranking({ range: this.data.heatRange, cat: this.data.heatCat, limit: 8 });
    const ev = Store.heat();
    const localCount = Object.keys(ev.items || {}).length;
    const catName = this.data.heatCat === 'all' ? '全部分类'
      : (D.CATEGORIES.find(c => c.id === this.data.heatCat) || {}).name;
    this.setData({
      heatList: list,
      heatCats: Heat.categoryHeat(this.data.heatRange),
      heatCatName: catName,
      heatUpdated: localCount
        ? '已融合本机 ' + localCount + ' 个模块的选型行为'
        : '纯基线数据（尚无本机行为）',
    });
  },

  onRange(e) {
    this.setData({ heatRange: e.currentTarget.dataset.r }, () => this.refreshHeat());
  },

  onHeatCat(e) {
    this.setData({ heatCat: e.detail.value === 0 ? 'all' : this.data.catOptions[e.detail.value].id },
      () => this.refreshHeat());
  },

  onCatTap(e) {
    wx.switchTab({ url: '/pages/catalog/catalog' });
  },

  onHeatTap(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  onHeatCatTap(e) {
    this.setData({ heatCat: e.currentTarget.dataset.id }, () => this.refreshHeat());
  },

  clearHeat() {
    wx.showModal({
      title: '清空本机行为数据',
      content: '将清除本机的浏览、加购与下单埋点，热度会回退为纯基线数据。',
      success: res => {
        if (res.confirm) {
          Store.clearHeat();
          this.refreshHeat();
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      },
    });
  },

  goBuilder() { wx.switchTab({ url: '/pages/builder/builder' }); },
  goCatalog() { wx.switchTab({ url: '/pages/catalog/catalog' }); },
});
