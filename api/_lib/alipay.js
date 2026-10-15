/**
 * 支付宝服务端工具（当面付 · 预下单）
 * ---------------------------------------------------------------
 * 需要配置的环境变量（严禁写入前端代码）：
 *   ALIPAY_APPID           应用 AppID
 *   ALIPAY_PRIVATE_KEY     应用私钥（PKCS8，含换行）
 *   ALIPAY_PUBLIC_KEY      支付宝公钥（用于回调验签）
 *   ALIPAY_GATEWAY         网关，默认 https://openapi.alipay.com/gateway.do
 *   ALIPAY_NOTIFY_URL      异步通知地址，如 https://your.domain/api/pay/alipay/notify
 *
 * 官方文档：https://opendocs.alipay.com/open/02ekfg
 */
const crypto = require('crypto');

function gateway() {
  return process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
}

/** 按支付宝规则排序并拼接待签名字符串 */
function buildSignContent(params) {
  return Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}

/** RSA2（SHA256withRSA）签名 */
function sign(params) {
  const privateKey = process.env.ALIPAY_PRIVATE_KEY;
  if (!privateKey) throw new Error('缺少 ALIPAY_PRIVATE_KEY');
  return crypto
    .createSign('RSA-SHA256')
    .update(buildSignContent(params), 'utf8')
    .sign(privateKey.replace(/\\n/g, '\n'), 'base64');
}

/** 回调验签：使用支付宝公钥验证 sign */
function verifySign(params) {
  const publicKey = process.env.ALIPAY_PUBLIC_KEY;
  if (!publicKey) {
    console.warn('[alipay] 未配置 ALIPAY_PUBLIC_KEY，回调验签被跳过（已拒绝）');
    return false;
  }
  const incoming = params.sign;
  const signType = params.sign_type;
  if (!incoming || signType !== 'RSA2') return false;

  const copy = Object.assign({}, params);
  delete copy.sign;
  delete copy.sign_type;

  try {
    return crypto
      .createVerify('RSA-SHA256')
      .update(buildSignContent(copy), 'utf8')
      .verify(publicKey.replace(/\\n/g, '\n'), incoming, 'base64');
  } catch (e) {
    return false;
  }
}

/**
 * 当面付预下单，返回 qr_code（二维码内容字符串）。
 * amount 单位为元，支付宝要求字符串保留两位小数。
 */
async function precreate({ outTradeNo, amountYuan, subject, body }) {
  const params = {
    app_id: process.env.ALIPAY_APPID,
    method: 'alipay.trade.precreate',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date(Date.now() + 8 * 3600 * 1000)
      .toISOString().replace('T', ' ').slice(0, 19), // 北京时间
    version: '1.0',
    notify_url: process.env.ALIPAY_NOTIFY_URL,
    biz_content: JSON.stringify({
      out_trade_no: outTradeNo,
      total_amount: Number(amountYuan).toFixed(2),
      subject: subject || '硬件定制方案',
      body: body || undefined,
      timeout_express: '30m',
    }),
  };
  params.sign = sign(params);

  const form = new URLSearchParams();
  Object.keys(params).forEach((k) => form.append(k, params[k]));

  const res = await fetch(gateway(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: form.toString(),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('支付宝返回非 JSON：' + text.slice(0, 200));
  }

  // 响应键名形如 alipay_trade_precreate_response
  const key = Object.keys(data).find((k) => k.endsWith('_response'));
  const resp = key ? data[key] : null;
  if (!resp || resp.code !== '10000') {
    throw new Error(`支付宝下单失败: ${resp ? resp.sub_code + ' ' + resp.sub_msg : text.slice(0, 200)}`);
  }
  return resp; // { qr_code, out_trade_no }
}

module.exports = { precreate, sign, verifySign, buildSignContent };
