const D = require('../../data/modules.js');
const Store = require('../../utils/store.js');

const STATES = [
  { id: 'all', name: '全部' },
  { id: 'pending', name: '待付款' },
  { id: 'paid', name: '已付款' },
  { id: 'picking', name: '备货中' },
  { id: 'shipped', name: '已发货' },
  { id: 'done', name: '已完成' },
];

const STATE_META = {
  pending: { name: '待付款', tone: 'warn' },
  paid: { name: '已付款', tone: 'accent' },
  picking: { name: '备货中', tone: 'blue' },
  shipped: { name: '已发货', tone: 'ok' },
  done: { name: '已完成', tone: 'ok' },
  cancelled: { name: '已取消', tone: 'danger' },
  refunded: { name: '已退款', tone: 'danger' },
};

Page({
  data: {
    states: STATES,
    filter: 'all',
    list: [],
    stats: [],
    expanded: '',
  },

  onShow() { this.render(); },

  render() {
    const all = Store.orders();
    const acc = {};
    all.forEach(o => { acc[o.state] = (acc[o.state] || 0) + 1; });
    const paidAmt = all.filter(o => ['pending', 'cancelled'].indexOf(o.state) < 0)
      .reduce((a, o) => a + o.amount, 0);

    let list = all;
    if (this.data.filter === 'paid') list = all.filter(o => ['paid', 'picking'].indexOf(o.state) >= 0);
    else if (this.data.filter !== 'all') list = all.filter(o => o.state === this.data.filter);

    this.setData({
      stats: [
        { k: '订单总数', v: String(all.length) },
        { k: '待付款', v: String(acc.pending || 0) },
        { k: '处理中', v: String((acc.paid || 0) + (acc.picking || 0)) },
        { k: '累计支付', v: '¥' + paidAmt.toFixed(2) },
      ],
      list: list.map(o => {
        const meta = STATE_META[o.state] || { name: o.state, tone: 'line' };
        return {
          id: o.id, no: o.no, state: o.state,
          stateName: meta.name, tone: meta.tone,
          schemeName: o.schemeName || '硬件定制方案',
          dateText: this.fmt(o.createdAt),
          kinds: o.cost.kinds, items: o.cost.itemCount,
          amountText: '¥' + o.amount.toFixed(2),
          contactName: o.contact.name, province: o.contact.province,
          tracking: o.tracking || '', carrier: o.carrier || '',
          tags: o.lines.slice(0, 3).map(l => l.name),
          moreCount: Math.max(0, o.lines.length - 3),
          canPay: o.state === 'pending',
          canCancel: o.state === 'pending',
          canReceive: o.state === 'shipped',
          canRebuy: ['done', 'cancelled', 'refunded'].indexOf(o.state) >= 0,
          timeline: (o.timeline || []).map(t => {
            const sm = STATE_META[t.state] || { name: t.state };
            return { name: sm.name, at: this.fmt(t.at, true), note: t.note || '' };
          }).reverse(),
          invoiceText: o.invoice ? o.invoice.type + ' · ' + o.invoice.title : '',
          note: o.note || '',
        };
      }),
    });
  },

  fmt(ts, withTime) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    const base = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    return withTime ? base + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) : base;
  },

  pickFilter(e) { this.setData({ filter: e.currentTarget.dataset.id }, () => this.render()); },

  toggle(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expanded: this.data.expanded === id ? '' : id });
  },

  pay(e) {
    const id = e.currentTarget.dataset.id;
    const o = Store.order(id);
    wx.showModal({
      title: '继续支付',
      content: '订单 ' + o.no + '，应付 ¥' + o.amount.toFixed(2) + '。演示环境将直接把订单置为已付款。',
      confirmText: '模拟支付',
      success: r => {
        if (!r.confirm) return;
        (o.lines || []).forEach(l => Store.stockDelta(l.id, -l.qty));
        Store.setState(id, 'paid', '支付成功 · 演示模式', {
          payChannel: 'mock', payNo: 'PAY' + Date.now().toString(36).toUpperCase(),
          paidAt: Date.now(), settleVia: 'demo-simulate',
        });
        wx.showToast({ title: '支付成功', icon: 'success' });
        this.render();
      },
    });
  },

  cancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消订单',
      content: '取消后需要重新下单。',
      success: r => {
        if (r.confirm) { Store.setState(id, 'cancelled', '用户主动取消'); this.render(); }
      },
    });
  },

  receive(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认收货',
      content: '确认已收到货物？',
      success: r => {
        if (r.confirm) {
          Store.setState(id, 'done', '用户确认收货');
          wx.showToast({ title: '已确认收货', icon: 'success' });
          this.render();
        }
      },
    });
  },

  rebuy(e) {
    const id = e.currentTarget.dataset.id;
    const o = Store.order(id);
    Store.resetScheme(o.schemeName || '复购方案');
    o.lines.forEach(l => Store.addItem(l.id, l.qty));
    wx.showToast({ title: '已重新加入方案', icon: 'success' });
    setTimeout(() => wx.switchTab({ url: '/pages/builder/builder' }), 800);
  },

  copyTracking(e) {
    const t = e.currentTarget.dataset.t;
    wx.setClipboardData({ data: t, success: () => wx.showToast({ title: '单号已复制', icon: 'success' }) });
  },

  goCatalog() { wx.switchTab({ url: '/pages/catalog/catalog' }); },
});
