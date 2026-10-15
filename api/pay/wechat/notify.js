/**
 * POST /api/pay/wechat/notify
 * 微信支付 V3 · 支付结果异步通知
 *
 * 微信要求：验签通过后必须返回 { code: "SUCCESS" }，否则会持续重试。
 * 处理原则：
 *   1. 先验签，未通过一律拒绝（fail-closed）
 *   2. 解密 resource 得到真实支付结果
 *   3. 校验金额与订单一致，防止金额篡改
 *   4. 幂等：已付款的订单直接返回成功，避免重复发货
 */
const { decryptResource, verifyNotifySignature } = require('../../_lib/wechat');
const { Store } = require('../../_lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ code: 'FAIL', message: 'Method Not Allowed' });
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

  // 1) 验签
  if (!verifyNotifySignature(req.headers, rawBody)) {
    console.warn('[wechat/notify] 签名校验失败，已拒绝');
    return res.status(401).json({ code: 'FAIL', message: '签名验证失败' });
  }

  try {
    const notify = JSON.parse(rawBody);

    // 2) 解密
    const result = decryptResource(notify.resource);
    const { out_trade_no: orderNo, transaction_id: transactionId, trade_state: tradeState, amount } = result;

    if (tradeState !== 'SUCCESS') {
      // 非成功状态仅记录，不改变订单状态
      return res.status(200).json({ code: 'SUCCESS', message: '已接收' });
    }

    const order = Store.getOrder(orderNo);
    if (!order) {
      // 找不到订单时返回成功，避免微信无意义重试；同时告警人工排查
      console.error('[wechat/notify] 未找到订单', orderNo);
      return res.status(200).json({ code: 'SUCCESS', message: '订单不存在，已忽略' });
    }

    // 4) 幂等
    if (['paid', 'picking', 'shipped', 'done'].includes(order.state)) {
      return res.status(200).json({ code: 'SUCCESS', message: '订单已处理' });
    }

    // 3) 金额校验（单位：分）
    const expectedFen = Math.round(Number(order.amount) * 100);
    if (Number(amount.total) !== expectedFen) {
      console.error('[wechat/notify] 金额不匹配', { orderNo, got: amount.total, expected: expectedFen });
      return res.status(400).json({ code: 'FAIL', message: '金额校验失败' });
    }

    Store.setState(orderNo, 'paid', `微信支付成功 · ${transactionId}`, {
      payChannel: 'wechat',
      payNo: transactionId,
      paidAt: Date.now(),
      settleVia: 'wechat-notify',
    });

    // TODO: 在此触发库存扣减、发货单生成、通知推送等后续动作（建议与状态更新同事务）

    return res.status(200).json({ code: 'SUCCESS', message: '成功' });
  } catch (err) {
    console.error('[wechat/notify]', err);
    return res.status(500).json({ code: 'FAIL', message: '处理失败' });
  }
};
