const D = require('../../data/modules.js');
const Store = require('../../utils/store.js');
const Compat = require('../../utils/compat.js');

const PROVINCES = ['北京市', '上海市', '天津市', '重庆市', '广东省', '江苏省', '浙江省', '山东省',
  '河南省', '四川省', '湖北省', '湖南省', '河北省', '福建省', '安徽省', '陕西省', '辽宁省',
  '江西省', '广西壮族自治区', '山西省', '云南省', '贵州省', '吉林省', '黑龙江省',
  '内蒙古自治区', '新疆维吾尔自治区', '西藏自治区', '青海省', '宁夏回族自治区', '甘肃省',
  '海南省', '中国香港', '中国澳门', '中国台湾'];

Page({
  data: {
    step: 1,               /* 1 填单  2 支付  3 成功 */
    provinces: PROVINCES,
    f: {
      name: '', phone: '', province: '', city: '', addr: '',
      email: '', note: '', needInvoice: false, invTitle: '', invTax: '',
    },
    errs: {},
    agree: false,
    lines: [],
    cost: {},
    shipText: '免运费',
    totalText: '¥0.00',
    channel: 'wechat',
    channels: [
      { id: 'wechat', name: '微信支付', desc: '小程序内直接拉起微信支付，无需跳转', tag: '推荐' },
      { id: 'mock', name: '演示模式', desc: '不产生真实资金往来，用于验证下单与履约链路', tag: '演示' },
    ],
    order: null,
    countdown: '30:00',
  },

  onLoad() {
    const draft = Store.form();
    if (draft && draft.name) this.setData({ f: Object.assign({}, this.data.f, draft) });
    this.renderCost();
  },
  onUnload() { if (this.timer) clearInterval(this.timer); },

  renderCost() {
    const scheme = Store.scheme();
    const rep = Compat.evaluate(scheme);
    const goods = rep.cost.subtotal + rep.cost.assembly + rep.cost.rush;
    const remote = D.SHIPPING.remoteProvinces.indexOf(this.data.f.province) >= 0;
    let ship = 0;
    if (goods > 0 && goods < D.SHIPPING.freeThreshold) {
      ship = remote ? D.SHIPPING.remoteFee : D.SHIPPING.fee;
    }
    const total = goods + ship;
    this.setData({
      lines: rep.cost.lines.map(l => ({
        id: l.id, name: l.name, qty: l.qty, sumText: '¥' + l.sum.toFixed(2),
      })),
      cost: {
        subtotalText: '¥' + rep.cost.subtotal.toFixed(2),
        assemblyText: '¥' + rep.cost.assembly.toFixed(2),
        rushText: '¥' + rep.cost.rush.toFixed(2),
        hasAssembly: rep.cost.assembly > 0,
        hasRush: rep.cost.rush > 0,
        freeGap: goods < D.SHIPPING.freeThreshold
          ? '再购 ¥' + (D.SHIPPING.freeThreshold - goods).toFixed(2) + ' 可免运费' : '',
      },
      shipText: ship ? '¥' + ship.toFixed(2) : '免运费',
      totalText: '¥' + total.toFixed(2),
      shipFee: ship,
    });
  },

  onInput(e) {
    const k = e.currentTarget.dataset.k;
    const f = this.data.f;
    f[k] = e.detail.value;
    const errs = this.data.errs;
    delete errs[k];
    this.setData({ f: f, errs: errs });
    Store.saveForm(f);
  },
  onProvince(e) {
    const f = this.data.f;
    f.province = PROVINCES[e.detail.value];
    const errs = this.data.errs; delete errs.province;
    this.setData({ f: f, errs: errs }, () => this.renderCost());
    Store.saveForm(f);
  },
  toggleInvoice() {
    const f = this.data.f;
    f.needInvoice = !f.needInvoice;
    this.setData({ f: f });
    Store.saveForm(f);
  },
  toggleAgree() { this.setData({ agree: !this.data.agree }); },
  pickChannel(e) { this.setData({ channel: e.currentTarget.dataset.id }); },

  validate() {
    const f = this.data.f;
    const errs = {};
    if (!f.name.trim()) errs.name = '请填写收货人姓名';
    if (!/^1[3-9]\d{9}$/.test(f.phone)) errs.phone = '请填写有效的 11 位手机号';
    if (!f.province) errs.province = '请选择省份';
    if (!f.city.trim()) errs.city = '请填写城市 / 区县';
    if (f.addr.trim().length < 5) errs.addr = '请填写详细地址（不少于 5 个字符）';
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs.email = '邮箱格式不正确';
    if (f.needInvoice && !f.invTitle.trim()) errs.invTitle = '请填写发票抬头';
    if (!this.data.agree) errs.agree = '请先同意服务条款';
    this.setData({ errs: errs });
    return Object.keys(errs).length === 0;
  },

  submit() {
    if (!this.validate()) {
      wx.showToast({ title: '请检查标红的必填项', icon: 'none' });
      return;
    }
    const scheme = Store.scheme();
    const rep = Compat.evaluate(scheme);
    /* 库存检查 */
    const lack = rep.items.filter(({ m, qty }) => Store.stockOf(m.id) < qty);
    if (lack.length) {
      wx.showToast({ title: '库存不足：' + lack.map(x => x.m.name).join('、'), icon: 'none', duration: 2600 });
      return;
    }
    const f = this.data.f;
    const goods = rep.cost.subtotal + rep.cost.assembly + rep.cost.rush;
    const amount = goods + (this.data.shipFee || 0);

    const order = Store.createOrder({
      schemeName: scheme.name,
      lines: rep.cost.lines.map(l => ({
        id: l.id, name: l.name, cat: l.cat, brand: l.brand, price: l.price, qty: l.qty, sum: l.sum,
      })),
      cost: Object.assign({}, rep.cost, { shipping: this.data.shipFee || 0, total: amount }),
      amount: amount,
      service: scheme.service || {},
      contact: {
        name: f.name.trim(), phone: f.phone.trim(), province: f.province,
        city: f.city.trim(), addr: f.addr.trim(), email: f.email.trim(),
        full: f.province + ' ' + f.city.trim() + ' ' + f.addr.trim(),
      },
      invoice: f.needInvoice ? { title: f.invTitle.trim(), type: '电子普通发票', tax: f.invTax.trim() } : null,
      note: f.note.trim(),
      payChannel: this.data.channel,
      validation: { verdict: rep.verdict, errors: rep.errors, warnings: rep.warnings, difficulty: rep.difficulty, hours: rep.hours },
    });

    Store.recordHeat('order', (rep.board ? rep.board.id : ''));
    this.setData({ order: order, step: 2, amountText: '¥' + amount.toFixed(2) });
    this.startCountdown();
  },

  startCountdown() {
    let left = 30 * 60;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(this.timer);
        Store.setState(this.data.order.id, 'cancelled', '支付超时自动关闭');
        wx.showToast({ title: '支付超时，订单已关闭', icon: 'none' });
        setTimeout(() => wx.redirectTo({ url: '/pages/orders/orders' }), 1200);
        return;
      }
      const m = String(Math.floor(left / 60)).padStart(2, '0');
      const s = String(left % 60).padStart(2, '0');
      this.setData({ countdown: m + ':' + s });
    }, 1000);
  },

  /* 支付。
     真实接入点：这里应调用后端下单接口拿到 prepay_id，
     再用 wx.requestPayment 拉起微信支付，支付结果由后端接收微信异步通知后落库。
     当前为演示环境，直接本地置为已付款，用于验证「下单 → 付款 → 后台履约」链路。 */
  pay() {
    const o = this.data.order;
    if (!o) return;
    wx.showLoading({ title: '支付中', mask: true });
    setTimeout(() => {
      wx.hideLoading();
      const now = Date.now();
      /* 扣减库存 */
      (o.lines || []).forEach(l => Store.stockDelta(l.id, -l.qty));
      const ch = this.data.channels.find(c => c.id === this.data.channel);
      Store.setState(o.id, 'paid', '支付成功 · ' + ch.name, {
        payChannel: this.data.channel,
        payNo: 'PAY' + now.toString(36).toUpperCase(),
        paidAt: now,
        settleVia: this.data.channel === 'mock' ? 'demo-simulate' : 'wxpay-notify',
      });
      if (this.timer) clearInterval(this.timer);
      this.setData({ step: 3 });
      wx.showToast({ title: '支付成功', icon: 'success' });
    }, 1400);
  },

  cancelOrder() {
    wx.showModal({
      title: '取消订单',
      content: '取消后需要重新下单。确定继续？',
      success: r => {
        if (!r.confirm) return;
        Store.setState(this.data.order.id, 'cancelled', '用户主动取消');
        if (this.timer) clearInterval(this.timer);
        wx.redirectTo({ url: '/pages/orders/orders' });
      },
    });
  },

  goOrders() { wx.switchTab({ url: '/pages/orders/orders' }); },
  goIndex() { wx.switchTab({ url: '/pages/index/index' }); },
});
