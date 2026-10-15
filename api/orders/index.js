/**
 * /api/orders
 * ---------------------------------------------------------------
 * 订单与热度的服务端接口（演示实现）。
 *
 *   POST /api/orders                    创建订单
 *   GET  /api/orders?action=status&id=… 查询订单支付状态（前端轮询用）
 *   GET  /api/orders?action=list        后台订单列表
 *   POST /api/orders?action=state       后台状态流转
 *   POST /api/orders?action=heat        热度埋点上报
 *   GET  /api/orders?action=heat        热度排行
 *
 * 生产环境务必加上：
 *   · 用户身份校验（订单只能被本人查询）
 *   · 后台接口的角色权限校验
 *   · 库存扣减与订单创建的事务一致性
 *   · 限流与防刷
 */
const { Store } = require('../_lib/store');

module.exports = async function handler(req, res) {
  const action = (req.query && req.query.action) || 'status';

  try {
    /* ---------- 创建订单 ---------- */
    if (req.method === 'POST' && action === 'create') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!Array.isArray(body.lines) || !body.lines.length) {
        return res.status(400).json({ error: '订单必须包含至少一个模块' });
      }
      // 金额一律以服务端重新计算为准，忽略前端传入的 amount
      const subtotal = body.lines.reduce((a, l) => a + Number(l.price) * Number(l.qty), 0);
      const amount = subtotal; // 生产环境在此叠加运费、装配费、加急费
      const order = Store.createOrder(Object.assign({}, body, {
        cost: Object.assign({}, body.cost, { subtotal, total: amount }),
        amount,
      }));
      return res.status(201).json(order);
    }

    /* ---------- 查询支付状态（前端轮询） ---------- */
    if (req.method === 'GET' && action === 'status') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: '缺少 id' });
      const o = Store.getOrder(id);
      if (!o) return res.status(404).json({ error: '订单不存在' });
      return res.status(200).json({
        state: o.state,
        paid: ['paid', 'picking', 'shipped', 'done'].includes(o.state),
        paidAt: o.paidAt || null,
      });
    }

    /* ---------- 后台列表 ---------- */
    if (req.method === 'GET' && action === 'list') {
      return res.status(200).json({ orders: Store.listOrders() });
    }

    /* ---------- 后台状态流转 ---------- */
    if (req.method === 'POST' && action === 'state') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { id, state, note, extra } = body;
      if (!id || !state) return res.status(400).json({ error: '缺少 id 或 state' });
      const o = Store.setState(id, state, note, extra);
      if (!o) return res.status(404).json({ error: '订单不存在' });
      return res.status(200).json(o);
    }

    /* ---------- 热度埋点 ---------- */
    if (req.method === 'POST' && action === 'heat') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { type, id } = body;
      if (!type || !id) return res.status(400).json({ error: '缺少 type 或 id' });
      if (!['view', 'add', 'order'].includes(type)) {
        return res.status(400).json({ error: 'type 必须是 view / add / order' });
      }
      return res.status(200).json({ ok: true, record: Store.recordHeat(type, id) });
    }

    /* ---------- 热度排行 ---------- */
    if (req.method === 'GET' && action === 'heat') {
      return res.status(200).json({
        range: req.query.range || '7d',
        ranking: Store.heatRanking(),
        note: 'localScore 为 0–100 的本机行为加权分，前端可与平台基线按 0.3 权重合成',
      });
    }

    return res.status(400).json({ error: '不支持的 action: ' + action });
  } catch (err) {
    console.error('[orders]', err);
    return res.status(500).json({ error: err.message || '服务端错误' });
  }
};
