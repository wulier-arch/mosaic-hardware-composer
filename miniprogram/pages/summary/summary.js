const D = require('../../data/modules.js');
const Store = require('../../utils/store.js');
const Compat = require('../../utils/compat.js');

Page({
  data: {
    schemeName: '',
    lines: [],
    resRows: [],
    pwrRows: [],
    issues: [],
    cost: {},
    summary: {},
    bomText: '',
  },

  onShow() { this.render(); },

  render() {
    const scheme = Store.scheme();
    const rep = Compat.evaluate(scheme);
    const order = { err: 0, warn: 1, ok: 2 };

    this.setData({
      schemeName: scheme.name,
      lines: rep.cost.lines.map(l => {
        const cat = D.CATEGORIES.find(c => c.id === l.cat);
        return {
          id: l.id, name: l.name, brand: l.brand, qty: l.qty,
          catName: cat ? cat.name : '',
          priceText: '¥' + l.price.toFixed(2),
          sumText: '¥' + l.sum.toFixed(2),
        };
      }),
      resRows: Compat.resourceTable(rep),
      pwrRows: Compat.powerTable(rep),
      issues: rep.issues.slice().sort((a, b) => order[a.level] - order[b.level]).map(i => ({
        level: i.level, rule: i.rule, title: i.title, body: i.body,
        ico: i.level === 'err' ? '✕' : (i.level === 'warn' ? '!' : '✓'),
      })),
      cost: {
        subtotalText: '¥' + rep.cost.subtotal.toFixed(2),
        assemblyText: '¥' + rep.cost.assembly.toFixed(2),
        rushText: '¥' + rep.cost.rush.toFixed(2),
        shippingText: rep.cost.shipping ? '¥' + rep.cost.shipping.toFixed(2) : '免运费',
        totalText: '¥' + rep.cost.total.toFixed(2),
        hasAssembly: rep.cost.assembly > 0,
        hasRush: rep.cost.rush > 0,
      },
      summary: {
        kinds: rep.cost.kinds, items: rep.cost.itemCount,
        difficulty: rep.difficulty, hours: rep.hours,
        errors: rep.errors, warnings: rep.warnings,
        verdictText: rep.verdict === 'ok' ? '校验全部通过'
          : (rep.verdict === 'warn' ? '通过（' + rep.warnings + ' 项提醒）' : rep.errors + ' 项冲突'),
        canCheckout: rep.items.length > 0 && rep.errors === 0,
      },
    });
  },

  /* 复制方案清单（用于粘贴到聊天/文档） */
  copyBom() {
    const scheme = Store.scheme();
    const rep = Compat.evaluate(scheme);
    const lines = ['【MOSAIC 拼造】方案清单', '方案名：' + scheme.name, ''];
    rep.items.forEach(({ m, qty }, i) => {
      lines.push((i + 1) + '. ' + m.name + ' × ' + qty + '  ¥' + (m.price * qty).toFixed(2));
    });
    lines.push('');
    lines.push('模块小计：¥' + rep.cost.subtotal.toFixed(2));
    if (rep.cost.assembly) lines.push('代装配服务：¥' + rep.cost.assembly.toFixed(2));
    if (rep.cost.rush) lines.push('加急处理：¥' + rep.cost.rush.toFixed(2));
    lines.push('运费：' + (rep.cost.shipping ? '¥' + rep.cost.shipping.toFixed(2) : '免运费'));
    lines.push('应付合计：¥' + rep.cost.total.toFixed(2));
    lines.push('');
    lines.push('校验结论：' + (rep.verdict === 'ok' ? '全部通过' : rep.verdict === 'warn' ? '通过（' + rep.warnings + ' 项提醒）' : rep.errors + ' 项冲突'));
    lines.push('难度：' + rep.difficulty + '/5 · 预计装配 ' + rep.hours + ' 小时');
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '清单已复制', icon: 'success' }),
    });
  },

  goCheckout() {
    if (!this.data.summary.canCheckout) {
      wx.showToast({ title: this.data.summary.errors ? '请先解决冲突' : '方案为空', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/checkout/checkout' });
  },
  goBuilder() { wx.switchTab({ url: '/pages/builder/builder' }); },
});
