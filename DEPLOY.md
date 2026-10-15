# 部署指南

站点是**纯静态产物**：无构建步骤、无运行时依赖、无框架。所有页面之间的链接、`assets/` 资源引用均为相对路径，因此部署在根域名或子路径（如 `user.github.io/repo/`）下都能正确解析，无需修改任何配置。

> ⚠️ 本地预览必须通过 HTTP 服务访问。直接双击打开 HTML 会因 `file://` 协议限制导致 `localStorage` 分区异常与相对路径解析失败。

```bash
python3 -m http.server 8080     # 或
npx serve .                     # 或
npm run dev
```

---

## 一、GitHub Pages

仓库内已提供自动部署工作流 `.github/workflows/deploy-pages.yml`，以及用于跳过 Jekyll 处理的 `.nojekyll`。

### 步骤

1. 把项目推送到 GitHub 仓库的 `main`（或 `master`）分支。
2. 进入仓库 **Settings → Pages**，把 **Source** 设为 **GitHub Actions**。
3. 推送到 `main` 即触发工作流，发布完成后页面地址为
   `https://<用户名>.github.io/<仓库名>/`

### 工作流做了什么

```yaml
on:
  push:
    branches: [main, master]
  workflow_dispatch:        # 支持手动触发

permissions:
  contents: read
  pages: write
  id-token: write

steps:
  - actions/checkout@v4
  - actions/configure-pages@v5
  - actions/upload-pages-artifact@v3   # path: .  ← 直接发布仓库根目录
  - actions/deploy-pages@v4
```

### 注意事项

- `.nojekyll` 必须存在，否则以下划线开头的文件（`_headers`、`_redirects`）会被 Jekyll 忽略。
- 若使用自定义域名，在 `Settings → Pages → Custom domain` 填写，并在 DNS 侧添加 CNAME 记录。
- 若仓库名不是 `<用户名>.github.io`，站点会部署在子路径下——由于全部使用相对路径，无需任何改动。
- GitHub Pages **不支持服务端函数**。若要启用真实支付，需要把 `api/` 部署到 Vercel 或 Cloudflare Workers，并在前端把接口地址指向该域名（注意配置 CORS）。

---

## 二、Vercel

仓库内已提供 `vercel.json`。

### 方式 A：Git 集成（推荐）

1. 在 Vercel 控制台 **Add New → Project**，导入该仓库。
2. Framework Preset 选 **Other**，Build Command 与 Output Directory 均留空。
3. Deploy。

Vercel 会自动完成两件事：

- 根目录的静态文件作为静态站点发布
- `api/` 目录下的每个文件自动映射为 Serverless Function（Node.js 运行时）

因此以下接口会立即可用：

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/pay/wechat/create` | 微信支付 V3 Native 下单 |
| `POST` | `/api/pay/wechat/notify` | 微信支付结果异步通知 |
| `POST` | `/api/pay/alipay/create` | 支付宝当面付预下单 |
| `POST` | `/api/pay/alipay/notify` | 支付宝异步通知 |
| `POST` | `/api/orders?action=create` | 创建订单 |
| `GET` | `/api/orders?action=status&id=<id>` | 查询支付状态（前端轮询） |
| `GET` | `/api/orders?action=list` | 后台订单列表 |
| `POST` | `/api/orders?action=state` | 后台状态流转 |
| `POST` / `GET` | `/api/orders?action=heat` | 热度埋点上报 / 排行 |

`vercel.json` 中额外配置了：

- 安全响应头（`X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy`）
- `assets/` 目录一年期强缓存，HTML 不缓存
- 两条 rewrite，把 `/api/orders/:id/status` 与 `/api/heat` 映射到统一的函数入口

### 方式 B：CLI

```bash
npm i -g vercel
vercel dev      # 本地同时起静态站点与 Serverless Functions
vercel          # 部署到预览环境
vercel --prod   # 部署到生产环境
```

### 环境变量

在 **Project → Settings → Environment Variables** 中配置（不要写进代码或提交到仓库）：

```
WXPAY_APPID=...
WXPAY_MCHID=...
WXPAY_SERIAL=...
WXPAY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
WXPAY_APIV3_KEY=...
WXPAY_NOTIFY_URL=https://<你的域名>/api/pay/wechat/notify
WXPAY_PLATFORM_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

