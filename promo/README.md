# MOSAIC 拼造 · 30 秒演示片 + 封面

> 两条片子、四张封面。全部画面来自 MOSAIC 平台真实界面，按 120 BPM 卡点剪辑。

| 文件 | 规格 | 说明 |
|---|---|---|
| `MOSAIC-live-30s.mp4` | 1920×1080 · 30fps · 30.00s · H.264 14.3Mbps + AAC 192k | **实拍录屏版** —— 真实浏览器操作，一镜到底录下来的 |
| `MOSAIC-promo-30s.mp4` | 1920×1080 · 30fps · 30.00s · H.264 13.5Mbps + AAC 192k | **3D 动效版** —— 界面截图放进 3D 透视舞台做动效包装 |

---

## 一、两条片子怎么选

| | 实拍录屏版 | 3D 动效版 |
|---|---|---|
| **画面来源** | CDP screencast 录下的真实浏览器操作（含真实光标、真实状态变化） | 14 张高分辨率页面截图 + CSS 3D 动效 |
| **可信度** | 高 —— 能看到真实的点击、真实的校验实时刷新 | 中 —— 内容是真实的，但动作是演绎的 |
| **视觉冲击** | 中 —— 克制的录制 HUD + 动感标题 | 高 —— 马赛克汇聚、模块卡吸附、规则环绕、冲击波 |
| **适合场景** | 官网首屏、技术评审、销售演示 | 社媒投放、展会循环、开场吸引眼球 |

两条片子共用同一套 120 BPM 时间线，可以互相替换或前后拼接。

---

## 二、卡点结构（两条片通用）

音乐 **120 BPM**，每拍 0.5s，全片正好 60 拍。BGM 从原曲 **第 3.99 秒**截取，使得**视频第 12.00 秒（第 24 拍）精确落在该曲的能量爆发点（drop）**——那一拍正是全片最核心的「选型工作台」场景。

| 视频 | 拍号 | 场景 | 音频 |
|---|---|---|---|
| 0.00 – 2.00 | 0–4 | 开场（标志 / 首页 Hero 推近） | 轻 logo 音 |
| 2.00 – 6.00 | 4–12 | 首页：分类浏览 → 选型热度（切换 7日/30日） | 安静段 |
| 6.00 – 9.50 | 12–19 | 模块库：分类筛选 → 搜索 → 切换视图 → 加购 | 安静段 |
| 9.50 – 12.00 | 19–24 | 工作台：选定主控 | 上升 ▁▂▃▄ |
| **12.00** | **24** | **DROP** —— 工作台逐个装配模块，校验实时刷新 | **全片峰值 ▇** |
| 12.00 – 17.00 | 24–34 | 模块卡逐拍落位；第 30 拍切到「校验全部通过」 | 强 |
| 17.00 – 20.00 | 34–40 | 制造算力冲突 → 替换主控解决 | 强 |
| 20.00 – 23.00 | 40–46 | 结算：收货信息、发票、运费 | 强 |
| 23.00 – 25.50 | 46–51 | 支付：切换渠道 → 二维码 → 支付成功 | 成功铃音 |
| 25.50 – 29.00 | 51–58 | 后台：确认收款 → 备货 → 发货 → 库存 | 强 |
| 29.00 – 30.00 | 58–60 | 收尾 + BGM 署名 | 淡出 |

**所有段落边界都落在拍点上**（0.5s 的整数倍）。音频实测能量：

```
|▃▂▂▃|▂▁▁▁|▄▂▂▂|▂▁▁▁|▃▁▂▁|▁▂▃▄|▇▃▂▁|▃▂▂▃|▃▃▃▂|▃▂▂▃|▃▃▃▂|▃▃▂▄|▄▃▃▂|▃▃▂▃|▄▂▁▁
 0s           ↑拍19-23 爬升   ↑拍24 DROP            15s            30s
```

---

## 三、封面

| 文件 | 尺寸 | 适用 |
|---|---|---|
| `cover/cover-16x9-1920.png` | 1920×1080 | B 站 / YouTube / 官网 / 微信分享 |
| `cover/cover-16x9-1280.png` | 1280×720 | 轻量版，加载更快 |
| `cover/cover-3x4-1080.png` | 1080×1440 | 小红书 / 朋友圈 |
| `cover/cover-9x16-1080.png` | 1080×1920 | 抖音 / 视频号 / 快手 |

