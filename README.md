# MOSAIC 拼造 · 硬件定制平台

> 像拼图一样，造出你的硬件。

**在线体验：** <https://wulier-arch.github.io/mosaic-hardware-composer/>
**作品提交说明：** [`SUBMIT.md`](./SUBMIT.md) · [网页版](https://wulier-arch.github.io/mosaic-hardware-composer/submit.html)

在线选择并组合开发板、传感器、电机、电源、通信与结构件，平台在**每一次加购时**实时校验这套组合在物理与电气层面是否可行，最终输出可下单的方案清单。

---

## 它解决什么问题

| 痛点 | 表现 | 平台的回应 |
|---|---|---|
| **买错** | 3.3V 主控接 5V 传感器、IO 数量不够、I2C 地址撞车——通常在收到货开始接线时才暴露 | 9 条兼容性规则在加购瞬间拦截，把试错成本降到零 |
| **返工** | 工程师手工核对引脚分配、总线占用与功耗预算，一轮打样前要花两三天做纸面推演 | 工作台实时输出资源占用表、功耗预算表与冲突报告，方案可导出 BOM |
| **断链** | 选型、下单、付款、发货分散在不同工具里，方案无法复用 | 方案可存为模板反复下单，订单全流程可视化，支持批量备货与发货 |

---

## 快速开始

站点是**纯静态产物**，没有构建步骤、没有运行时依赖。

```bash
# 任选其一（必须通过 HTTP 服务访问，不要直接双击打开 HTML）
python3 -m http.server 8080
npx serve .
npm run dev            # 等价于 npx serve . -l 8080
```

打开 <http://localhost:8080>。

| 入口 | 说明 |
|---|---|
| `/index.html` | 首页：分类、选型热度、工作方式、用户画像 |
| `/catalog.html` | 模块库：8 大分类 + 多维筛选 |
| `/module.html?id=<模块ID>` | 模块参数详情与实时兼容性结论 |
| `/builder.html` | **选型工作台**：三栏装配 + 兼容性校验 + 成本汇总 |
| `/checkout.html` | 结算下单：收货信息、发票、运费与渠道选择 |
| `/pay.html?order=<订单ID>` | 支付：二维码、倒计时、状态轮询 |
| `/orders.html` | 我的订单：物流时间线、确认收货、复购 |
| `/admin.html` | **后台处理**：订单看板、状态流转、库存管理、埋点审计 |
| `/docs.html` | 需求说明书：核心模块、用户画像、流程、页面结构、响应式要求 |

**后台口令**：`mosaic-admin`（演示环境；生产环境请移到服务端校验）

---

## 设计语言

融合两处参考，形成一套「工程编辑体」：

- **[getartcraft.com](https://getartcraft.com/)** — 暖白纸感底色 `#f2f1ee`、近黑墨色 `#101014`、发丝分割线、编号章节（01 / 02 / 03）、等宽标签
- **[WuXiaoMuer 的 GitHub 主页](https://github.com/WuXiaoMuer)** — 紫罗兰主色 `#a78bfa`、圆角发光、极客徽章气质

| 令牌 | 取值 | 用途 |
|---|---|---|
| `--bg` / `--bg-raised` / `--bg-sunken` | `#f2f1ee` / `#faf9f7` / `#e9e8e4` | 页面底 / 卡片 / 下沉区 |
| `--ink` / `--ink-strong` | `#101014` / `#000` | 正文与标题墨色 |
| `--accent` / `--accent-ink` | `#a78bfa` / `#6d4ee0` | 品牌主色 / 可读性加深版 |
| `--blue` | `#2d81ff` | 次色与状态色 |
| `--line` | `rgba(16,16,20,.13)` | 全部边框体系 |
| 字体 | Archivo / Instrument Serif / Geist Mono | 正文 / 大标题 / 参数标签 |

字体均配置了系统中文字体回退（PingFang SC / Noto Sans SC），字体加载失败时排版不塌陷。

---

## 目录结构

```
.
├── index.html              首页
├── catalog.html            模块库（筛选 + 卡片/紧凑双视图 + 分页）
├── module.html             模块详情（规格 + 实时兼容性 + 相关推荐）
├── builder.html            选型工作台（三栏 / 移动端三页签）
├── checkout.html           结算下单（表单校验 + 计费）
├── pay.html                支付（二维码 + 倒计时 + 状态轮询 + 模拟回调）
├── orders.html             我的订单（查询 + 时间线 + 抽屉详情）
├── admin.html              后台处理（看板 + 状态流转 + 库存 + 埋点）
├── docs.html               需求说明书（12 章节）
├── 404.html                错误页
├── assets/
│   ├── css/main.css        设计系统（令牌 / 组件 / 工作台 / 响应式）
│   └── js/
│       ├── data.js         唯一数据源：86 个模块 + 分类 + 画像 + 流程 + 支付渠道 + 状态机
│       └── core.js         核心运行时：U / ICO / Store / Compat / Heat / Pay / UI
├── api/                    支付与订单的服务端示例（Vercel Serverless / CF Workers）
│   ├── _lib/{store,wechat,alipay}.js
│   ├── pay/wechat/{create,notify}.js
│   ├── pay/alipay/{create,notify}.js
│   └── orders/index.js
├── miniprogram/            微信小程序工程（原生，可直接导入开发者工具）
│   ├── app.js / app.json / app.wxss
│   ├── project.config.json / sitemap.json
│   ├── data/modules.js     86 个模块（由 assets/js/data.js 自动生成，保证同源）
│   ├── utils/
│   │   ├── compat.js       校验引擎（与 core.js 同一套规则）
│   │   ├── store.js        本地存储：方案 / 订单 / 库存 / 埋点 / 表单
│   │   └── heat.js         选型热度（基线 × 本机行为加权）
│   └── pages/              8 个页面：index / catalog / detail / builder /
│                           summary / checkout / orders / mine
├── tools/
│   ├── check-miniprogram.js   小程序静态校验 + 数据层/引擎一致性测试
│   ├── simulate-miniprogram.js 小程序运行时模拟（Node 模拟宿主，跑生命周期与交互）
│   ├── smoke-web.mjs         网页版冒烟测试（headless Chromium 逐页）
│   └── make-docx.py          HTML → 标准 OOXML 文档（含表格与标题样式）
├── 参赛材料/               参赛说明文档（.docx）
├── .github/workflows/deploy-pages.yml
├── vercel.json             Vercel 配置
├── _headers / _redirects   Cloudflare Pages 配置
├── .nojekyll               GitHub Pages 配置
└── DEPLOY.md               部署详解
```

---

## 核心功能模块

| 编号 | 模块 | 承载页面 | 职责 |
|---|---|---|---|
| F1 | 硬件分类浏览 | `catalog.html` | 8 大分类 + 关键词 / 总线接口 / 供电电压 / 价格上限 / 库存 / 排序组合筛选，双视图与分页 |
| F2 | 模块参数详情 | `module.html` | 完整规格表、接口与协议、供电需求、库存与热度排名、实时兼容性结论、同类替代推荐 |
| F3 | 自定义选型与组合 | `builder.html` | 三栏工作台，按 8 个功能分区装配；增删、调数量、同类替换、命名、存模板、载入预设 |
| F4 | 兼容性校验引擎 | `builder.html` | 9 条规则实时校验（见下） |
| F5 | 方案预览与汇总 | `builder.html` / `checkout.html` | 资源占用表、功耗预算表、成本明细、难度评分、工时估算、BOM 导出 |
| F6 | 选型热度 | `index.html` / `catalog.html` | 7 日 / 30 日双维度指数、环比涨跌、分类聚合、14 日趋势线、本机行为加权 |
| F7 | 下单与付款 | `checkout.html` / `pay.html` | 收货信息校验、运费与加急计费、订单创建、微信/支付宝双通道、倒计时与状态轮询 |
| F8 | 后台处理 | `admin.html` | 订单看板、状态流转、发货单号录入、批量转备货、退款与库存回滚、CSV 导出、埋点审计 |

---

## 兼容性校验规则

引擎实现于 `assets/js/core.js` 的 `Compat.evaluate()`，输出「通过 / 提醒 / 冲突」三级结论。

| 编号 | 规则 | 级别 | 判定逻辑 |
|---|---|---|---|
| `R0` | 缺少主控 | 冲突 | 无主控开发板时阻断结算——主控是全部判断的基准 |
| `R1` | 接口数量超限 | 冲突 | 逐项比对 UART / I2S / CSI / ADC / PWM 占用数；SPI 按每控制器最多 3 个从设备折算 |
| `R2` | GPIO 引脚不足 | 冲突 | 累加所有模块占用 IO 并与主控可用 IO 比较 |
| `R3` | 逻辑电平不匹配 | 提醒 | 3.3V 主控 + 5V 器件告警；含电平转换模块则降级为通过 |
| `R4` | I2C 地址冲突 | 提醒 | 同地址两个及以上器件告警；含 TCA9548A 则降级为通过 |
| `R5` | 供电能力不足 | 冲突 | 按峰值电流汇总 5V / 3.3V 轨负载与可用供电比较；余量 <25% 降级为提醒 |
| `R6` | 算力档位不足 | 冲突 | 取外设最高算力档（基础 / 进阶 / AI）与主控档位比较 |
| `R7` | 缺少必需的总线协议 | 冲突 | 校验 WiFi / BLE / CAN 能力 |
| `R8` | 缺少驱动板或外接电源 | 提醒 | 含执行器但无驱动板告警；所需电源轨无足够电压的电源时告警 |

难度评分与工时估算：难度基准 1 分，模块种类 >2 类 +1、>6 类 +1，含驱动板 +1，含焊接/定制 PCB +1，含 12V 走线 +1，含 AI 档模块 +1，上限 5 分。工时 = 0.5h 基础 + 每类 0.28h + 驱动板 0.6h + 焊接 1.6h。

---

## 选型热度模块

> **数据性质声明**：本模块为演示数据。热度指数由「平台需求分布基线」与「本机真实选型行为」加权合成，用于验证排序、筛选与图表链路，**不代表真实市场数据**。

```
热度 = clamp(基线需求指数 × 0.7 + 本机选型加权 × 0.3, 0, 100)
```

- `d30` 由 `d7` 与 `delta` 反推得出（`d30 = d7 / (1 + delta)`），三者从构造上不可能互相矛盾
- 埋点 `Heat.record(type, id)` 记录 **浏览 / 加购 / 下单** 三类事件，权重 1 / 5 / 20
- 无本机数据时自动回退为纯基线，不产生偏差
- 涨跌配色遵循中国市场惯例：**涨为红、跌为绿**

**替换为真实数据**：把 `Heat.record` 改为上报服务端，热度列表改为请求 `/api/heat?range=7d` 返回，渲染逻辑无需改动（服务端示例见 `api/orders/index.js`）。

---

## 下单 · 付款 · 后台流程

```
结算填单 → 创建订单（pending）→ 扫码支付 → 服务端回调验签 → 置为已付款（paid）
        → 后台确认收款 → 备货中（picking）→ 录入快递单号发货（shipped）
        → 用户确认收货 → 已完成（done）
```

| 状态 | 名称 | 可执行动作 |
|---|---|---|
| `pending` | 待付款 | 确认收款 / 取消订单 |
| `paid` | 已付款 | 开始备货 / 退款 |
| `picking` | 备货中 | 发货（必填快递单号）/ 退款 |
| `shipped` | 已发货 | 标记完成 |
| `done` / `cancelled` / `refunded` | 终态 | 无 |

退款会自动回滚库存；支付落库时原子扣减库存；前台与后台共享同一份订单数据，下单后后台立即可见。

> **演示环境说明**：订单存于浏览器 `localStorage`（键名 `mosaic.orders.v1`），支付通过「模拟回调」完成，不产生真实资金往来。生产环境只需把 `Store` 的读写替换为服务端接口调用。

---

## 支付接入（已预留）

支付能力按「前端只负责渲染与轮询、签名与验签全部在服务端」的原则预留。项目内置可直接部署的 Serverless 示例：

```
api/
├── _lib/wechat.js         V3 请求签名、AES-256-GCM 回调解密、回调验签
├── _lib/alipay.js         RSA2 签名、回调验签、当面付预下单
├── _lib/store.js          订单与埋点存储适配层（演示为进程内存）
├── pay/wechat/create.js   POST /v3/pay/transactions/native → code_url
├── pay/wechat/notify.js   验签 → 解密 → 金额校验 → 幂等 → 置为已付款
├── pay/alipay/create.js   alipay.trade.precreate → qr_code
├── pay/alipay/notify.js   notify_url 验签（RSA2）→ 置为已付款
└── orders/index.js        订单创建 / 状态查询 / 后台流转 / 热度埋点
```

**需要配置的环境变量**（严禁写入前端代码）：

```
WXPAY_APPID  WXPAY_MCHID  WXPAY_SERIAL  WXPAY_PRIVATE_KEY  WXPAY_APIV3_KEY
WXPAY_NOTIFY_URL  WXPAY_PLATFORM_PUBLIC_KEY
ALIPAY_APPID  ALIPAY_PRIVATE_KEY  ALIPAY_PUBLIC_KEY  ALIPAY_GATEWAY  ALIPAY_NOTIFY_URL
```

**前端只需改两处**（都在 `assets/js/core.js` 的 `Pay` 对象内）：把 `Pay.create` 改为请求 `/api/pay/{channel}/create`，把 `Pay.query` 改为请求 `/api/orders/{id}/status`。

> **安全红线**：商户私钥、APIv3 密钥、支付宝应用私钥只能存放在服务端环境变量中；回调接口必须验签并校验金额，防止伪造通知。示例代码在凭据缺失时采取 **fail-closed** 策略（拒绝而非放行）。

---

## 微信小程序版本

`miniprogram/` 是同一套业务逻辑的原生小程序实现，为「与AI共生」微信小程序大赛交付，也是网页版在移动端的落地形态。

| 项目 | 说明 |
|---|---|
| 页面 | 8 个：首页 / 模块库 / 模块详情 / 选型工作台 / 方案汇总 / 结算 / 订单 / 我的 |
| 数据 | 86 个模块、8 大分类、订单状态机，全部由 `assets/js/data.js` 自动生成，字段与网页版逐项一致 |
| 校验 | 与网页版同一套 9 条规则；24 个场景逐一比对，结论完全一致 |
| 存储 | 方案草稿、订单、库存、埋点、结算表单全部落在 `wx.storage`，无后端依赖 |
| 定位 | 纯前端演示工具：**无 `wx.request`、无 `wx.requestPayment`**，价格与库存为静态示例数据 |
| 体积 | 218 KB（主包上限 2048 KB） |

### 本地校验

```bash
node tools/check-miniprogram.js
```

覆盖三类检查，共 **61 项**：

- **工程静态完整性**：页面四件套齐全、11 个 JSON 可解析、13 个 JS 语法正确、80 处 WXML 事件绑定均能在 JS 中找到、无真实支付与网络调用、包体积在限内
- **数据层一致性**：模块总数 / 主控数 / 分类数 / ID 集合 / 每个模块的 name、cat、price、stock、req、caps 与网页版逐项比对
- **引擎一致性**：24 个场景（覆盖 R0–R8 全部 9 条规则）同时跑小程序 `compat.js` 与网页版 `core.js`，比对 verdict、错误数、提醒数、总价、难度、工时、规则集合、资源占用

### 导入方式

1. 微信开发者工具 → 导入项目 → 选择 `miniprogram/` 目录
2. AppID 填自己的小程序 AppID（未注册可先用测试号）
3. 完整注册、类目选择、审核发布流程见 [小程序注册与发布指引.md](./小程序注册与发布指引.md)

---

## 部署

站点为纯静态产物，所有资源路径均为相对路径，可直接托管在任意静态服务上。

| 平台 | 配置方式 | 已提供文件 |
|---|---|---|
| **GitHub Pages** | Settings → Pages → Source 选 GitHub Actions，推送 `main` 即自动发布 | `.github/workflows/deploy-pages.yml`、`.nojekyll` |
| **Vercel** | 导入仓库后零配置识别为静态站点；`api/` 自动转为 Serverless Functions | `vercel.json` |
| **Cloudflare Pages** | 连接仓库，Build command 留空，Output directory 填 `/` | `_headers`、`_redirects` |

详见 [DEPLOY.md](./DEPLOY.md)。

---

## 响应式设计要求

| 断点 | 目标环境 | 主要变化 |
|---|---|---|
| ≥ 1280px | 桌面宽屏 | 工作台三栏（290 / 自适应 / 350）；模块网格 4 列 |
| 1080–1280px | 小笔记本 | 三栏收窄为 250 / 自适应 / 320；网格 3 列 |
| 860–1080px | 平板横屏 | 工作台改顶部三页签；详情页双栏改单栏；热度区改单列 |
| 620–860px | 平板竖屏 | 导航折叠为汉堡菜单；表单双列改单列；网格 2 列 |
| < 620px | 手机 | 网格 1 列并隐藏简介；步骤条只留圆点；统计卡单列；弹层 94vw |

强制要求：触控目标 ≥ 40×40px；表格统一包裹在可横向滚动容器中、**页面本身不产生横向滚动**；移动端解除粘性定位；SVG 全部 `viewBox` 自适应；遵循 `prefers-reduced-motion`；打印时隐藏导航与操作按钮。

---

## 已验证项

本项目在 headless Chromium 中完成自动化验证：

- **页面冒烟测试 30/30**：10 个页面 + 4 个参数化路由的渲染、关键 DOM 断言、控制台零错误
- **端到端交易链路**：下单 → 支付 → 状态流转 → 库存扣减 → 前台同步，全链路断言通过
- **UI 交互链路 21/21**：真实点击/输入事件驱动加购、工作台调整、表单校验拦截、提交下单、渠道切换、模拟回调、后台登录与发货
- **响应式审计 42/42**：10 个页面 × 4 个断点均无横向溢出，窄屏导航折叠与工作台页签切换正常
- **小程序静态校验 61/61**：工程完整性 + 数据层一致性 + 24 个场景的引擎一致性
- **小程序运行时模拟 18/18**：8 个页面的生命周期与 80+ 次交互在模拟宿主中真实执行，无异常
- **网页冒烟 11/11**：本地静态服务 + headless Chromium 逐页加载，控制台零错误、无横向溢出

复跑全部检查：

```bash
npm run check:all
```

---

## 后续迭代建议

- **真实后端**：引入云数据库与用户认证，把方案、订单、库存迁到服务端；订单创建与库存扣减放进同一事务
- **引脚级自动分配**：在总线数量校验之上做具体引脚编号的自动分配与冲突消解，输出接线表
- **固件模板**：按方案组合自动生成 PlatformIO / Arduino 工程骨架与驱动初始化代码，随单交付
- **3D 装配预览**：基于模块尺寸与接口朝向生成爆炸图，下单前预览物理干涉
- **供应链对接**：接入元器件库存与价格接口，实现缺货自动替代与实时报价
- **BOM 版本管理**：方案支持多版本对比与变更记录

---

## 许可

MIT
