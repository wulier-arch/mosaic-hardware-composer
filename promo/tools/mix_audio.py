#!/usr/bin/env python3
"""
BGM 混音 + 音效设计

前置：先跑 ./decode bgm-source.mp3 bgm.wav 把 BGM 解码成 44100Hz 立体声 WAV
输出：final_mix.wav（30 秒，含音效与音量自动化）
------------------------------------------------------------------
· 从 Kevin MacLeod "Long Time Coming"（CC BY 4.0）的 3.99s 处截取 30s
· 该曲 120BPM，拍点 = 3.99 + k×0.5s；截取后视频第 12.00 秒（第 24 拍）
  正好落在其能量爆发点（drop），因此把「选型工作台」场景放在那一刻
· 程序化合成卡点音效：riser、drop impact、规则 tick、加购 blip、成功铃音
· 对前 12 秒做音量自动化（提升约 +4.8dB），缩小动态差，让卡点更紧
"""
import wave, array, math, random, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

SR = 44100
DUR = 30.0
START = 3.99          # 从 BGM 的第 3.99 秒开始截取（= 第 7 拍，使视频拍点与音乐拍点整数对齐）
DROP = 12.0
N = int(SR * DUR)

random.seed(20261013)

# ---------- 读取 BGM ----------
w = wave.open('bgm.wav', 'rb')
assert w.getframerate() == SR and w.getnchannels() == 2
raw = w.readframes(w.getnframes())
w.close()
src = array.array('h'); src.frombytes(raw)
off = int(START * SR) * 2
L = [0.0] * N
R = [0.0] * N
for i in range(N):
    j = off + i * 2
    L[i] = src[j] / 32768.0
    R[i] = src[j + 1] / 32768.0
print(f'BGM 截取 {START}s → {START+DUR}s')

# ---------- 音量自动化：把安静的前段抬起来 ----------
for i in range(N):
    t = i / SR
    if t <= 11.2:
        g = 1.78
    elif t < DROP:
        g = 1.78 + (1.0 - 1.78) * (t - 11.2) / (DROP - 11.2)
    else:
        g = 1.0
    L[i] *= g; R[i] *= g

# ---------- 单极低通（用于噪声塑形） ----------
def lowpass(buf, cutoff):
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = 0.0
    out = [0.0] * len(buf)
    for i, x in enumerate(buf):
        y = (1 - a) * x + a * y
        out[i] = y
    return out

# ---------- 音效渲染 ----------
sfxL = [0.0] * N
sfxR = [0.0] * N

def add(buf, start, samples, gain=1.0, pan=0.0):
    """把一段单声道样本混入（pan: -1 左 / +1 右）"""
    s0 = int(start * SR)
    gl = gain * (1 - max(0.0, pan)) * 0.5 + gain * 0.5 * (1 - abs(pan)) * 0 + gain * (0.5 - pan * 0.5)
    gr = gain * (0.5 + pan * 0.5)
    for k, v in enumerate(samples):
        i = s0 + k
        if 0 <= i < N:
            buf_L[i] += v * gl
            buf_R[i] += v * gr

buf_L, buf_R = sfxL, sfxR

# 1) Riser：9.45s → 12.0s，噪声 + 上升正弦扫频
rs_len = int(2.55 * SR)
noise = [random.uniform(-1, 1) for _ in range(rs_len)]
noise = lowpass(noise, 5200)
riser = []
ph = 0.0
for k in range(rs_len):
    p = k / rs_len
    env = p ** 2.35
    f = 190 * math.exp(math.log(8.4) * p)      # 190Hz → 1600Hz 指数上升
    ph += 2 * math.pi * f / SR
    tone = math.sin(ph) * 0.55
    air = noise[k] * (0.30 + 0.55 * p)
    trem = 1.0 + 0.30 * math.sin(2 * math.pi * (3 + 22 * p) * k / SR)
    riser.append((tone + air) * env * trem * 0.62)
add(buf_L, 9.45, riser, gain=0.50, pan=-0.18)
add(buf_R, 9.45, riser, gain=0.50, pan=0.18)

# 2) Drop impact：12.0s，次低频下坠 + 瞬态 + 低频轰鸣
imp_len = int(1.5 * SR)
imp = []
ph2 = 0.0
rum = lowpass([random.uniform(-1, 1) for _ in range(imp_len)], 220)
for k in range(imp_len):
    t = k / SR
    f = 46 + 118 * math.exp(-t / 0.055)          # 164Hz → 46Hz 下坠
    ph2 += 2 * math.pi * f / SR
    sub = math.sin(ph2) * math.exp(-t / 0.42) * 0.95
    click = (random.uniform(-1, 1)) * math.exp(-t / 0.012) * 0.55
    body = rum[k] * math.exp(-t / 0.55) * 0.85
    imp.append(sub + click + body)
add(buf_L, DROP, imp, gain=0.92, pan=0.0)

