/* =============================================================
   兼容性校验引擎（小程序版）
   与网页版 assets/js/core.js 的 Compat 保持同一套规则与判定结果
   ============================================================= */
const D = require('../data/modules.js');

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

const Compat = {
  /* 展开方案为明细列表 */
  items(scheme) {
    return (scheme.items || [])
      .map(i => { const m = D.MODULE_MAP[i.id]; return m ? { m, qty: i.qty } : null; })
      .filter(Boolean);
  },

  /* 成本汇总 */
  cost(scheme) {
    const items = Compat.items(scheme);
    const lines = items.map(({ m, qty }) => ({
      id: m.id, name: m.name, cat: m.cat, brand: m.brand,
      price: m.price, qty, sum: Math.round(m.price * qty * 100) / 100,
    }));
    const subtotal = lines.reduce((a, l) => a + l.sum, 0);
    const svc = scheme.service || {};
    const assembly = svc.assembly ? D.SHIPPING.assemblyFee : 0;
    const goods = subtotal + assembly;
    const shipping = goods > 0 ? (goods >= D.SHIPPING.freeThreshold ? 0 : D.SHIPPING.fee) : 0;
    const rush = svc.rush ? Math.round(goods * D.SHIPPING.rushFeeRate * 100) / 100 : 0;
    const total = goods + shipping + rush;
    return {
      lines, subtotal, assembly, shipping, rush, total,
      itemCount: items.reduce((a, x) => a + x.qty, 0),
      kinds: lines.length,
    };
  },

  /* 主校验入口 */
  evaluate(scheme) {
    const items = Compat.items(scheme);
    const issues = [];
    const boardEntry = items.find(x => x.m.cat === 'board');
    const board = boardEntry ? boardEntry.m : null;

    /* ---- 资源占用统计 ---- */
    const res = { i2c: 0, spi: 0, uart: 0, i2s: 0, csi: 0, pwm: 0, adc: 0, gpio: 0, onewire: 0, addr: {} };
    items.forEach(({ m, qty }) => {
      const r = m.req;
      if (m.cat === 'board' || m.cat === 'mech' || m.cat === 'power') return;
      for (let k = 0; k < qty; k++) {
        if (r.bus === 'i2c') {
          res.i2c++;
          if (r.addrHex) { (res.addr[r.addrHex] = res.addr[r.addrHex] || []).push(m.id); }
        }
        else if (r.bus === 'spi') res.spi++;
        else if (r.bus === 'uart') res.uart++;
        else if (r.bus === 'i2s') res.i2s++;
        else if (r.bus === 'csi') res.csi++;
        else if (r.bus === 'pwm') res.pwm++;
        else if (r.bus === 'adc') res.adc++;
        else if (r.bus === 'onewire') res.onewire++;
        res.gpio += r.pins || 0;
      }
    });

    /* ---- 电源负载与供给 ---- */
    const load = { v5: 0, v33: 0, v12: 0, peak5: 0 };
    const supplies = { v5: 0, v33: 0, v12: 0 };
    const rails = {};
    items.forEach(({ m, qty }) => {
      const r = m.req;
      if (m.cat === 'power') {
        if (r.kind === 'source' || r.kind === 'converter') {
          if (r.vout === 5) supplies.v5 += (r.aout || 0);
          if (r.vout === 3.3) supplies.v33 += (r.aout || 0);
          if (r.vout === 12) supplies.v12 += (r.aout || 0);
          if (r.vout === 11.1) supplies.v12 += 3;   /* 3S 锂电等效可用 12V 轨 */
          if (r.vout === 7.4) supplies.v5 += 2;     /* 2S 锂电降压后可用 5V 轨 */
        }
        return;
      }
      if (m.cat === 'mech' && !r.mA) return;
      const amp = ((r.peak || r.mA || 0) / 1000) * qty;
      if (r.rail) rails[r.rail] = (rails[r.rail] || 0) + amp;
      if (r.ext && r.rail) { /* 外接电源设备不计入主控供电预算 */ }
      else if (r.v && /5/.test(r.v)) { load.v5 += amp; load.peak5 += amp; }
      else if (r.v && /3\.3/.test(r.v)) { load.v33 += amp; }
    });
    if (board) {
      supplies.v5 += (board.caps.mA5 || 0) / 1000;
      supplies.v33 += (board.caps.mA33 || 0) / 1000;
    }

    /* ---- R0 缺少主控 ---- */
    if (!board) {
      issues.push({
        rule: 'R0', level: items.length ? 'err' : 'warn',
        title: items.length ? '方案缺少主控开发板' : '方案为空',
        body: items.length
          ? '所有外设都需要一个主控来驱动。请先在「主控开发板」分类中选择一块开发板，再继续添加模块。'
          : '从模块库开始添加，建议先确定主控开发板，它是整个方案的兼容性基准。',
      });
    }

    if (board) {
      const c = board.caps;

      /* ---- R1 接口数量超限 ---- */
      const busChecks = [
        { label: 'UART', need: res.uart, cap: c.uart },
        { label: 'I2S', need: res.i2s, cap: c.i2s },
        { label: 'CSI 摄像头接口', need: res.csi, cap: c.csi },
        { label: 'ADC 通道', need: res.adc, cap: c.adc },
        { label: 'PWM 通道', need: res.pwm, cap: c.pwm },
      ];
      busChecks.forEach(b => {
        if (b.cap === 0 && b.need > 0) {
          issues.push({
            rule: 'R1', level: 'err', title: b.label + ' 不可用',
            body: board.name + ' 不提供 ' + b.label + '，但方案中有 ' + b.need + ' 个模块需要它。请更换主控或移除相关模块。',
          });
        } else if (b.need > b.cap) {
          issues.push({
            rule: 'R1', level: 'err', title: b.label + ' 数量超限',
            body: '需要 ' + b.need + ' 路，' + board.name + ' 仅提供 ' + b.cap + ' 路，超出 ' + (b.need - b.cap) + ' 路。可减少模块数量或改用 I2C 扩展方案。',
          });
        }
      });
      const spiCap = c.spi * 3;
      if (res.spi > spiCap) {
        issues.push({
          rule: 'R1', level: 'err', title: 'SPI 从设备数量超限',
          body: '方案中有 ' + res.spi + ' 个 SPI 设备，' + board.name + ' 的 ' + c.spi + ' 个 SPI 控制器最多挂载 ' + spiCap + ' 个从设备。',
        });
      }

      /* ---- R2 GPIO 引脚不足 ---- */
      if (res.gpio > c.gpio) {
        issues.push({
          rule: 'R2', level: 'err', title: 'GPIO 引脚不足',
          body: '所有模块合计占用 ' + res.gpio + ' 个 IO，' + board.name + ' 可用 ' + c.gpio + ' 个，超出 ' + (res.gpio - c.gpio) + ' 个。可加装 PCF8574 扩展 8 路 IO，或改用 I2C 接口的模块。',
        });
      }

      /* ---- R3 逻辑电平不匹配 ---- */
      const hasShifter = items.some(x => x.m.id === 'level-shifter-4ch');
      const fiveV = items.filter(x => x.m.req.v && /^5/.test(x.m.req.v) && x.m.cat !== 'board' && x.m.cat !== 'power');
      if (c.v === 3.3 && fiveV.length && !hasShifter) {
        issues.push({
          rule: 'R3', level: 'warn', title: '逻辑电平不匹配',
          body: board.name + ' 的 IO 为 3.3V 逻辑，但方案中有 ' + fiveV.length + ' 个 5V 器件（' +
            fiveV.slice(0, 3).map(x => x.m.name).join('、') + (fiveV.length > 3 ? ' 等' : '') +
            '）。5V 输出直接进 3.3V 引脚可能损坏主控，建议加入「4 路双向电平转换」模块。',
        });
      }
      if (c.v === 3.3 && fiveV.length && hasShifter) {
        issues.push({
          rule: 'R3', level: 'ok', title: '电平已由转换模块处理',
          body: '方案含「4 路双向电平转换」，可覆盖 4 路 5V 信号。若 5V 器件超过 4 路，请增加转换模块数量。',
        });
      }

      /* ---- R4 I2C 地址冲突 ---- */
      const conflicts = Object.keys(res.addr).filter(k => new Set(res.addr[k]).size > 1 || res.addr[k].length > 1)
        .map(k => [k, res.addr[k]]);
      const hasMux = items.some(x => x.m.id === 'tca9548a');
      if (conflicts.length && !hasMux) {
        conflicts.forEach(([addr, arr]) => {
          const names = Array.from(new Set(arr)).map(id => D.MODULE_MAP[id].name);
          issues.push({
            rule: 'R4', level: 'warn', title: 'I2C 地址 ' + addr.toUpperCase() + ' 冲突',
            body: '以下模块固定使用同一地址：' + names.join('、') +
              '。它们无法挂载在同一条 I2C 总线上，建议加入「TCA9548A I2C 多路复用器」（可分出 8 条支路），或通过 ADDR/AD0 跳线改地址。',
          });
        });
      }
      if (conflicts.length && hasMux) {
        issues.push({
          rule: 'R4', level: 'ok', title: '地址冲突已由多路复用器解决',
          body: '方案含 TCA9548A，可将冲突器件分挂在不同支路上。请在代码中依次切换通道读取。',
        });
      }

      /* ---- R5 供电能力不足 ---- */
      const cap5 = supplies.v5, cap33 = supplies.v33;
      if (load.peak5 > cap5 + 0.001) {
        issues.push({
          rule: 'R5', level: 'err', title: '5V 供电能力不足',
          body: '5V 负载峰值约 ' + load.peak5.toFixed(2) + ' A，可用供电约 ' + cap5.toFixed(2) + ' A，缺口 ' +
            (load.peak5 - cap5).toFixed(2) + ' A。建议加入「12V 5A 电源适配器 + LM2596 降压模块」，或把大电流执行器改为独立供电。',
        });
      } else if (load.peak5 > cap5 * 0.75 && cap5 > 0) {
        issues.push({
          rule: 'R5', level: 'warn', title: '5V 供电余量偏低',
          body: '5V 负载峰值 ' + load.peak5.toFixed(2) + ' A，可用 ' + cap5.toFixed(2) +
            ' A，余量不足 25%。舵机与电机启动瞬间可能拉低电压导致主控复位，建议加大电源或加装大电容。',
        });
      }
      if (load.v33 > cap33 + 0.001) {
        issues.push({
          rule: 'R5', level: 'err', title: '3.3V 供电能力不足',
          body: '3.3V 负载约 ' + load.v33.toFixed(2) + ' A，可用约 ' + cap33.toFixed(2) + ' A，缺口 ' +
            (load.v33 - cap33).toFixed(2) + ' A。建议加入独立的 3.3V LDO 供电。',
        });
      }

      /* ---- R6 算力档位不足 ---- */
      const needCls = Math.max.apply(null, [0].concat(
        items.filter(x => x.m.cat !== 'board').map(x => x.m.req.cls || 0)));
      if (needCls > c.cls) {
        const heavy = items.filter(x => (x.m.req.cls || 0) > c.cls).map(x => x.m.name);
        issues.push({
          rule: 'R6', level: 'err', title: '主控算力档位不足',
          body: board.name + ' 属于「' + D.CLASS_LABEL[c.cls] + '」，而 ' + heavy.join('、') +
            ' 需要「' + D.CLASS_LABEL[needCls] + '」。建议升级主控（如 Raspberry Pi 5 / Jetson Orin Nano）。',
        });
      }

      /* ---- R7 缺少必需的总线协议 ---- */
      const protos = {};
      items.forEach(x => { if (x.m.req.proto) protos[x.m.req.proto] = true; });
      Object.keys(protos).forEach(p => {
        if (p === 'wifi' && !c.wifi) {
          issues.push({ rule: 'R7', level: 'err', title: '缺少 WiFi 能力', body: board.name + ' 不支持 WiFi，但方案中有模块需要无线联网。' });
        }
        if (p === 'ble' && !c.ble && !c.wifi) {
          issues.push({ rule: 'R7', level: 'warn', title: '缺少蓝牙能力', body: board.name + ' 不支持蓝牙，需要蓝牙连接的模块将无法工作，可加装 HC-05 或更换主控。' });
        }
        if (p === 'can' && !c.can) {
          issues.push({ rule: 'R7', level: 'err', title: '主控不含 CAN 控制器', body: 'CAN 收发模块需要主控内置 CAN 控制器。' + board.name + ' 不提供，请改用 STM32F407 等带 CAN 的主控。' });
        }
      });

      /* ---- R8 缺少驱动板或外接电源 ---- */
      const drivers = items.filter(x => x.m.req.driver).map(x => x.m);
      const motors = items.filter(x => x.m.cat === 'actuator').map(x => x.m);
      const driverIds = ['tb6612', 'l298n', 'a4988', 'tmc2209', 'pca9685', 'esc-30a'];
      const hasMotorDriver = items.some(x => driverIds.indexOf(x.m.id) >= 0);
      if (motors.length && !hasMotorDriver && !drivers.some(d => d.cat === 'expand')) {
        issues.push({
          rule: 'R8', level: 'warn', title: '执行器缺少驱动板',
          body: '方案含 ' + motors.length + ' 个执行器，但没有任何电机 / 舵机驱动板。主控 IO 无法直接驱动电机，建议加入 TB6612（直流电机）、A4988（步进）或 PCA9685（舵机）。',
        });
      }
      const extNeed = items.filter(x => x.m.req.ext && x.m.req.rail);
      if (extNeed.length) {
        const railSet = Array.from(new Set(extNeed.map(x => x.m.req.rail)));
        const powerVouts = items.filter(x => x.m.cat === 'power' && x.m.req.vout).map(x => x.m.req.vout);
        const maxVout = powerVouts.length ? Math.max.apply(null, powerVouts) : 0;
        const missing = railSet.filter(r => !(maxVout >= r - 1));
        if (missing.length) {
          issues.push({
            rule: 'R8', level: 'warn', title: missing.join('V / ') + 'V 独立电源缺失',
            body: extNeed.map(x => x.m.name).slice(0, 3).join('、') +
              ' 等模块需要独立外接电源（峰值电流远超主控供电能力），但方案中没有提供足够电压的电源或电池组。建议加入 12V 电源适配器（配 LM2596 降压）或 3S 锂电。',
          });
        }
      }
      const servoNeed = items.filter(x => x.m.req.ext && x.m.req.rail === 5);
      if (servoNeed.length && !items.some(x => x.m.cat === 'power')) {
        issues.push({
          rule: 'R8', level: 'warn', title: '舵机/大电流器件需要独立 5V',
          body: servoNeed.map(x => x.m.name).join('、') + ' 启动电流大，务必独立供电，不要从主控 5V 引脚取电，否则会导致主控复位。',
        });
      }
    }

    /* ---- 成本 ---- */
    const cost = Compat.cost(scheme);

    /* ---- 难度与工时 ---- */
    let diff = 1;
    if (cost.kinds > 2) diff++;
    if (cost.kinds > 6) diff++;
    if (items.some(x => x.m.req.driver)) diff++;
    if (items.some(x => ['proto-board', 'pcb-fab'].indexOf(x.m.id) >= 0)) diff++;
    if (items.some(x => x.m.req.rail === 12)) diff++;
    if (items.some(x => (x.m.req.cls || 0) >= 2)) diff++;
    diff = clamp(diff, 1, 5);
    const hours = Math.round((0.5 + cost.kinds * 0.28 +
      (items.some(x => x.m.req.driver) ? 0.6 : 0) +
      (items.some(x => ['proto-board', 'pcb-fab'].indexOf(x.m.id) >= 0) ? 1.6 : 0)) * 10) / 10;

    const errs = issues.filter(i => i.level === 'err').length;
    const warns = issues.filter(i => i.level === 'warn').length;
    const railList = Object.keys(rails).map(v => ({ rail: Number(v), amp: rails[v] }));

    return {
      items, board, res, load, supplies, rails: railList, cost, issues,
      errors: errs, warnings: warns,
      pass: items.length > 0 && errs === 0,
      difficulty: diff, hours,
      verdict: !items.length ? 'empty' : (errs ? 'block' : (warns ? 'warn' : 'ok')),
    };
  },

  /* 资源占用表 */
  resourceTable(rep) {
    if (!rep.board) return [];
    const c = rep.board.caps;
    const rows = [
      { label: 'GPIO 引脚', need: rep.res.gpio, cap: c.gpio, unit: '个' },
      { label: 'I2C 设备', need: rep.res.i2c, cap: c.i2c * 8, unit: '个' },
      { label: 'SPI 从设备', need: rep.res.spi, cap: c.spi * 3, unit: '个' },
      { label: 'UART 串口', need: rep.res.uart, cap: c.uart, unit: '路' },
      { label: 'PWM 通道', need: rep.res.pwm, cap: c.pwm, unit: '路' },
      { label: 'ADC 通道', need: rep.res.adc, cap: c.adc, unit: '路' },
    ].filter(r => r.cap > 0 || r.need > 0);
    return rows.map(r => Object.assign({}, r, {
      pct: r.cap ? clamp(Math.round(r.need / r.cap * 100), 0, 100) : 100,
      over: r.need > r.cap,
    }));
  },

  /* 功耗预算表 */
  powerTable(rep) {
    const rows = [
      { label: '5V 轨', need: rep.load.peak5, cap: rep.supplies.v5 },
      { label: '3.3V 轨', need: rep.load.v33, cap: rep.supplies.v33 },
    ];
    return rows.map(r => Object.assign({}, r, {
      pct: r.cap ? clamp(Math.round(r.need / r.cap * 100), 0, 100) : (r.need ? 100 : 0),
      over: r.need > r.cap,
      needText: r.need.toFixed(2),
      capText: r.cap.toFixed(2),
    }));
  },

  /* 单模块与当前方案的兼容性（详情页用） */
  checkOne(moduleId, scheme) {
    const s = JSON.parse(JSON.stringify(scheme));
    const added = !(s.items || []).find(i => i.id === moduleId);
    if (added) s.items.push({ id: moduleId, qty: 1 });
    return { report: Compat.evaluate(s), added };
  },
};

module.exports = Compat;
