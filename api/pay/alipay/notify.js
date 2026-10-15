/**
 * POST /api/pay/alipay/notify
 * 支付宝 · 异步通知（notify_url）
 *
 * 支付宝要求：处理成功后必须返回纯文本 "success"，否则会按策略重试。
 * 处理原则与微信一致：先验签 → 校验金额 → 幂等判断 → 落库。
 *
 * 注意：支付宝通知为 form-urlencoded，需要读取原始请求体。
 */
const { verifySign } = require('../../_lib/alipay');
const { Store } = require('../../_lib/store');

function parseForm(raw) {
  const out = {};
  new URLSearchParams(raw).forEach((v, k) => { out[k] = v; });
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('fail');
  }

  const rawBody = typeof req.body === 'string'
    ? req.body
    : new URLSearchParams(req.body || {}).toString();

  const params = parseForm(rawBody);

  // 1) 验签
  if (!verifySign(params)) {
    console.warn('[alipay/notify] 验签失败，已拒绝');
    return res.status(401).send('fail');
  }

  try {
    const orderNo = params.out_trade_no;
    const tradeStatus = params.trade_status;
    const totalAmount = params.total_amount;

    // 只有交易成功或已完结才更新订单
    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(tradeStatus)) {
      return res.status(200).send('success');
    }

    const order = Store.getOrder(orderNo);
    if (!order) {
      console.error('[alipay/notify] 未找到订单', orderNo);
      return res.status(200).send('success');
    }

    // 幂等
    if (['paid', 'picking', 'shipped', 'done'].includes(order.state)) {
      return res.status(200).send('success');
    }

    // 金额校验
    if (Number(totalAmount).toFixed(2) !== Number(order.amount).toFixed(2)) {
      console.error('[alipay/notify] 金额不匹配', { orderNo, got: totalAmount, expected: order.amount });
      return res.status(400).send('fail');
    }

    Store.setState(orderNo, 'paid', `支付宝支付成功 · ${params.trade_no}`, {
      payChannel: 'alipay',
      payNo: params.trade_no,
      paidAt: Date.now(),
      settleVia: 'alipay-notify',
    });

    return res.status(200).send('success');
  } catch (err) {
    console.error('[alipay/notify]', err);
    return res.status(500).send('fail');
  }
};