封面不是另画一张图，而是**用与网站、视频同一套设计令牌渲染出来的**：暖白纸感与紫罗兰主色、Archivo / Instrument Serif / Geist Mono 字体、真实的工作台与支付页界面。因此封面与片子的观感完全一致。

改文案或换尺寸只需编辑 `cover/index.html`，用 hash 指定尺寸即可：

```
cover/index.html#1920x1080     横版
cover/index.html#1080x1440     3:4 竖版
cover/index.html#1080x1920     9:16 竖版
```

重新导出：

```bash
cd promo/tools && node shoot-cover.mjs
```

---

## 四、BGM 来源与版权

| 项目 | 内容 |
|---|---|
| 曲目 | **Long Time Coming** — Kevin MacLeod |
| 来源 | <https://incompetech.com> （免版权音乐库，含机器可读目录） |
| 授权 | **Creative Commons Attribution 4.0 (CC BY 4.0)** |
| 要求 | 使用时**必须署名**。两条片子片尾已固定展示署名行，二次剪辑请勿删除 |
| 商用 | CC BY 4.0 允许商用，署名即可；如需免除署名可在 incompetech 购买付费授权 |

**选曲方法**：从 incompetech 的 `pieces.json`（1443 首，含 BPM 元数据）中筛选 **Electronica 流派且 BPM 整除 1800** 的曲目——这样每拍正好 15 帧，30 秒内不会有累积漂移。得到 30 首候选后再做能量包络分析，选出具有清晰「前段安静 → 中段 drop」结构的一首，使音乐结构与视频叙事天然吻合。

---

## 五、制作流程

### 实拍录屏版

```
录制真实操作          按拍点剪辑            3D 包装合成              编码 + 混音
────────────  →  ──────────────  →  ───────────────────  →  ──────────────
record.mjs        assemble.mjs       compose-live/index.html     encode/aac/mux
CDP screencast    900 帧基础画面     单一 render(T) 驱动           H.264 + AAC
7 段 take         段落边界对齐拍点    标题/浮标/指标/录制 HUD
```

**录制要点**：用 CDP `Page.startScreencast` 录真实浏览器操作，并注入模拟光标与点击涟漪。踩过两个坑：

1. **页面静止时合成器不出帧**，screencast 会掉到 0.5fps。实测 CSS 动画（仅合成器）无效，必须用 `requestAnimationFrame` 每帧改**真实样式**才能稳定 59.8fps。
2. **种子数据必须在页面脚本之前注入**。若先 `navigate` 再写 `localStorage`，页面已经读完数据，支付页会显示「未找到订单」、后台会停在登录门。改用 `Page.addScriptToEvaluateOnNewDocument` 后才正确。

### 3D 动效版

```
抓站点画面            3D 合成页            逐帧渲染           编码 + 混音
────────────  →  ─────────────────  →  ───────────  →  ──────────────
capture-site.mjs   compose/index.html    render.mjs        encode / aac / mux
14 张页面长图       单一 render(T) 驱动   900 帧 @30fps     H.264 + AAC
```

关键设计：**不使用任何 CSS 动画，全部视觉由单一 `render(T)` 函数计算**。页面暴露 `window.seek(frame)`，给定帧号即可确定性地渲染出该帧的全部样式——这是逐帧渲染不抖动的根本保证。

### 音频（两条片共用）

`tools/mix_audio.py`：从 BGM 第 3.99 秒截取 30 秒 → 前 12 秒做 +4.8dB 音量自动化（压缩动态差让卡点更紧）→ 叠加程序化合成音效（riser、drop impact、规则 tick、加购 blip、支付成功铃音、开场 logo 音）→ 软限幅归一化到 −0.4 dBFS。

### 编码

本机**没有完整 ffmpeg**（系统只有 Playwright 附带的裁剪版，连 H.264 编码器都没有），因此用 **Swift + AVFoundation 原生编码**，零网络依赖：

| 程序 | 作用 |
|---|---|
| `decode.swift` | BGM 解码为 44100Hz 立体声 WAV |
| `encode.swift` | JPEG 帧序列 → H.264 视频轨（15 Mbps，High Profile） |
| `aac.swift` | WAV → AAC 音频轨（192 kbps） |
| `mux.swift` | `AVAssetExportPresetPassthrough` 无损封装（**视频不重编码**） |
| `probe.swift` | 媒体探针，核验分辨率 / 帧率 / 码率 / 轨道 |

