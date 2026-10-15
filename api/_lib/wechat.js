/**
 * 微信支付 V3 服务端工具
 * ---------------------------------------------------------------
 * 需要配置的环境变量（严禁写入前端代码）：
 *   WXPAY_APPID          公众号/小程序/APP 的 appid
 *   WXPAY_MCHID          商户号
 *   WXPAY_SERIAL         商户 API 证书序列号
 *   WXPAY_PRIVATE_KEY    商户私钥内容（apiclient_key.pem 全文，含换行）
 *   WXPAY_APIV3_KEY      APIv3 密钥（32 位，用于回调报文解密）
 *   WXPAY_NOTIFY_URL     支付结果回调地址，如 https://your.domain/api/pay/wechat/notify
 *
 * 官方文档：https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml
 */
const crypto = require('crypto');

const API_HOST = 'https://api.mch.weixin.qq.com';

/** 生成请求签名（RSA-SHA256） */
function buildAuthorization(method, urlPath, body) {
  const mchid = process.env.WXPAY_MCHID;
  const serial = process.env.WXPAY_SERIAL;
  const privateKey = process.env.WXPAY_PRIVATE_KEY;

  if (!mchid || !serial || !privateKey) {
    throw new Error('微信支付凭据未配置：需要 WXPAY_MCHID / WXPAY_SERIAL / WXPAY_PRIVATE_KEY');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  // 签名串格式：HTTP方法\nURL路径\n时间戳\n随机串\n请求体\n
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body || ''}\n`;

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(message)
    .sign(privateKey.replace(/\\n/g, '\n'), 'base64');

  return (
    'WECHATPAY2-SHA256-RSA2048 ' +
    `mchid="${mchid}",` +
    `nonce_str="${nonce}",` +
    `signature="${signature}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${serial}"`
  );
}

/** 统一下单（Native 扫码支付），返回 code_url */
async function createNativeOrder({ outTradeNo, amountFen, description, attach }) {
  const urlPath = '/v3/pay/transactions/native';
  const body = JSON.stringify({
    appid: process.env.WXPAY_APPID,
    mchid: process.env.WXPAY_MCHID,
    description: description || '硬件定制方案',
    out_trade_no: outTradeNo,
    notify_url: process.env.WXPAY_NOTIFY_URL,
    attach: attach || undefined,
    amount: { total: amountFen, currency: 'CNY' },
    time_expire: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  const res = await fetch(API_HOST + urlPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: buildAuthorization('POST', urlPath, body),
      'User-Agent': 'MOSAIC-Hardware-Composer/1.0',
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`微信下单失败 ${res.status}: ${data.message || JSON.stringify(data)}`);
  }
  return data; // { code_url }
}

/** 解密回调报文中的 resource（AES-256-GCM） */
function decryptResource(resource) {
  const key = process.env.WXPAY_APIV3_KEY;
  if (!key) throw new Error('缺少 WXPAY_APIV3_KEY，无法解密回调报文');

  const ciphertext = Buffer.from(resource.ciphertext, 'base64');
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'utf8'),
    Buffer.from(resource.nonce, 'utf8')
  );
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(resource.associated_data || '', 'utf8'));

  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

/**
 * 校验回调签名。
 * 完整实现需要下载并缓存微信支付平台证书（或公钥），用其中的公钥验证：
 *   Wechatpay-Timestamp\nWechatpay-Nonce\n报文主体\n
 * 这里给出校验入口与失败即拒的默认策略，避免伪造通知入库。
 */
function verifyNotifySignature(headers, rawBody) {
  const timestamp = headers['wechatpay-timestamp'];
  const nonce = headers['wechatpay-nonce'];
  const signature = headers['wechatpay-signature'];
  const serial = headers['wechatpay-serial'];

  if (!timestamp || !nonce || !signature || !serial) return false;

  // 防重放：回调时间戳与当前时间偏差不得超过 5 分钟
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const platformPublicKey = process.env.WXPAY_PLATFORM_PUBLIC_KEY;
  if (!platformPublicKey) {
    // 未配置平台公钥时拒绝放行（fail-closed），而不是默认信任
    console.warn('[wechat] 未配置 WXPAY_PLATFORM_PUBLIC_KEY，回调签名校验被跳过（已拒绝）');
    return false;
  }

  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
  try {
    return crypto
      .createVerify('RSA-SHA256')
      .update(message)
      .verify(platformPublicKey.replace(/\\n/g, '\n'), signature, 'base64');
  } catch (e) {
    return false;
  }
}

module.exports = { createNativeOrder, decryptResource, verifyNotifySignature, buildAuthorization };