ALIPAY_APPID=...
ALIPAY_PRIVATE_KEY="..."
ALIPAY_PUBLIC_KEY="..."
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_NOTIFY_URL=https://<你的域名>/api/pay/alipay/notify
```

> 私钥中的换行可以用字面量 `\n` 写入，示例代码已做 `.replace(/\\n/g, '\n')` 处理。

---

## 三、Cloudflare Pages

仓库内已提供 `_headers` 与 `_redirects`。

### 步骤

1. Cloudflare 控制台 → **Workers & Pages → Create → Pages → Connect to Git**。
2. 选择仓库，分支选 `main`。
3. **Build command** 留空，**Build output directory** 填 `/`。
4. Save and Deploy。

### 配置文件说明

`_headers`：

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: public, max-age=0, must-revalidate
```

`_redirects`：

```
/pay/notify  /api/pay/mock/notify  302
```

### 服务端函数（Workers）

Cloudflare Pages 的 Functions 放在 `functions/` 目录，与 Vercel 的 `api/` 结构不同。若要在 Cloudflare 上启用真实支付，需要把 `api/` 下的逻辑迁移为 Workers 形式：

```js
// functions/api/pay/wechat/create.js
import { createNativeOrder } from '../../../_lib/wechat.js';

export async function onRequestPost({ request, env }) {
  const { orderNo, amount, subject } = await request.json();
  const result = await createNativeOrder({ outTradeNo: orderNo, amountFen: Math.round(amount * 100), description: subject });
  return Response.json({ channel: 'wechat', codeUrl: result.code_url, expireNo: orderNo });
}
```

`_lib/` 中的签名与解密逻辑基于 Web Crypto 与 `node:crypto` 兼容 API，只需把环境变量读取从 `process.env` 改为 `env` 参数即可复用。

同时需要在 Pages 项目设置里配置与上文相同的环境变量（Encrypted variables）。

---

## 四、其他静态托管

任何能托管静态文件的服务都可以直接使用，无需额外配置：

- **Netlify**：拖拽目录或连接仓库，Build command 留空，Publish directory 填 `.`
- **对象存储 + CDN**（腾讯云 COS / 阿里云 OSS / AWS S3 + CloudFront）：上传全部文件，把索引文档设为 `index.html`，错误文档设为 `404.html`
- **Nginx / Apache**：把项目目录设为站点根目录即可

---

## 五、部署后检查清单

- [ ] 首页能正常打开，导航栏 6 个入口均可跳转
- [ ] 模块库筛选、排序、分页正常，加入方案后导航徽标数字增加
- [ ] 工作台能添加模块并看到校验结论与资源占用
- [ ] 结算页填完信息提交后跳到支付页
- [ ] 支付页点击「模拟支付成功」后展示成功页
- [ ] 后台用口令 `mosaic-admin` 登录，能看到刚创建的订单并执行发货
- [ ] 手机浏览器打开无横向滚动，汉堡菜单可展开收起
- [ ] （接入真实支付后）支付回调地址可被公网访问，且回调日志中验签通过

---

## 六、常见问题

**Q：直接双击 HTML 打开，页面样式错乱、按钮无反应？**
A：必须通过 HTTP 服务访问。`file://` 协议下浏览器会限制 `localStorage` 与部分 API。

**Q：部署到子路径后页面跳转 404？**
A：本项目全部使用相对路径（如 `catalog.html`、`assets/css/main.css`），理论上不会出现该问题。若确实出现，请检查是否使用了绝对路径 `/assets/...` 的改写。

**Q：换了一台设备后订单和方案都不见了？**
A：演示环境的全部数据存放在浏览器 `localStorage` 中，不跨设备同步——这是预期行为。接入真实后端后即可跨设备。

**Q：后台口令是什么？**
A：演示口令为 `mosaic-admin`。生产环境请把校验移到服务端，并使用 HttpOnly 会话 Cookie 与角色权限控制。

**Q：支付能收到真钱吗？**
A：不能。默认使用「演示模式」通道，不产生任何资金往来。接入微信支付或支付宝需要先完成商户资质申请，配置上表中的环境变量，并把前端 `Pay.create` / `Pay.query` 指向服务端接口。