# 3) 次级 impact：场景切换点
def soft_impact(dur=0.85, f0=70, decay=0.30):
    n = int(dur * SR)
    out = []
    p = 0.0
    for k in range(n):
        t = k / SR
        p += 2 * math.pi * (f0 * (1 + 1.1 * math.exp(-t / 0.03))) / SR
        out.append(math.sin(p) * math.exp(-t / decay) * 0.8
                   + random.uniform(-1, 1) * math.exp(-t / 0.008) * 0.35)
    return out

for at, g in [(2.02, 0.34), (6.02, 0.34), (17.02, 0.42), (21.02, 0.42), (25.02, 0.44), (28.02, 0.40)]:
    add(buf_L, at, soft_impact(), gain=g, pan=0.0)

# 4) 规则 tick：17.0s 起每 0.5s 一次，共 9 次
tick_n = int(0.09 * SR)
tick = [math.sin(2 * math.pi * 2340 * k / SR) * math.exp(-k / SR / 0.016) * 0.5
        + random.uniform(-1, 1) * math.exp(-k / SR / 0.004) * 0.25 for k in range(tick_n)]
for i in range(9):
    add(buf_L, 17.0 + i * 0.5, tick, gain=0.16, pan=-0.35 + i * 0.088)

# 5) 加购 blip：模块卡落位处（12.42 + i×0.72）
blip_n = int(0.13 * SR)
blip = []
p = 0.0
for k in range(blip_n):
    t = k / SR
    p += 2 * math.pi * (1320 + 520 * math.exp(-t / 0.03)) / SR
    blip.append(math.sin(p) * math.exp(-t / 0.045) * 0.55)
for i in range(6):
    add(buf_L, 12.42 + i * 0.72, blip, gain=0.20, pan=-0.55 + i * 0.22)

# 6) 支付成功铃音：23.85s（两音上行）
bell_n = int(1.5 * SR)
bell = []
for k in range(bell_n):
    t = k / SR
    a = math.sin(2 * math.pi * 880 * t) * math.exp(-t / 0.55)
    b = math.sin(2 * math.pi * 1318.5 * t) * math.exp(-max(0.0, t - 0.13) / 0.50) if t > 0.13 else 0.0
    c = math.sin(2 * math.pi * 1760 * t) * math.exp(-max(0.0, t - 0.26) / 0.42) if t > 0.26 else 0.0
    bell.append((a * 0.5 + b * 0.42 + c * 0.30) * 0.62)
add(buf_L, 23.85, bell, gain=0.46, pan=0.10)
add(buf_R, 23.85, bell, gain=0.46, pan=-0.10)

# 7) 开场 logo 音：1.62s（马赛克汇聚完成）
logo_n = int(0.9 * SR)
logo = []
p = 0.0
for k in range(logo_n):
    t = k / SR
    p += 2 * math.pi * 523.25 / SR
    s = math.sin(p) * math.exp(-t / 0.28) * 0.42
    s += math.sin(2 * p) * math.exp(-t / 0.20) * 0.20
    logo.append(s)
add(buf_L, 1.62, logo, gain=0.34, pan=-0.12)
add(buf_R, 1.62, logo, gain=0.34, pan=0.12)

# ---------- 混合 ----------
mixL = [L[i] + buf_L[i] for i in range(N)]
mixR = [R[i] + buf_R[i] for i in range(N)]

# 软限幅（避免削波失真）
def soft_clip(x):
    return math.tanh(x * 1.02) * 0.985

peak = max(max(abs(v) for v in mixL), max(abs(v) for v in mixR)) or 1.0
drive = 1.30 / peak          # 略微推入软限幅器，提升整体响度
print(f'混合前峰值 {peak:.3f}，限幅驱动 {drive:.3f}')

# 先软限幅，再归一化到 -0.4dBFS（避免限幅把峰值压得偏低）
clipL = [soft_clip(v * drive) for v in mixL]
clipR = [soft_clip(v * drive) for v in mixR]
peak2 = max(max(abs(v) for v in clipL), max(abs(v) for v in clipR)) or 1.0
norm = 0.955 / peak2
print(f'限幅后峰值 {peak2:.3f}，归一化系数 {norm:.3f}')

fade_in = 0.18
fade_out = 1.55
out = array.array('h')
for i in range(N):
    t = i / SR
    g = 1.0
    if t < fade_in:
        g *= t / fade_in
    if t > DUR - fade_out:
        g *= max(0.0, (DUR - t) / fade_out) ** 1.25
    l = clipL[i] * norm * g
    r = clipR[i] * norm * g
    out.append(int(max(-32767, min(32767, l * 32767))))
    out.append(int(max(-32767, min(32767, r * 32767))))

wf = wave.open('final_mix.wav', 'wb')
wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
wf.writeframes(out.tobytes()); wf.close()

pk = max(abs(v) for v in out) / 32768.0
rms = math.sqrt(sum(v * v for v in out) / len(out)) / 32768.0
print(f'输出 final_mix.wav  {N/SR:.2f}s  峰值 {pk:.3f} ({20*math.log10(pk):.1f} dBFS)  有效值 {rms:.4f} ({20*math.log10(rms):.1f} dBFS)')
