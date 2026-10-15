/**
 * POST /api/pay/alipay/create
 * 支付宝 · 当面付预下单
 *
 * 请求体：{ orderNo, amount, subject }   amount 单位为元
 * 响应：  { channel, qrCode, payNo, expireAt, mode }
 */
const { precreate } = require('../../_lib/alipay');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { orderNo, amount, subject } = body;

    if (!orderNo || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: '缺少 orderNo 或 amount 无效' });
    }

    // 金额以服务端订单为准；此处仅做格式归一
    const result = await precreate({
      outTradeNo: orderNo,
      amountYuan: Number(amount).toFixed(2),
      subject: subject || '硬件定制方案',
    });

    return res.status(200).json({
      channel: 'alipay',
      mode: '当面付 · 预下单',
      qrCode: result.qr_code,
      payNo: result.out_trade_no,
      expireAt: Date.now() + 30 * 60 * 1000,
    });
  } catch (err) {
    console.error('[alipay/create]', err);
    return res.status(500).json({ error: err.message || '支付宝下单失败' });
  }
};
