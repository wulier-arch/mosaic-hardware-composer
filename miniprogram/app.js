const D = require('./data/modules.js');
const Store = require('./utils/store.js');

App({
  globalData: {
    D: D,
    Store: Store,
    /* 工作台在页面间传递的临时数据 */
    lastReport: null,
  },

  onLaunch() {
    /* 首次启动写入一份演示方案，让首页与工作台一打开就有内容可看 */
    const s = Store.scheme();
    if (!s.items.length) {
      const demo = ['esp32-s3-devkitc-1', 'sht31', 'sgp30', 'bh1750',
        'oled-096-i2c', 'lora-sx1278', 'psu-12v5a', 'lm2596-dcdc', 'case-3dprint'];
      demo.forEach(id => Store.addItem(id, 1));
      const cur = Store.scheme();
      cur.name = '智能环境监测节点';
      cur.service = { assembly: true, rush: false, invoice: false };
      Store.saveScheme(cur);
    }
  },

  /* 金额格式化：¥362.00 */
  money(n) {
    const v = Number(n || 0);
    return '¥' + v.toFixed(2);
  },
  /* 金额整数分拆：{cur:'¥', int:'362', dec:'.00'} */
  moneyParts(n) {
    const v = Number(n || 0).toFixed(2);
    const i = v.indexOf('.');
    return { cur: '¥', int: v.slice(0, i), dec: v.slice(i) };
  },
});
