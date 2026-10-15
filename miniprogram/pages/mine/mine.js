const D = require('../../data/modules.js');
const Store = require('../../utils/store.js');
const Compat = require('../../utils/compat.js');

Page({
  data: {
    schemeName: '',
    schemeKinds: 0,
    schemeItems: 0,
    schemeTotal: '¥0.00',
    verdictText: '',
    verdictTone: 'ok',
    orders: 0,
    paidAmount: '¥0.00',
    heatEvents: 0,
    heatModules: 0,
    topHeat: [],
    features: [],
    tech: [],
  },

  onShow() { this.render(); },

  render() {
    const scheme = Store.scheme();
    const rep = Compat.evaluate(scheme);
    const orders = Store.orders();
    const ev = Store.heat();
    const evItems = ev.items || {};
    const evCount = (ev.log || []).length;

    /* 本机行为 Top */
    const local = Store.localHeatScore();
    const topHeat = Object.keys(evItems).map(id => {
      const m = D.MODULE_MAP[id];
      if (!m) return null;
      const e = evItems[id];
      return {
        id: id, name: m.name,
        view: e.view || 0, add: e.add || 0, order: e.order || 0,
        score: local ? Math.round(local[id]) : 0,
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 5);

    this.setData({
      schemeName: scheme.name,
      schemeKinds: rep.cost.kinds,
      schemeItems: rep.cost.itemCount,
      schemeTotal: '¥' + rep.cost.total.toFixed(2),
      verdictText: rep.verdict === 'ok' ? '校验全部通过'
        : (rep.verdict === 'warn' ? '通过（' + rep.warnings + ' 项提醒）'
          : (rep.items.length ? rep.errors + ' 项冲突' : '方案为空')),
      verdictTone: rep.verdict === 'ok' ? 'ok' : (rep.verdict === 'warn' ? 'warn' : (rep.items.length ? 'danger' : 'line')),
      orders: orders.length,
      paidAmount: '¥' + orders.filter(o => ['pending', 'cancelled'].indexOf(o.state) < 0)
        .reduce((a, o) => a + o.amount, 0).toFixed(2),
      heatEvents: evCount,
      heatModules: Object.keys(evItems).length,
      topHeat: topHeat,
      features: [
        { t: '硬件分类浏览', d: '8 大分类、86 个模块，支持接口 / 电压 / 价格 / 库存多维筛选' },
        { t: '模块参数详情', d: '完整规格表、接口与供电需求，并结合当前方案实时给出兼容性结论' },
        { t: '自定义选型与组合', d: '按 8 个功能分区装配，支持调数量、替换、存为模板' },
        { t: '兼容性校验引擎', d: '9 条规则：总线 / 引脚 / 电平 / 地址 / 功耗 / 算力 / 协议 / 驱动 / 电源' },
        { t: '方案预览与汇总', d: '资源占用表、功耗预算、成本明细、难度评分，可导出 BOM' },
        { t: '选型热度', d: '7 日 / 30 日双维度指数 + 环比涨跌 + 分类聚合 + 本机行为加权' },
        { t: '下单与付款', d: '收货信息校验、运费与加急计费、微信支付通道' },
        { t: '订单与履约', d: '状态时间线、确认收货、再次购买' },
      ],
      tech: [
        { k: '形态', v: '微信小程序' },
        { k: '模块数据', v: '86 个 / 8 类' },
        { k: '校验规则', v: '9 条' },
        { k: '数据存储', v: '本地 Storage' },
      ],
    });
  },

  goBuilder() { wx.switchTab({ url: '/pages/builder/builder' }); },
  goOrders() { wx.switchTab({ url: '/pages/orders/orders' }); },
  goCatalog() { wx.switchTab({ url: '/pages/catalog/catalog' }); },

  clearHeat() {
    wx.showModal({
      title: '清空行为数据',
      content: '将清除浏览、加购与下单埋点，选型热度会回退为纯基线数据。',
      success: r => {
        if (r.confirm) { Store.clearHeat(); this.render(); wx.showToast({ title: '已清空', icon: 'success' }); }
      },
    });
  },

  resetAll() {
    wx.showModal({
      title: '重置演示数据',
      content: '将清空本机的方案、订单、库存与埋点数据，恢复到初始状态。',
      confirmColor: '#b3261e',
      success: r => {
        if (r.confirm) {
          Store.resetDemo();
          const app = getApp();
          app.onLaunch();
          wx.showToast({ title: '已重置', icon: 'success' });
          this.render();
        }
      },
    });
  },

  copyLink() {
    wx.setClipboardData({
      data: 'MOSAIC 拼造 · 硬件定制平台',
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },
});