> 音频轨单独编码再封装，是为了绕开 AVAssetWriter 同时写双轨时的死锁。
> 用 passthrough 而非 `AVAssetExportPreset1920x1080`，是因为后者会把视频重压到 9.6 Mbps 损失画质。

---

## 六、重新渲染

```bash
cd promo/tools

# 0) 编译原生工具（只需一次）
for f in decode encode aac mux probe; do swiftc -O $f.swift -o $f; done

# 1) 音频：解码 → 混音（含音效与音量自动化）
./decode bgm-source.mp3 bgm.wav
python3 mix_audio.py

# 2) 3D 动效版
node render.mjs                 # → ../MOSAIC-promo-30s.mp4
node preview.mjs 360 540 720    # 只预览若干帧

# 3) 实拍录屏版（需先启动站点：在项目根目录 python3 -m http.server 8123）
node record.mjs                 # 录制 7 段真实操作
node assemble.mjs               # 按拍点剪辑成 900 帧基础画面
node render-live.mjs            # → ../MOSAIC-live-30s.mp4

# 4) 封面
node shoot-cover.mjs            # → ../cover/*.png
```

依赖：**macOS + Swift 6（Xcode Command Line Tools）、Node 18+、Python 3**。
不需要 ffmpeg、不需要 `npm install`；站点截图与 BGM 已随包提供。

> 路径说明：`preview.mjs` / `render.mjs` / `capture-site.mjs` / `mix_audio.py` / `shoot-cover.mjs` 均按**自身文件位置**解析路径，可随目录整体移动。
> `record.mjs` / `assemble.mjs` / `render-live.mjs` 目前使用绝对路径 `/tmp/mosaic-video/`，移动到别处需相应调整。

---

## 七、目录

```
promo/
├── MOSAIC-live-30s.mp4       实拍录屏版成片
├── MOSAIC-promo-30s.mp4      3D 动效版成片
├── README.md                 本文档
├── timeline.json             实拍版剪辑时间线（逐帧映射表）
├── cover/
│   ├── index.html            封面模板（hash 指定尺寸）
│   └── cover-*.png           4 种尺寸封面
├── compose/                  3D 动效版合成页 + 14 张站点截图素材
├── compose-live/index.html   实拍版合成页（叠加标题 / 浮标 / 指标 / 录制 HUD）
└── tools/
    ├── capture-site.mjs      抓取站点页面长图
    ├── record.mjs            CDP screencast 录制真实操作
    ├── assemble.mjs          按拍点剪辑成基础帧
    ├── preview.mjs           预览 3D 版指定帧
    ├── preview-live.mjs      预览实拍版指定帧
    ├── render.mjs            3D 版全量渲染 + 编码 + 封装
    ├── render-live.mjs       实拍版全量渲染 + 编码 + 封装
    ├── shoot-cover.mjs       导出 4 种尺寸封面
    ├── mix_audio.py          BGM 截取、音量自动化、音效合成与混音
    ├── bgm-source.mp3        BGM 源文件（CC BY 4.0）
    ├── decode.swift          BGM 解码为 WAV
    ├── encode.swift          H.264 视频编码
    ├── aac.swift             AAC 音频编码
    ├── mux.swift             无损封装
    └── probe.swift           媒体探针
```

---

## 八、已知取舍

- **BGM 为 CC BY 4.0 授权曲目，必须保留片尾署名。** 若要换成自有或更「热门」的音乐，把音频放进 `tools/` 改 `mix_audio.py` 里的 `START`（对齐到节拍）即可，其余流程不变。
- 实拍版为压缩到 30 秒，各段做了 0.9×–2.4× 变速；后台段落 2.4× 偏快，如需更从容可延长总时长或裁掉结算段。
- 3D 版使用 CSS 3D 变换而非 WebGL，足以支撑当前构图；若要做真实材质与光照需换 Three.js。
- 录制分辨率为 1920×1080，如需 4K 可在 `record.mjs` 里把设备度量与 screencast 的 `maxWidth/maxHeight` 提到 3840×2160（数据量约 4 倍）。
