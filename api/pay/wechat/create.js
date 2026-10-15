/**
 * POST /api/pay/wechat/create
 * 微信支付 V3 · Native 扫码下单
 *
 * 请求体：{ orderNo, amount, subject, attach? }   amount 单位为元
 * 响应：  { channel, codeUrl, payNo, expireAt, mode }
 *
 * 前端对接：assets/js/core.js → Pay.create()
 */
const { createNativeOrder } = require('../../_lib/wechat');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { orderNo, amount, subject, attach } = body;

    if (!orderNo || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: '缺少 orderNo 或 amount 无效' });
    }

    // 金额必须由服务端以订单为准，禁止直接信任前端传入的金额
    const amountFen = Math.round(Number(amount) * 100);

    const result = await createNativeOrder({
      outTradeNo: orderNo,
      amountFen,
      description: subject || '硬件定制方案',
      attach,
    });

    return res.status(200).json({
      channel: 'wechat',
      mode: 'Native 扫码支付',
      codeUrl: result.code_url,
      payNo: orderNo,
      expireAt: Date.now() + 30 * 60 * 1000,
    });
  } catch (err) {
    console.error('[wechat/create]', err);
    return res.status(500).json({ error: err.message || '微信下单失败' });
  }
};
