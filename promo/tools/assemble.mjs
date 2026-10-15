/**
 * 按卡点剪辑：把各段实拍素材映射到 30 秒时间线的 900 帧
 * ---------------------------------------------------------------
 * 音乐 120BPM，每拍 0.5s；第 24 拍（12.00s）是 drop。
 * 剪辑原则：段落边界全部落在拍点上，源素材通过时间重映射做变速，
 *           保证实拍画面的动作与音乐节拍对齐。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TAKES = resolve(ROOT, 'takes');
const BASE = resolve(ROOT, 'base');

const FPS = 30, TOTAL = 900, BEAT = 0.5, DROP = 12.0;

/* ------------------------------------------------------------------
   时间线：每段都对齐到拍点
   拍号 = 视频时间 / 0.5
   ------------------------------------------------------------------ */
const SEGMENTS = [
  // 所有段落边界都对齐到拍点（0.5s 的整数倍），保证卡点准确
  { a: 0.00,  b: 2.00,  take: 'home',     s: 0.55, e: 2.35, label: '开场 · 首页 Hero',   zoom: [1.06, 1.15] },
  { a: 2.00,  b: 6.00,  take: 'home',     s: 1.05, e: 5.95, label: '首页 · 分类与热度', zoom: [1.14, 1.0] },
  { a: 6.00,  b: 9.50,  take: 'catalog',  s: 0.40, e: 5.40, label: '模块库 · 筛选加购', zoom: [1.0, 1.06] },
  { a: 9.50,  b: 12.00, take: 'builder',  s: 0.55, e: 3.05, label: '工作台 · 选定主控', zoom: [1.06, 1.0] },
  // ---- 第 24 拍（12.00s）：DROP ----
  { a: 12.00, b: 17.00, take: 'builder',  s: 3.05, e: 9.90, label: '工作台 · 逐个装配', zoom: [1.0, 1.07] },
  { a: 17.00, b: 20.00, take: 'conflict', s: 1.40, e: 6.40, label: '校验 · 冲突与解决', zoom: [1.06, 1.0] },
  { a: 20.00, b: 23.00, take: 'checkout', s: 0.50, e: 4.90, label: '结算 · 收货与发票', zoom: [1.0, 1.06] },
  { a: 23.00, b: 25.50, take: 'pay',      s: 0.60, e: 5.60, label: '支付 · 扫码与回调', zoom: [1.06, 1.0] },
  { a: 25.50, b: 29.00, take: 'admin',    s: 0.60, e: 9.10, label: '后台 · 流转与发货', zoom: [1.0, 1.06] },
  { a: 29.00, b: 30.00, take: 'home',     s: 0.10, e: 0.40, label: '收尾',              zoom: [1.12, 1.16] },
];

/* ---------- 载入各 take 的帧时间戳 ---------- */
const T = {};
for (const name of ['home', 'catalog', 'builder', 'conflict', 'checkout', 'pay', 'admin']) {
  const meta = JSON.parse(readFileSync(resolve(TAKES, name, 'meta.json'), 'utf8'));
  const t0 = meta.frames[0].ts;
  T[name] = { dir: resolve(TAKES, name), ts: meta.frames.map(f => f.ts - t0), count: meta.frames.length };
}

function pick(name, t) {
  const arr = T[name].ts;
  if (t <= arr[0]) return 0;
  if (t >= arr[arr.length - 1]) return arr.length - 1;
  let lo = 0, hi = arr.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= t) lo = m; else hi = m; }
  return (t - arr[lo]) <= (arr[hi] - t) ? lo : hi;
}

/* ---------- 生成 900 帧 ---------- */
rmSync(BASE, { recursive: true, force: true });
mkdirSync(BASE, { recursive: true });

const map = [];
let dupCount = 0;
for (let f = 0; f < TOTAL; f++) {
  const t = f / FPS;
  let seg = SEGMENTS.find(s => t >= s.a && t < s.b);
  if (!seg) seg = SEGMENTS[SEGMENTS.length - 1];
  const local = Math.min(1, Math.max(0, (t - seg.a) / (seg.b - seg.a)));
  const srcT = seg.s + local * (seg.e - seg.s);
  const idx = pick(seg.take, srcT);
  const src = resolve(T[seg.take].dir, `f${String(idx).padStart(4, '0')}.jpg`);
  const dst = resolve(BASE, `f${String(f).padStart(4, '0')}.jpg`);
  if (!existsSync(src)) { console.error('缺帧:', src); process.exit(1); }
  copyFileSync(src, dst);
  const zoom = seg.zoom ? seg.zoom[0] + (seg.zoom[1] - seg.zoom[0]) * local : 1;
  map.push({ f, t: +t.toFixed(3), seg: seg.label, take: seg.take, srcIdx: idx, srcT: +srcT.toFixed(3), zoom: +zoom.toFixed(4) });
  if (f > 0 && map[f - 1].srcIdx === idx && map[f - 1].take === seg.take) dupCount++;
}

writeFileSync(resolve(ROOT, 'timeline.json'), JSON.stringify({
  fps: FPS, total: TOTAL, beat: BEAT, drop: DROP,
  segments: SEGMENTS.map(s => ({ ...s, dur: +(s.b - s.a).toFixed(2), speed: +((s.e - s.s) / (s.b - s.a)).toFixed(3) })),
  frames: map,
}, null, 2));

console.log('=== 卡点剪辑时间线 ===');
console.log('视频区间      时长   拍号     素材        源区间        速度    说明');
SEGMENTS.forEach(s => {
  const speed = (s.e - s.s) / (s.b - s.a);
  const beatA = Math.round(s.a / BEAT), beatB = Math.round(s.b / BEAT);
  console.log(
    `${s.a.toFixed(2).padStart(5)}–${s.b.toFixed(2).padEnd(6)} ` +
    `${(s.b - s.a).toFixed(1).padStart(4)}s  ` +
    `${String(beatA).padStart(2)}–${String(beatB).padStart(2)}   ` +
    `${s.take.padEnd(10)} ${s.s.toFixed(2)}–${s.e.toFixed(2)}  ` +
    `${speed.toFixed(2)}x   ${s.label}`
  );
});
const drops = SEGMENTS.filter(s => Math.abs(s.a - DROP) < 0.01);
console.log(`\nDROP 落在视频第 ${DROP}s（第 ${Math.round(DROP / BEAT)} 拍），对应段落：${drops[0] ? drops[0].label : '—'}`);
console.log(`\n输出 ${TOTAL} 帧 → ${BASE}`);
console.log(`其中与上一帧重复 ${dupCount} 帧（占 ${(dupCount / TOTAL * 100).toFixed(1)}%，源素材静止段落的正常现象）`);
