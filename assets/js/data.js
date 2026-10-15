/* =============================================================
   MOSAIC · 硬件定制平台 — 数据层
   -------------------------------------------------------------
   本文件是平台唯一的数据源（无构建步骤，直接以 <script> 引入）。
   真实生产环境可把 MODULES 换成 fetch('/api/modules') 的返回结果，
   字段结构保持不变即可，前端渲染与校验引擎无需改动。
   ============================================================= */

/* ---------- 分类 ---------- */
const CATEGORIES = [
  { id: 'board',    name: '主控开发板', en: 'Controllers',  icon: 'chip',    desc: '方案的大脑。决定算力上限、可用总线与逻辑电平，是整个组合的兼容性基准。' },
  { id: 'sensor',   name: '传感器',     en: 'Sensors',      icon: 'wave',    desc: '把物理世界变成数据。温湿度、姿态、距离、气体、光学与生物信号采集。' },
  { id: 'actuator', name: '电机与执行器', en: 'Actuators',  icon: 'gear',    desc: '让方案动起来。舵机、步进、无刷、推杆与继电器，通常需要驱动板与外接电源。' },
  { id: 'power',    name: '电源与电池', en: 'Power',        icon: 'battery', desc: '能量来源与管理。锂电组、充电管理、DC-DC 变换与太阳能补给。' },
  { id: 'comm',     name: '通信模块',   en: 'Connectivity', icon: 'signal',  desc: '把设备接入网络。LoRa、4G Cat-1、NB-IoT、以太网、RS485 与 CAN。' },
  { id: 'display',  name: '显示与交互', en: 'Display & HMI', icon: 'screen', desc: '人机界面。OLED、TFT、墨水屏、编码器、摇杆与矩阵键盘。' },
  { id: 'mech',     name: '结构件与耗材', en: 'Mechanics',  icon: 'cube',    desc: '把电路变成实物。面包板、线材、型材、外壳、散热与定制 PCB。' },
  { id: 'expand',   name: '扩展与接口', en: 'Expansion',    icon: 'layers',  desc: '补齐短板。IO 扩展、高精度 ADC、电机驱动、舵机驱动与电平转换。' },
];

/* ---------- 紧凑行格式 ----------
   [id, 名称, 英文, 分类, 品牌, 价格, 库存, 7日热度, 环比%, 标签, 简介, req, specs]
   req 键：bus 总线 / addr I2C地址 / v 供电电压 / mA 典型电流 / peak 峰值电流
           cls 最低算力档(0基础 1进阶 2AI) / pins 占用IO / proto 需要的无线或总线协议
           driver 需驱动板 / ext 需外接电源 / rail 外接电源电压
   caps 键（仅主控）：i2c spi uart gpio pwm adc i2s csi / v 逻辑电平 / cls
           mA5 mA33 供电能力 / wifi ble can usb / kind
-------------------------------------------------------------- */

const CAT_ORDER = CATEGORIES.map(c => c.id);

const BOARD_ROWS = [
  ['esp32-s3-devkitc-1', 'ESP32-S3-DevKitC-1 (N16R8)', 'Espressif ESP32-S3', 'board', '乐鑫 Espressif', 89, 486, 98, 12.4,
   'WiFi|BLE5.0|PSRAM|双核|性价比首选', '双核 240MHz + 8MB PSRAM，原生 USB-OTG，45 个可用 IO。AI 语音与视觉入门的事实标准，生态与例程最丰富。',
   'bus=none;cls=0;v=3.3',
   'i2c:2;spi:2;uart:3;gpio:45;pwm:16;adc:20;i2s:1;csi:1;v:3.3;cls:1;mA5:1000;mA33:600;wifi:1;ble:1;usb:1;mcu:Xtensa LX7 双核 240MHz;flash:16MB Flash / 8MB PSRAM'],

  ['arduino-uno-r4-wifi', 'Arduino UNO R4 WiFi', 'Arduino UNO R4', 'board', 'Arduino', 268, 132, 71, -3.2,
   '5V逻辑|UNO引脚|教学|官方生态', 'RA4M1 Cortex-M4 48MHz，5V 逻辑电平，与历代 UNO 扩展板完全引脚兼容。板载 12×8 LED 矩阵，教学与快速验证最省心。',
   'bus=none;cls=0;v=5',
   'i2c:2;spi:1;uart:2;gpio:20;pwm:6;adc:6;i2s:0;csi:0;v:5;cls:0;mA5:800;mA33:300;wifi:1;ble:1;usb:1;mcu:RA4M1 Cortex-M4 48MHz;flash:256KB Flash / 32KB RAM'],

  ['stm32f407-disc', 'STM32F407VGT6 探索板', 'STM32F4 Discovery', 'board', 'ST 意法半导体', 138, 214, 76, 6.1,
   '工业|CAN|FPU|实时控制', 'Cortex-M4 168MHz 带硬件浮点，1MB Flash。3 路 CAN、USB OTG、12 位 ADC 与 82 个 IO，工控与电机控制的可靠底盘。',
   'bus=none;cls=0;v=3.3',
   'i2c:3;spi:3;uart:6;gpio:82;pwm:16;adc:16;i2s:1;csi:0;v:3.3;cls:1;mA5:900;mA33:700;can:1;usb:1;mcu:Cortex-M4 168MHz / FPU;flash:1MB Flash / 192KB RAM'],

  ['rpi-5-8gb', 'Raspberry Pi 5 (8GB)', 'Raspberry Pi 5', 'board', 'Raspberry Pi', 658, 64, 88, 9.7,
   'Linux|PCIe|视觉|边缘计算', '四核 Cortex-A76 2.4GHz + 8GB LPDDR4X，双 4K 输出与 PCIe 2.0。跑 Linux 与 OpenCV，做视觉与边缘服务的首选。',
   'bus=none;cls=0;v=3.3',
   'i2c:2;spi:2;uart:4;gpio:28;pwm:2;adc:0;i2s:1;csi:2;v:3.3;cls:2;mA5:3000;mA33:1000;wifi:1;ble:1;usb:1;mcu:BCM2712 四核 A76 2.4GHz;flash:8GB LPDDR4X / microSD'],

  ['rpi-pico-2-w', 'Raspberry Pi Pico 2 W', 'RP2350', 'board', 'Raspberry Pi', 62, 398, 69, 15.8,
   'PIO|双核|超低价|入门', 'RP2350 双核 150MHz，独有的 PIO 状态机可硬件级模拟任意时序接口，4MB Flash 且带 WiFi。极致性价比。',
   'bus=none;cls=0;v=3.3',
   'i2c:2;spi:2;uart:2;gpio:26;pwm:12;adc:4;i2s:0;csi:0;v:3.3;cls:0;mA5:600;mA33:400;wifi:1;ble:1;usb:1;mcu:RP2350 双核 150MHz;flash:4MB Flash / 520KB SRAM'],

  ['nodemcu-esp8266', 'NodeMCU ESP8266 (CP2102)', 'ESP8266', 'board', '乐鑫 Espressif', 24, 612, 44, -8.6,
   'WiFi|超低价|联网开关', '80MHz 单核 + WiFi，11 个可用 IO。做联网开关、传感器上报、智能插座的最低成本方案。',
   'bus=none;cls=0;v=3.3',
   'i2c:1;spi:1;uart:1;gpio:11;pwm:4;adc:1;i2s:0;csi:0;v:3.3;cls:0;mA5:500;mA33:300;wifi:1;ble:0;usb:1;mcu:Tensilica L106 80/160MHz;flash:4MB Flash'],

  ['nano-33-ble-sense', 'Arduino Nano 33 BLE Sense Rev2', 'nRF52840', 'board', 'Arduino', 398, 47, 52, 2.3,
   '板载传感器|TinyML|BLE5', 'nRF52840 Cortex-M4F 64MHz，板载 IMU、麦克风、气压、温湿度、光照与颜色传感器，开箱即可跑 TinyML 姿态识别。',
   'bus=none;cls=0;v=3.3',
   'i2c:2;spi:1;uart:1;gpio:22;pwm:8;adc:8;i2s:1;csi:0;v:3.3;cls:1;mA5:600;mA33:500;ble:1;usb:1;mcu:nRF52840 Cortex-M4F 64MHz;flash:1MB Flash / 256KB RAM'],

  ['jetson-orin-nano', 'NVIDIA Jetson Orin Nano 8GB', 'Jetson Orin Nano', 'board', 'NVIDIA', 2199, 18, 61, 21.5,
   'GPU|40TOPS|AI视觉|边缘推理', '1024 核 Ampere GPU，40 TOPS 算力，支持双 CSI 摄像头。跑 YOLO、多路视觉与本地大模型推理的边缘平台。',
   'bus=none;cls=0;v=3.3',
   'i2c:8;spi:2;uart:3;gpio:40;pwm:2;adc:0;i2s:2;csi:2;v:3.3;cls:2;mA5:5000;mA33:1500;wifi:1;ble:1;usb:1;mcu:6-core Arm A78AE 1.5GHz;flash:8GB LPDDR5 / NVMe'],
];

const PART_ROWS = [
  /* ===== 传感器 ===== */
  ['sht31', 'SHT31 高精度温湿度', 'Sensirion SHT31', 'sensor', 'Sensirion', 26, 268, 86, 8.9,
   'I2C|高精度|医疗级', '±0.3°C / ±2%RH 的工业级精度，出厂校准，I2C 数字输出无惧干扰。',
   'bus=i2c;addr=0x44;v=3.3;mA=0.6;cls=0;pins=2',
   '供电|3.3V（3.3–5V 兼容）;接口|I2C，地址 0x44;温度精度|±0.3 °C;湿度精度|±2 %RH;采样率|最高 1 kHz'],
  ['dht22', 'DHT22 温湿度模块', 'DHT22 / AM2302', 'sensor', 'Aosong', 18, 342, 84, -1.4,
   '单总线|便宜|入门必买', '最经典的温湿度模块，单总线驱动，价格低廉，适合教学与快速原型。',
   'bus=onewire;v=3.3-5;mA=1.5;cls=0;pins=1',
   '供电|3.3–5.5V;接口|单总线（需 4.7kΩ 上拉）;温度精度|±0.5 °C;湿度精度|±2 %RH;采样周期|≥2 s'],
  ['bmp280', 'BMP280 气压温度传感器', 'Bosch BMP280', 'sensor', 'Bosch', 12, 401, 64, -5.2,
   'I2C/SPI|气压|海拔', '气压与温度双通道，可换算海拔高度，I2C 与 SPI 双接口可选。',
   'bus=i2c;addr=0x76;v=3.3;mA=0.7;cls=0;pins=2',
   '供电|3.3V;接口|I2C（0x76/0x77）或 SPI;气压范围|300–1100 hPa;气压精度|±1 hPa;海拔精度|±1 m'],
  ['mpu6050', 'MPU6050 六轴姿态模块', 'InvenSense MPU6050', 'sensor', 'InvenSense', 15, 528, 91, 4.6,
   'I2C|陀螺仪|加速度|平衡车', '三轴加速度 + 三轴陀螺仪，自带 DMP 姿态解算。平衡车、云台、手势识别的经典起点。',
   'bus=i2c;addr=0x68;v=3.3-5;mA=4;cls=0;pins=2',
   '供电|3.3–5V（板载 LDO）;接口|I2C，地址 0x68（AD0 拉高变 0x69）;量程|±2/4/8/16 g，±250/500/1000/2000 °/s;采样率|最高 1 kHz;附加|板载 DMP 姿态解算'],
  ['icm-42688-p', 'ICM-42688-P 工业六轴', 'TDK InvenSense', 'sensor', 'TDK', 45, 96, 44, 12.1,
   'SPI|低噪声|机器人', '低噪声工业级 IMU，SPI 高速读取，适合高动态机器人姿态与振动分析。',
   'bus=spi;v=3.3;mA=3;cls=1;pins=4',
   '供电|3.3V;接口|SPI（10 MHz）或 I2C;量程|±16 g，±2000 °/s;噪声密度|70 µg/√Hz;附加|2KB FIFO，片上温度补偿'],
  ['bh1750', 'BH1750 数字光照传感器', 'ROHM BH1750FVI', 'sensor', 'ROHM', 9, 476, 57, -2.8,
   'I2C|勒克斯|lux', '直接输出 lux 值，无需标定，自动调节量程，做自动调光与光照记录最方便。',
   'bus=i2c;addr=0x23;v=3.3;mA=0.2;cls=0;pins=2',
   '供电|3.3V;接口|I2C，地址 0x23（ADDR 拉高变 0x5C）;量程|1–65535 lx;分辨率|0.5 lx;精度|±20 %'],
  ['vl53l0x', 'VL53L0X ToF 激光测距', 'ST VL53L0X', 'sensor', 'ST 意法半导体', 22, 284, 74, 7.3,
   'I2C|激光|毫米级', '真正的飞行时间测距，不受目标颜色与反射率影响，2 m 内毫米级精度。',
   'bus=i2c;addr=0x29;v=3.3;mA=10;cls=0;pins=2',
   '供电|3.3V;接口|I2C，地址 0x29（需 XSHUT 分时复用）;量程|30–2000 mm;精度|±3 %;视场角|25°'],
  ['tcs34725', 'TCS34725 颜色识别', 'AMS TCS34725', 'sensor', 'AMS', 24, 156, 48, -4.1,
   'I2C|RGB|色温', 'RGB + 明光四通道，可算色温与色坐标，分拣、色卡识别与氛围灯取色。',
   'bus=i2c;addr=0x29;v=3.3;mA=1;cls=0;pins=2',
   '供电|3.3V;接口|I2C，地址 0x29;通道|R/G/B/Clear 四通道 16 位;附加|板载白光 LED 与红外滤片'],
  ['hc-sr04', 'HC-SR04 超声波测距', 'HC-SR04', 'sensor', '通用', 6, 720, 54, -9.4,
   'GPIO|超声波|便宜', '最便宜的测距方案，2–400 cm，只需两个 IO。缺点是受温度与目标材质影响。',
   'bus=gpio;v=5;mA=15;cls=0;pins=2',
   '供电|5V;接口|Trig / Echo 两个数字 IO（5V 电平，3.3V 主控需分压）;量程|2–400 cm;精度|±3 mm;刷新|≤20 Hz'],
  ['mq-135', 'MQ-135 空气质量传感器', 'MQ-135', 'sensor', 'Winsen', 16, 208, 30, -6.7,
   '模拟|气体|需预热', '对氨气、苯、烟雾、CO₂ 等有响应，输出模拟电压。需要 24 小时预热才稳定。',
   'bus=adc;v=5;mA=150;cls=0;pins=1;ext=1;rail=5',
   '供电|5V（加热丝 150 mA）;接口|模拟输出 AO / 数字输出 DO;预热|≥24 h;检测|氨气、苯系、烟雾、CO₂'],
  ['sgp30', 'SGP30 TVOC/eCO₂ 传感器', 'Sensirion SGP30', 'sensor', 'Sensirion', 68, 74, 41, 11.2,
   'I2C|TVOC|空气质量', '真正的数字空气质量传感器，输出 TVOC 与等效 CO₂，无需预热。',
   'bus=i2c;addr=0x58;v=3.3;mA=48;cls=1;pins=2',
   '供电|3.3V（典型 48 mA）;接口|I2C，地址 0x58;输出|TVOC ppb / eCO₂ ppm;附加|需 12 s 基线初始化'],
  ['ina219', 'INA219 电流电压监测', 'TI INA219', 'sensor', 'TI', 14, 312, 66, 5.4,
   'I2C|电流|功耗分析', '0.1Ω 采样电阻 + 12 位 ADC，同时读总线电压、电流与功率，做功耗分析必备。',
   'bus=i2c;addr=0x40;v=3.3;mA=1;cls=0;pins=2',
   '供电|3.3–5V;接口|I2C，地址 0x40（可跳线改 0x41–0x4F）;量程|0–26 V / ±3.2 A;精度|±0.5 %'],
  ['max30102', 'MAX30102 心率血氧', 'MAXIM MAX30102', 'sensor', 'MAXIM', 19, 246, 68, 3.1,
   'I2C|PPG|健康监测', '红光 + 红外双 LED 光电容积脉搏波，可算心率与血氧。健康手环的核心器件。',
   'bus=i2c;addr=0x57;v=3.3;mA=1.2;cls=0;pins=2',
   '供电|3.3V;接口|I2C，地址 0x57;波长|660 nm 红光 / 880 nm 红外;附加|板载 1.8V LDO，需 32 字节 FIFO 读取'],
  ['ov2640', 'OV2640 摄像头模组', 'OmniVision OV2640', 'sensor', 'OmniVision', 35, 178, 58, 6.8,
   'DVP|200万像素|视觉', '200 万像素 DVP 并口摄像头，ESP32 官方例程可直接出 JPEG 流。',
   'bus=csi;v=3.3;mA=60;cls=1;pins=12',
   '供电|3.3V（峰值 60 mA）;接口|DVP 8 位并口 + SCCB（I2C 0x30）;分辨率|1600×1200;输出|JPEG / YUV / RGB565;视场角|66°'],
  ['inmp441', 'INMP441 I2S 数字麦克风', 'InvenSense INMP441', 'sensor', 'InvenSense', 15, 224, 46, 9.3,
   'I2S|24位|语音', 'I2S 数字输出，直接进主控 I2S 外设，无需 ADC。做语音唤醒与声源定位。',
   'bus=i2s;v=3.3;mA=1;cls=0;pins=3',
   '供电|3.3V;接口|I2S（BCLK / WS / SD）;位深|24 bit;信噪比|61 dBA;灵敏度|-26 dBFS'],
  ['hx711', 'HX711 称重 ADC', 'Avia HX711', 'sensor', 'Avia', 11, 186, 28, -3.9,
   '24位|称重|应变片', '专为称重传感器设计的 24 位 ADC，两线串行输出，电子秤标配。',
   'bus=gpio;v=3.3;mA=1.5;cls=0;pins=2',
   '供电|3.3V;接口|两线串行（DT / SCK）;分辨率|24 bit;采样率|10 / 80 Hz;附加|需配应变片桥式传感器'],
  ['soil-moisture', '土壤湿度传感器', 'Capacitive Soil Moisture', 'sensor', '通用', 8, 386, 24, -11.3,
   '模拟|电容式|园艺', '电容式测量避免电极腐蚀，长期埋土可用。配自动浇灌方案。',
   'bus=adc;v=3.3-5;mA=5;cls=0;pins=1',
   '供电|3.3–5V;接口|模拟输出 AO;输出|1.2–2.5 V 对应干湿;附加|建议加防水涂层'],
  ['pir-hc-sr501', 'HC-SR501 人体红外', 'HC-SR501', 'sensor', '通用', 6, 512, 26, -7.8,
   'GPIO|人体感应|低功耗', '被动红外探测人体移动，可调延时与灵敏度，输出数字电平。',
   'bus=gpio;v=3.3-5;mA=0.05;cls=0;pins=1',
   '供电|4.5–20 V（常用 5 V）;接口|数字输出;探测|≤7 m，锥角 110°;延时|0.3 s–200 s 可调'],
  ['ds18b20', 'DS18B20 防水温度探头', 'Maxim DS18B20', 'sensor', 'MAXIM', 7, 448, 62, 1.8,
   '单总线|防水|多点', '不锈钢封装可浸水，单总线可挂多颗并各自寻址，做水温与冷库监控。',
   'bus=onewire;v=3.3;mA=1.5;cls=0;pins=1',
   '供电|3–5.5V（支持寄生供电）;接口|单总线，可多颗并联寻址;精度|±0.5 °C（-10~85 °C）;量程|-55~125 °C'],
  ['as5600', 'AS5600 磁编码器', 'AMS AS5600', 'sensor', 'AMS', 18, 142, 32, 14.6,
   'I2C|12位|角度', '非接触式绝对角度测量，12 位分辨率，配径向磁铁即可读转角。',
   'bus=i2c;addr=0x36;v=3.3;mA=6;cls=0;pins=2',
   '供电|3.3V;接口|I2C，地址 0x36（或模拟 / PWM 输出）;分辨率|12 bit（4096 步）;附加|需配 Ø6 径向充磁磁铁'],

  /* ===== 电机与执行器 ===== */
  ['sg90', 'SG90 微型舵机', 'TowerPro SG90', 'actuator', 'TowerPro', 12, 640, 88, 2.7,
   'PWM|180度|轻量', '最常用的 9g 微型舵机，0.1 s/60° 速度，做机械臂关节与云台转向。',
   'bus=pwm;v=5;mA=100;peak=700;cls=0;pins=1;ext=1;rail=5',
   '供电|4.8–6 V（峰值 700 mA，需独立 5V 供电）;接口|PWM 50 Hz，脉宽 500–2400 µs;扭矩|1.8 kg·cm @ 4.8 V;角度|0–180°;重量|9 g'],
  ['mg996r', 'MG996R 金属齿轮舵机', 'TowerPro MG996R', 'actuator', 'TowerPro', 38, 214, 66, 5.9,
   'PWM|大扭矩|金属齿', '11 kg·cm 大扭矩，全金属齿轮，堵转电流可达 2.5 A，必须独立供电。',
   'bus=pwm;v=6;mA=200;peak=2500;cls=0;pins=1;ext=1;rail=5',
   '供电|4.8–7.2 V（峰值 2.5 A，务必独立电源）;接口|PWM 50 Hz;扭矩|11 kg·cm @ 6 V;角度|0–180°;重量|55 g'],
  ['n20-motor', 'N20 微型减速电机', 'N20 Gear Motor', 'actuator', '通用', 16, 328, 58, 7.1,
   '减速|小体积|需驱动', '金属齿轮箱减速电机，6V/12V 可选，减速比 1:100 时扭矩大、转速低，适合小车与机械结构。',
   'bus=pwm;v=6;mA=200;peak=1200;cls=0;pins=2;driver=1;ext=1;rail=6',
   '供电|6 V（或 12 V 版本）;接口|两线，需 H 桥驱动 + PWM 调速;减速比|1:100（可选 1:30~1:1000）;空载转速|200 rpm;堵转电流|1.2 A'],
  ['28byj-48', '28BYJ-48 步进电机 + ULN2003', '28BYJ-48', 'actuator', '通用', 9, 402, 42, -2.1,
   '步进|5V|含驱动板', '5V 四相步进电机，自带 ULN2003 驱动板，做精确角度定位的最便宜方案。',
   'bus=gpio;v=5;mA=90;cls=0;pins=4;driver=1;ext=1;rail=5',
   '供电|5 V（约 90 mA/相）;接口|四相 GPIO 或 ULN2003 驱动板;步距角|5.625°/64（减速后 0.088°）;减速比|1:64;保持扭矩|34 mN·m'],
  ['nema17', 'NEMA17 步进电机', 'NEMA 17 42BYGH', 'actuator', '通用', 56, 128, 52, 8.4,
   '步进|1.5A|3D打印', '42mm 两相步进，1.5 A/相，配 A4988 或 TMC2209 驱动，3D 打印机与 CNC 的主力。',
   'bus=gpio;v=3.3;mA=1500;cls=0;pins=2;driver=1;ext=1;rail=12',
   '供电|12 V（1.5 A/相）;接口|两相四线，需步进驱动器;步距角|1.8°（200 步/圈）;保持扭矩|0.4 N·m;轴径|5 mm'],
  ['a2212', 'A2212 无刷电机 + 电调', 'A2212 1000KV', 'actuator', '通用', 45, 86, 36, 3.4,
   '无刷|航模|需电调', '1000KV 外转子无刷电机，配 30 A 电调与 3S 锂电，做四轴与涵道风扇。',
   'bus=pwm;v=5;mA=200;peak=20000;cls=1;pins=1;driver=1;ext=1;rail=12',
   '供电|11.1 V 3S 锂电（峰值 20 A）;接口|电调 PWM / DShot，需 ESC;KV 值|1000 KV;最大拉力|约 900 g（1045 桨）;附加|必须配螺旋桨与电调'],
  ['linear-actuator', '直流电动推杆 100N', 'Linear Actuator', 'actuator', '通用', 128, 42, 22, 16.9,
   '推杆|100mm|自动门', '12V 直流推杆，行程 100 mm、推力 100 N，自带限位开关。自动门、升降桌、护理床。',
   'bus=gpio;v=12;mA=2000;cls=0;pins=2;driver=1;ext=1;rail=12',
   '供电|12 V DC（2 A）;接口|两线正反接控制，需大电流 H 桥;行程|100 mm（可选 50–300）;推力|100 N;速度|12 mm/s'],
  ['relay-2ch', '双路继电器模块', '2-Channel Relay 5V', 'actuator', '通用', 12, 468, 60, -1.2,
   '继电器|220V|开关', '光耦隔离双路继电器，可控制 250VAC/10A 负载，做智能插座与水泵控制。',
   'bus=gpio;v=5;mA=20;peak=80;cls=0;pins=2',
   '供电|5 V（每路吸合约 20 mA）;接口|两路数字 IO（高电平触发 / 可跳线低电平）;触点容量|250 VAC 10 A / 30 VDC 10 A;隔离|光耦隔离'],
  ['buzzer-passive', '无源蜂鸣器模块', 'Passive Buzzer', 'actuator', '通用', 3, 880, 34, -5.5,
   'PWM|提示音|最便宜', '无源蜂鸣器需 PWM 驱动才能发出不同频率，可演奏简单旋律与报警音。',
   'bus=pwm;v=3.3;mA=30;cls=0;pins=1',
   '供电|3.3–5 V;接口|PWM（频率决定音调）;声压|≥85 dB @ 10 cm;谐振频率|2.7 kHz'],
  ['solenoid-valve', '常闭电磁阀 12V', 'Solenoid Valve', 'actuator', '通用', 32, 96, 18, 4.2,
   '电磁阀|水路|12V', '12V 常闭电磁阀，通电开阀，配继电器或 MOS 驱动，做自动浇灌与流体控制。',
   'bus=gpio;v=12;mA=500;cls=0;pins=1;driver=1;ext=1;rail=12',
   '供电|12 V DC（0.5 A）;接口|两线，需继电器 / MOS 驱动并加续流二极管;口径|1/2 英寸（DN15）;压力|0.02–0.8 MPa;类型|常闭'],
  ['fan-5v-pwm', '5V PWM 散热风扇 40mm', '5V PWM Fan', 'actuator', '通用', 14, 254, 20, -0.8,
   'PWM|散热|风扇', '40mm 滚珠风扇，支持 PWM 调速，给大电流驱动板与主控散热。',
   'bus=pwm;v=5;mA=200;cls=0;pins=1;ext=0',
   '供电|5 V（0.2 A）;接口|PWM 调速 + 测速反馈（可选）;风量|9 CFM;转速|6000 rpm'],

  /* ===== 电源与电池 ===== */
  ['psu-12v5a', '12V 5A 电源适配器', 'DC 12V 5A Adapter', 'power', '通用', 36, 176, 50, 3.6,
   '12V|5A|DC5.5', '整机供电主力，60W 输出可同时带推杆、步进与舵机，建议作为系统总电源。',
   'bus=none;v=12;cls=0;kind=source;vout=12;aout=5',
   '输入|100–240 VAC;输出|12 V / 5 A（60 W）;接口|DC 5.5×2.1 mm 公头;保护|过流 / 过压 / 短路'],
  ['pdb-5v3a', '面包板稳压电源模块 5V/3.3V', 'Breadboard Power Supply', 'power', '通用', 9, 358, 44, -4.8,
   '5V/3.3V|面包板|方便', '插在面包板上的双路稳压模块，输入 6.5–12V，输出 5V 与 3.3V 各 700 mA。',
   'bus=none;v=5;cls=0;kind=source;vout=5;aout=0.7',
   '输入|6.5–12 V DC;输出|5 V 700 mA + 3.3 V 500 mA;接口|面包板直插;附加|带电源指示与开关'],
  ['lm2596-dcdc', 'LM2596 可调降压模块', 'LM2596 Buck', 'power', 'TI', 7, 512, 58, -2.4,
   '降压|3A|可调', '输入 4.5–40V 降到 1.25–35V，3A 输出，效率约 92%。给 12V 系统造 5V 轨。',
   'bus=none;v=3.3-12;cls=0;kind=converter;vout=5;aout=3',
   '输入|4.5–40 V;输出|1.25–35 V 可调（3 A）;效率|最高 92 %;附加|建议加 100 µF 输入电容'],
  ['mt3608-boost', 'MT3608 升压模块', 'MT3608 Boost', 'power', '通用', 5, 296, 26, -6.1,
   '升压|2A|小体积', '输入 2–24V 升到最高 28V，2A。把 18650 升到 12V 驱动推杆与电磁阀。',
   'bus=none;v=3.3-12;cls=0;kind=converter;vout=12;aout=2',
   '输入|2–24 V;输出|最高 28 V（2 A，随压差衰减）;效率|约 90 %;附加|输入需 ≥ 输出 1/3'],
  ['battery-18650-2s', '18650 锂电池组 2S (7.4V)', '18650 2S Pack', 'power', '通用', 42, 168, 46, 5.1,
   '7.4V|3000mAh|可充', '两节 18650 串联 + 电池盒，7.4V 3000mAh，约 22 Wh，便携设备主力。',
   'bus=none;v=7.4;cls=0;kind=source;vout=7.4;aout=3;mah=3000',
   '电压|7.4 V 标称（满电 8.4 V）;容量|3000 mAh（约 22 Wh）;最大放电|3 A 持续;接口|引线 + 电池盒;附加|需配 2S 保护板'],
  ['lipo-3s-2200', '3S 锂聚合物电池 2200mAh', 'LiPo 3S 2200mAh', 'power', '通用', 98, 74, 32, 8.8,
   '11.1V|25C|航模', '11.1V 2200mAh 25C 放电，瞬间 55A。无刷动力与移动机器人的标准动力源。',
   'bus=none;v=11.1;cls=0;kind=source;vout=11.1;aout=55;mah=2200',
   '电压|11.1 V 标称（满电 12.6 V）;容量|2200 mAh;放电倍率|25 C（持续 55 A）;接口|XT60 + 平衡头;附加|务必使用平衡充电器'],
  ['tp4056', 'TP4056 单节锂电充电模块', 'TP4056', 'power', '通用', 4, 620, 38, -3.4,
   '充电|1A|带保护', '5V 输入给单节 18650 充电，1A 电流，带 DW01 过放保护。',
   'bus=none;v=5;cls=0;kind=charger',
   '输入|5 V（Micro USB / Type-C）;充电电流|1 A（可改电阻调整）;保护|过充 / 过放 / 过流;附加|充电与满电双指示灯'],
  ['bms-2s', '2S 锂电池保护与均衡板', '2S BMS 15A', 'power', '通用', 18, 142, 28, 2.2,
   '均衡|保护|15A', '2S 电池的过充过放保护 + 被动均衡，15A 持续放电。锂电组必配。',
   'bus=none;v=7.4;cls=0;kind=bms',
   '适用|2S 锂电（7.4 V）;持续电流|15 A;保护|过充 4.25 V / 过放 2.5 V;附加|被动均衡 36 mA'],
  ['solar-6v', '太阳能板 6V 2W', 'Solar Panel 6V 2W', 'power', '通用', 24, 118, 20, 6.4,
   '太阳能|户外|补给', '6V 330mA 单晶硅板，配 TP4056 或 MPPT 给户外节点补电。',
   'bus=none;v=6;cls=0;kind=source;vout=6;aout=0.33',
   '开路电压|6 V;峰值功率|2 W（330 mA）;尺寸|110×136 mm;附加|需配充电管理，不可直连电池'],

  /* ===== 通信模块 ===== */
  ['lora-sx1278', 'LoRa SX1278 433MHz 模块', 'Semtech SX1278', 'comm', 'Semtech', 28, 186, 78, 10.3,
   'LoRa|远距离|低功耗', '433MHz 扩频通信，空旷视距 3–5 km，功耗极低。农业与野外传感网的标配。',
   'bus=spi;v=3.3;mA=12;peak=120;cls=0;pins=3;proto=lora',
   '供电|3.3 V（发射峰值 120 mA）;接口|SPI + DIO0/1 + RST;频段|433 MHz（可换 868/915）;速率|0.018–37.5 kbps;附加|必须接天线，否则烧功放'],
  ['air724ug', 'Air724UG 4G Cat-1 模块', 'Air724UG', 'comm', '合宙 Luat', 68, 98, 48, 13.7,
   '4G|Cat-1|全网通', '4G Cat-1 全网通，走 UART AT 指令，支持 TCP/MQTT/HTTP。做远程联网的主力。',
   'bus=uart;v=5;mA=60;peak=2000;cls=0;pins=2;proto=4g;ext=1;rail=5',
   '供电|5 V（峰值 2 A，必须大电容 + 独立电源）;接口|UART AT 指令，默认 115200;网络|LTE Cat-1 全网通;协议|TCP / UDP / MQTT / HTTP / SSL;附加|需插入 Nano SIM 卡'],
  ['bc26', 'BC26 NB-IoT 模块', 'Quectel BC26', 'comm', 'Quectel 移远', 42, 76, 34, 5.6,
   'NB-IoT|超低功耗|抄表', 'NB-IoT 广域低功耗，一节电池可用数年。适合水表、井盖、环境监测等低频上报。',
   'bus=uart;v=3.3;mA=50;peak=500;cls=0;pins=2;proto=nb;ext=1;rail=3.3',
   '供电|3.3 V（峰值 500 mA）;接口|UART AT 指令;网络|NB-IoT（Band 5/8）;功耗|PSM 模式 < 5 µA;附加|需 NB-IoT 专用卡'],
  ['w5500', 'W5500 以太网模块', 'WIZnet W5500', 'comm', 'WIZnet', 32, 148, 50, 4.4,
   '以太网|硬件TCP/IP|稳定', '硬件 TCP/IP 协议栈，8 个独立 Socket，不占主控算力。有线场景最稳。',
   'bus=spi;v=3.3;mA=140;cls=0;pins=4;proto=eth',
   '供电|3.3 V（140 mA）;接口|SPI（最高 80 MHz）;速率|10/100 Mbps;Socket|8 路硬件并发;附加|需带网络变压器的 RJ45'],
  ['hc-05', 'HC-05 蓝牙串口模块', 'HC-05', 'comm', '通用', 18, 312, 40, -6.3,
   '蓝牙|串口透传|经典', '经典蓝牙串口透传，手机 App 直连。做遥控与调试最省事。',
   'bus=uart;v=3.3;mA=40;cls=0;pins=2;proto=ble',
   '供电|3.3–5 V（板载 LDO）;接口|UART，默认 9600;协议|蓝牙 2.0 SPP 透传;距离|约 10 m'],
  ['rs485-max485', 'MAX485 RS485 收发模块', 'MAX485', 'comm', 'MAXIM', 8, 386, 42, 1.4,
   'RS485|工业|长距离', 'RS485 半双工收发，差分信号抗干扰，1200 m 内可靠。接 Modbus 传感器与 PLC。',
   'bus=uart;v=3.3-5;mA=15;cls=0;pins=2;proto=rs485',
   '供电|3.3–5 V;接口|UART + DE/RE 方向控制;速率|最高 2.5 Mbps;距离|≤1200 m;附加|总线两端需 120Ω 终端电阻'],
  ['tja1050', 'TJA1050 CAN 收发模块', 'TJA1050', 'comm', 'NXP', 9, 224, 36, 2.9,
   'CAN|汽车|抗干扰', 'CAN 总线收发器，需主控自带 CAN 控制器（如 STM32）。汽车与工控网络。',
   'bus=none;v=5;mA=15;cls=0;pins=2;proto=can',
   '供电|5 V;接口|接主控 CAN_TX/RX 引脚（主控需内置 CAN 控制器）;速率|最高 1 Mbps;附加|总线两端 120Ω 终端'],
  ['atgm336h', 'ATGM336H GNSS 定位模块', 'ATGM336H', 'comm', '中科微', 42, 132, 54, 7.6,
   'GNSS|北斗|GPS', '支持 GPS + 北斗 + GLONASS 多模定位，冷启动 30 s，精度 2.5 m。做轨迹记录与授时。',
   'bus=uart;v=3.3;mA=45;cls=0;pins=2;proto=gnss',
   '供电|3.3 V（45 mA）;接口|UART NMEA 0183，默认 9600;星座|GPS + 北斗 + GLONASS;精度|2.5 m CEP;附加|需有源天线，室内无法定位'],
  ['cc2530-zigbee', 'CC2530 ZigBee 模块', 'TI CC2530', 'comm', 'TI', 36, 88, 26, -4.7,
   'ZigBee|自组网|多节点', 'ZigBee 自组网，单网可挂 200+ 节点，适合家庭自动化与灯控网络。',
   'bus=uart;v=3.3;mA=30;cls=0;pins=2;proto=zigbee',
   '供电|3.3 V;接口|UART（透传固件）或 SPI（自写协议栈）;协议|ZigBee 3.0;附加|需协调器 + 路由器规划'],
  ['nrf24l01', 'NRF24L01+ 2.4G 无线模块', 'Nordic nRF24L01+', 'comm', 'Nordic', 12, 268, 30, -5.9,
   '2.4G|低延迟|遥控', '2.4GHz 私有协议，延迟极低，做遥控器与无线手柄。注意供电需加滤波电容。',
   'bus=spi;v=3.3;mA=14;cls=0;pins=4;proto=none',
   '供电|3.3 V（对纹波敏感，需并 10 µF 电容）;接口|SPI;速率|250 kbps – 2 Mbps;距离|约 100 m（带 PA 可达 1 km）'],

  /* ===== 显示与交互 ===== */
  ['oled-096-i2c', '0.96" OLED 显示屏 (I2C)', 'SSD1306 128×64', 'display', '通用', 15, 596, 94, 1.9,
   'I2C|OLED|高对比', '128×64 自发光 OLED，黑白高对比，只占 2 个 IO。几乎所有项目的标配显示。',
   'bus=i2c;addr=0x3c;v=3.3;mA=15;cls=0;pins=2',
   '供电|3.3–5 V（板载 LDO）;接口|I2C，地址 0x3C（可跳 0x3D）;分辨率|128×64;驱动|SSD1306;可视角度|160°'],
  ['tft-st7789-135', '1.14" IPS TFT 彩屏', 'ST7789V 135×240', 'display', '通用', 22, 288, 72, 11.8,
   'SPI|IPS|彩色', '135×240 全彩 IPS，SPI 接口，色彩与可视角度都远胜 OLED，做状态面板。',
   'bus=spi;v=3.3;mA=40;cls=0;pins=5',
   '供电|3.3 V;接口|SPI（SCLK/MOSI/CS/DC/RST）;分辨率|135×240;驱动|ST7789V;附加|可选板载 SD 卡槽'],
  ['tft-st7796-35', '3.5" TFT 触摸屏', 'ST7796 320×480', 'display', '通用', 68, 112, 56, 6.2,
   'SPI|触摸|大屏', '320×480 大尺寸彩屏 + 电阻触摸，SPI 驱动，做手持终端与 HMI 面板。',
   'bus=spi;v=3.3;mA=110;cls=1;pins=8',
   '供电|3.3 V（背光 110 mA）;接口|SPI + 触摸 ADC（XPT2046）;分辨率|320×480;附加|背光可 PWM 调光'],
  ['epaper-213', '2.13" 墨水屏模块', 'Waveshare 2.13" e-Paper', 'display', '微雪电子', 78, 94, 46, 9.4,
   'SPI|双稳态|超低功耗', '断电后画面保持，静态零功耗。电子价签、货架标签与户外仪表盘。',
   'bus=spi;v=3.3;mA=12;peak=26;cls=0;pins=5',
   '供电|3.3 V;接口|SPI + DC/RST/BUSY;分辨率|250×122;刷新|全刷 2 s / 局刷 0.3 s;附加|仅支持黑白，刷新次数约 100 万次'],
  ['lcd1602-i2c', 'LCD1602 字符屏 (I2C)', 'HD44780 + PCF8574', 'display', '通用', 18, 246, 32, -7.2,
   'I2C|字符|5V', '16×2 字符液晶，I2C 背包只需 2 个 IO。5V 供电，3.3V 主控需电平转换。',
   'bus=i2c;addr=0x27;v=5;mA=25;cls=0;pins=2',
   '供电|5 V;接口|I2C（PCF8574 背包），地址 0x27 / 0x3F;字符|16×2;附加|3.3V 主控需电平转换'],
  ['rotary-encoder', '旋转编码器模块', 'KY-040', 'display', '通用', 6, 468, 38, 3.2,
   'GPIO|旋钮|带按键', '无限位旋转 + 按下按键，做菜单导航与参数调节，比按键矩阵直观得多。',
   'bus=gpio;v=3.3-5;mA=5;cls=0;pins=3',
   '供电|3.3–5 V;接口|CLK / DT 两相 + SW 按键，共 3 个 IO;分辨率|20 脉冲/圈;附加|建议加 RC 硬件消抖'],
  ['joystick-ps2', 'PS2 双轴摇杆模块', 'KY-023', 'display', '通用', 8, 392, 36, -2.6,
   'ADC|双轴|遥控', '两路电位器 + 按下按键，做遥控器与游戏手柄输入。',
   'bus=adc;v=5;mA=3;cls=0;pins=3',
   '供电|3.3–5 V;接口|X / Y 两路模拟 + SW 按键;附加|10 kΩ 电位器，需 ADC 引脚'],
  ['keypad-4x4', '4×4 矩阵键盘', 'Membrane Keypad', 'display', '通用', 9, 274, 34, -1.9,
   'GPIO|16键|密码锁', '16 键薄膜矩阵键盘，用 8 个 IO 读 16 个键。密码锁与参数输入。',
   'bus=gpio;v=5;mA=5;cls=0;pins=8',
   '供电|3.3–5 V;接口|4 行 + 4 列，共 8 个 IO;按键|16 键（0–9、A–D、*、#）;附加|需软件扫描消抖'],
  ['neopixel-ring16', 'WS2812B RGB 灯环 16 位', 'WS2812B 16-LED Ring', 'display', '通用', 22, 218, 56, 8.1,
   '单总线|RGB|灯效', '16 颗可独立寻址 RGB LED 组成圆环，单线级联，做环形指示与灯效。',
   'bus=gpio;v=5;mA=20;peak=960;cls=0;pins=1',
   '供电|5 V（16 颗全白峰值 960 mA，需独立供电）;接口|单总线（800 kHz）;附加|数据线建议串 300Ω 电阻'],

  /* ===== 结构件与耗材 ===== */
  ['breadboard-830', '面包板 830 孔', 'Breadboard 830', 'mech', '通用', 12, 528, 40, -3.8,
   '免焊接|原型|必备', '830 孔标准面包板，免焊接快速验证电路，配合杜邦线即插即用。',
   'bus=none;cls=0', '规格|830 孔（63×10 + 电源轨）;尺寸|165×55 mm;附加|建议配面包板电源模块'],
  ['dupont-wires', '杜邦线套装 120 根', 'Dupont Jumper Wires', 'mech', '通用', 9, 640, 44, -2.2,
   '线材|公母|必备', '公对公 / 公对母 / 母对母各 40 根，20cm，彩虹色便于区分信号。',
   'bus=none;cls=0', '数量|120 根（三种各 40）;长度|20 cm;类型|2.54 mm 单排;附加|24AWG'],
  ['proto-board', '洞洞板 5×7cm (5 片装)', 'Prototype PCB', 'mech', '通用', 8, 412, 26, -6.4,
   '焊接|定型|便宜', '镀锡洞洞板，把验证好的电路焊成固定形态，做小批量定型。',
   'bus=none;cls=0', '规格|5×7 cm 双面镀锡;孔距|2.54 mm;数量|5 片;附加|单面走线'],
  ['acrylic-base', '亚克力底板 100×150mm', 'Acrylic Base Plate', 'mech', '通用', 15, 236, 22, -4.1,
   '结构|安装|底板', '3mm 透明亚克力板，预钻 M3 安装孔，做整车与装置的底盘。',
   'bus=none;cls=0', '尺寸|100×150×3 mm;孔径|M3 预钻孔;附加|可激光切割定制开孔'],
  ['alu-profile-2020', '2020 铝型材 300mm (4 根)', '2020 Aluminium Extrusion', 'mech', '通用', 28, 148, 24, 5.8,
   '铝型材|框架|可扩展', '标准 2020 欧标铝型材，配角件可搭任意框架：机械臂、传送带、机器人底盘。',
   'bus=none;cls=0', '规格|20×20 mm，长 300 mm;数量|4 根;槽型|欧标 6 mm;附加|需另配角件与 T 型螺母'],
  ['m3-screw-kit', 'M3 螺丝螺母套装', 'M3 Screw Kit', 'mech', '通用', 16, 326, 30, 2.4,
   '紧固|M3|收纳盒', 'M3 圆头 / 沉头螺丝 + 螺母 + 垫片共 400 颗，分格收纳盒。',
   'bus=none;cls=0', '规格|M3×6/8/10/12/16/20;数量|约 400 颗;材质|304 不锈钢;附加|分格收纳盒'],
  ['heatsink-fan', '铝散热片 + 5V 风扇套装', 'Heatsink + Fan', 'mech', '通用', 14, 198, 28, 1.2,
   '散热|铝|风扇', '针对 TO-220 / 电机驱动 IC 的铝散热片 + 5V 小风扇，压住大电流驱动的温升。',
   'bus=none;v=5;mA=200;cls=0;pins=0',
   '散热片|25×25×15 mm 铝制;风扇|5 V 0.2 A;附加|需导热硅脂（含）'],
  ['case-3dprint', '定制 3D 打印外壳', 'Custom 3D Printed Case', 'mech', '平台代工', 45, 120, 48, 12.6,
   '定制|外壳|按方案建模', '按你的模块组合自动生成并打印外壳，预留接口开孔与散热格栅。下单后 3 个工作日交付。',
   'bus=none;cls=0', '工艺|FDM / 树脂可选;材料|PLA / PETG / 尼龙;公差|±0.2 mm;交期|下单后 3 个工作日;附加|含建模确认稿'],
  ['pcb-fab', '定制 PCB 打样 (5 片)', 'Custom PCB Fabrication', 'mech', '平台代工', 50, 200, 42, 9.1,
   '打样|5片|免费开钢网', '把你的方案固化为定制 PCB，双面 1.6mm 沉金，5 片起，含免费钢网。',
   'bus=none;cls=0', '层数|双面;尺寸|≤100×100 mm;工艺|沉金 / 阻焊任意色;数量|5 片;交期|7 个工作日;附加|含钢网与 SMT 可选'],

  /* ===== 扩展与接口 ===== */
  ['tb6612', 'TB6612FNG 双路电机驱动', 'Toshiba TB6612FNG', 'expand', 'Toshiba', 12, 348, 80, 6.6,
   '电机驱动|1.2A|PWM', '双路 H 桥，1.2A 持续 / 3.2A 峰值，效率 95%，比 L298N 更小更凉。做两轮小车首选。',
   'bus=pwm;v=3.3-5;mA=15;cls=0;pins=6;driver=1',
   '供电|电机 VM 2.5–13.5 V，逻辑 VCC 3.3–5 V;接口|PWM ×2 + AIN1/AIN2/BIN1/BIN2/STBY;电流|1.2 A 持续 / 3.2 A 峰值;附加|需共地，电机端加去耦电容'],
  ['l298n', 'L298N 双路电机驱动', 'ST L298N', 'expand', 'ST 意法半导体', 14, 302, 48, -3.1,
   '电机驱动|2A|经典', '经典大电流双 H 桥，2A/路，带 5V 输出。压降较大发热明显，需加散热片。',
   'bus=pwm;v=5;mA=20;cls=0;pins=6;driver=1',
   '供电|电机 5–35 V，逻辑 5 V;接口|PWM ×2 + 方向 ×4 + ENA/ENB;电流|2 A / 路;附加|需散热片，压降约 2 V'],
  ['pca9685', 'PCA9685 16 路舵机驱动', 'NXP PCA9685', 'expand', 'NXP', 22, 262, 70, 7.9,
   'I2C|16路PWM|舵机', '一片解决 16 路舵机，12 位 PWM 分辨率，I2C 级联 62 片。机械臂与多足机器人核心。',
   'bus=i2c;addr=0x40;v=3.3;mA=10;cls=0;pins=0;driver=1',
   '供电|逻辑 3.3 V + 舵机电源 V+（5–6 V，独立大电流）;接口|I2C，地址 0x40–0x7F（可级联）;通道|16 路 12 位 PWM;频率|40–1000 Hz;附加|舵机电源务必独立，勿从主控取电'],
  ['a4988', 'A4988 步进电机驱动', 'Allegro A4988', 'expand', 'Allegro', 9, 386, 52, -1.6,
   '步进驱动|1A|细分', 'A4988 步进驱动模块，最高 1/16 细分，1A/相。配 NEMA17 与 28BYJ。',
   'bus=gpio;v=3.3;mA=15;cls=0;pins=3;driver=1',
   '供电|电机 8–35 V，逻辑 3.3–5 V;接口|STEP / DIR / EN + MS1-3 细分;电流|1 A / 相（需限流调节）;附加|务必先调 Vref 再上电机'],
  ['tmc2209', 'TMC2209 静音步进驱动', 'Trinamic TMC2209', 'expand', 'Trinamic', 26, 174, 42, 10.7,
   '静音|2A|UART配置', 'StealthChop 静音驱动，2A/相，支持 UART 在线配置与失速检测。3D 打印机静音升级首选。',
   'bus=uart;v=3.3;mA=12;cls=0;pins=2;driver=1',
   '供电|电机 4.75–29 V，逻辑 3.3 V;接口|STEP / DIR + UART（单线）;电流|2 A 峰值;细分|最高 1/256;附加|需散热片'],
  ['esc-30a', '无刷电调 30A', 'ESC 30A', 'expand', '通用', 28, 118, 26, 4.9,
   '无刷电调|30A|PWM', '30A 无刷电调，支持 PWM / OneShot，配 A2212 与 3S 锂电做动力系统。',
   'bus=pwm;v=5;mA=30;cls=0;pins=1;driver=1;ext=1;rail=12',
   '供电|2–4S 锂电（7.4–14.8 V）;接口|PWM / OneShot125（信号 5 V）;电流|30 A 持续;附加|需与电池直接连接，不可经主控供电'],
  ['pcf8574', 'PCF8574 IO 扩展模块', 'TI PCF8574', 'expand', 'TI', 8, 328, 38, 3.7,
   'I2C|8路IO|省引脚', 'I2C 转 8 路准双向 IO，一片只占 2 个引脚，可级联 8 片共 64 路。',
   'bus=i2c;addr=0x20;v=3.3;mA=1;cls=0;pins=0',
   '供电|3.3 V;接口|I2C，地址 0x20–0x27（A0-A2 跳线）;IO|8 路准双向;附加|输出能力弱，驱动 LED 需限流'],
  ['ads1115', 'ADS1115 16 位 ADC', 'TI ADS1115', 'expand', 'TI', 16, 284, 40, 5.3,
   'I2C|16位|高精度', '16 位 4 通道 ADC，内置 PGA 与基准，远超主控自带 12 位 ADC。做精密测量。',
   'bus=i2c;addr=0x48;v=3.3;mA=1;cls=0;pins=0',
   '供电|3.3 V;接口|I2C，地址 0x48–0x4B;分辨率|16 bit（4 通道单端 / 2 通道差分）;采样率|8–860 SPS;附加|内置可编程增益 ±6.144 V'],
  ['tca9548a', 'TCA9548A I2C 多路复用器', 'TI TCA9548A', 'expand', 'TI', 14, 142, 38, 16.2,
   'I2C|解决地址冲突|8通道', '当地址冲突时，把 8 条独立 I2C 支路挂在同一条主总线上，彻底解决同地址器件共存问题。',
   'bus=i2c;addr=0x70;v=3.3;mA=1;cls=0;pins=0',
   '供电|3.3 V;接口|I2C 主总线（0x70–0x77）+ 8 路支路;通道|8;附加|可在支路上挂任意同地址器件'],
  ['level-shifter-4ch', '4 路双向电平转换', 'TXS0108 / 4ch Level Shifter', 'expand', '通用', 5, 520, 34, 1.1,
   '电平转换|5V↔3.3V|必配', '3.3V 与 5V 双向互转，4 通道。用 3.3V 主控接 5V 传感器时必配。',
   'bus=none;v=3.3-5;mA=0;cls=0;pins=0',
   '通道|4 路双向;电平|1.8/3.3 V ↔ 5 V;速率|≤24 Mbps（推挽）;附加|低速 I2C 建议用专用转换芯片'],
];

/* ---------- 算力档位文案（需在 buildModule 之前定义） ---------- */
const CLASS_LABEL = ['基础算力', '进阶算力', 'AI / 高性能算力'];
const CLASS_DESC = [
  '满足 IO 控制、简单协议与外设驱动（8 位 / Cortex-M0+ 级）',
  '满足实时控制、多总线并发与浮点运算（Cortex-M4 / 双核 LX7 级）',
  '满足视觉处理、神经网络推理与 Linux 级系统（GPU / 多核 A 系列）',
];

/* ---------- 构建模块对象 ---------- */
/* 兼容 "key=value" 与 "key:value" 两种写法，取最先出现的分隔符 */
function _kv(str) {
  const o = {};
  if (!str) return o;
  str.split(';').forEach(pair => {
    const iEq = pair.indexOf('=');
    const iCol = pair.indexOf(':');
    let i = -1;
    if (iEq < 0) i = iCol;
    else if (iCol < 0) i = iEq;
    else i = Math.min(iEq, iCol);
    if (i < 0) return;
    o[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  });
  return o;
}
function _specs(str) {
  if (!str) return [];
  return str.split(';').map(p => {
    const i = p.indexOf('|');
    return i < 0 ? [p, ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  }).filter(p => p[0]);
}
function _num(v, d) { const n = parseFloat(v); return isNaN(n) ? d : n; }

/* 主控的规格表由 caps 派生，保证详情页与校验引擎读的是同一份数据 */
function _boardSpecs(c) {
  const rows = [
    ['主控芯片', c.mcu],
    ['存储', c.flash],
    ['逻辑电平', c.v + ' V'],
    ['算力档位', CLASS_LABEL[c.cls] + '（' + CLASS_DESC[c.cls] + '）'],
    ['可用 GPIO', c.gpio + ' 个'],
    ['I2C / SPI / UART', `${c.i2c} / ${c.spi} / ${c.uart}`],
    ['PWM / ADC', `${c.pwm} / ${c.adc}`],
    ['I2S / CSI', `${c.i2s} / ${c.csi}`],
    ['5V 供电能力', (c.mA5 / 1000).toFixed(2) + ' A'],
    ['3.3V 供电能力', (c.mA33 / 1000).toFixed(2) + ' A'],
    ['无线与总线', [c.wifi && 'WiFi', c.ble && 'BLE', c.can && 'CAN', c.usb && 'USB'].filter(Boolean).join(' / ') || '无'],
  ];
  return rows.filter(r => r[1] !== undefined && r[1] !== null && r[1] !== '');
}

function buildModule(row) {
  const [id, name, en, cat, brand, price, stock, h7, delta, tags, blurb, reqStr, specStr] = row;
  const isBoard = cat === 'board';
  /* 主控行把能力矩阵写在第 13 个字段（specStr），外设行写的是 req（第 12 个）与规格（第 13 个） */
  const capsRaw = isBoard ? _kv(specStr) : null;
  const req = isBoard ? {} : _kv(reqStr);
  const specs = isBoard ? _boardSpecs(capsRaw) : _specs(specStr);

  const caps = isBoard ? {
    i2c: _num(capsRaw.i2c, 0), spi: _num(capsRaw.spi, 0), uart: _num(capsRaw.uart, 0),
    gpio: _num(capsRaw.gpio, 0), pwm: _num(capsRaw.pwm, 0), adc: _num(capsRaw.adc, 0),
    i2s: _num(capsRaw.i2s, 0), csi: _num(capsRaw.csi, 0),
    v: _num(capsRaw.v, 3.3), cls: _num(capsRaw.cls, 0),
    mA5: _num(capsRaw.mA5, 0), mA33: _num(capsRaw.mA33, 0),
    wifi: capsRaw.wifi === '1', ble: capsRaw.ble === '1',
    can: capsRaw.can === '1', usb: capsRaw.usb === '1',
  } : null;

  const mcu = isBoard ? capsRaw.mcu || null : null;
  const flash = isBoard ? capsRaw.flash || null : null;

  return {
    id, name, en, cat, brand,
    price: Number(price), stock: Number(stock),
    tags: String(tags).split('|').filter(Boolean),
    blurb,
    req: isBoard
      ? { bus: 'none', cls: 0, v: caps.v, pins: 0, mA: 0, peak: 0 }
      : {
        bus: req.bus || 'none',
        addr: req.addr ? parseInt(req.addr, 16) : null,
        addrHex: req.addr || null,
        v: req.v || null,
        mA: _num(req.mA, 0),
        peak: _num(req.peak, _num(req.mA, 0)),
        cls: _num(req.cls, 0),
        pins: _num(req.pins, 0),
        proto: req.proto && req.proto !== 'none' ? req.proto : null,
        driver: req.driver === '1',
        ext: req.ext === '1',
        rail: req.rail ? parseFloat(req.rail) : null,
        kind: req.kind || null,
        vout: req.vout ? parseFloat(req.vout) : null,
        aout: req.aout ? parseFloat(req.aout) : null,
        mah: req.mah ? _num(req.mah, 0) : 0,
      },
    caps, specs, mcu, flash,
    /* 热度：h7 为 7 日指数（0–100），delta 为环比百分比；d30 由二者反推，保证三个数字自洽 */
    heat: {
      d7: Number(h7),
      d30: Math.max(1, Math.round(Number(h7) / (1 + Number(delta) / 100) * 10) / 10),
      delta: Number(delta),
    },
    kind: 'module',
  };
}

const MODULES = [...BOARD_ROWS, ...PART_ROWS].map(buildModule);
const MODULE_MAP = Object.fromEntries(MODULES.map(m => [m.id, m]));
const BOARDS = MODULES.filter(m => m.cat === 'board');
const PARTS = MODULES.filter(m => m.cat !== 'board');

/* ---------- 协议元信息 ---------- */
const PROTO_META = {
  wifi:   { label: 'WiFi',   note: '主控需内置 WiFi 或加装联网模块' },
  ble:    { label: 'BLE',    note: '主控需支持蓝牙或加装蓝牙模块' },
  lora:   { label: 'LoRa',   note: '需 SPI 总线 + 天线，模块独立提供' },
  '4g':   { label: '4G Cat-1', note: '需 UART + 峰值 2A 独立 5V 供电' },
  nb:     { label: 'NB-IoT', note: '需 UART + 独立 3.3V 供电' },
  eth:    { label: '以太网', note: '需 SPI 总线，占用较多引脚' },
  rs485:  { label: 'RS485',  note: '需 UART + 方向控制引脚' },
  can:    { label: 'CAN',    note: '主控需内置 CAN 控制器（如 STM32）' },
  gnss:   { label: 'GNSS',   note: '需 UART + 有源天线，室内不可用' },
  zigbee: { label: 'ZigBee', note: '需 UART + 协调器规划' },
};

/* ---------- 目标用户画像 ---------- */
const PERSONAS = [
  {
    id: 'student', icon: 'cap', name: '创客学生 / 教学场景', tag: '低成本试错',
    pain: '不知道自己手里的板子能接什么，买回来发现电压不对、接口不够、例程跑不通。',
    need: '明确的兼容性提示 + 最低价入门组合 + 可复现的装配说明。',
    value: '选型校验引擎在加购时即时拦截 5V/3.3V 电平与总线数量错误，把「买错」的成本降到零。',
    budget: '单方案 ¥100 – ¥400',
  },
  {
    id: 'engineer', icon: 'wrench', name: '嵌入式 / 硬件工程师', tag: '快速打样',
    pain: '手动核对引脚分配、I2C 地址冲突与功耗预算，一轮打样要花掉两三天。',
    need: '引脚资源自动分配、地址冲突检测、功耗与供电预算、BOM 一键导出。',
    value: '工作台实时输出资源占用表与冲突报告，方案可直接导出 JSON/CSV 进 BOM 与采购流程。',
    budget: '单方案 ¥800 – ¥6,000',
  },
  {
    id: 'startup', icon: 'rocket', name: '硬件初创 / 产品验证', tag: '小批量交付',
    pain: '需要 10–100 台样机，但每台都要重新配货、下单、跟物流，供应链碎片化。',
    need: '方案可复用、支持批量下单、定制外壳与 PCB 打样、订单全流程可视化。',
    value: '方案保存为模板可反复下单，后台支持批量备货与发货，微信/支付宝收款直达。',
    budget: '单批 ¥5,000 – ¥80,000',
  },
  {
    id: 'educator', icon: 'book', name: '培训机构 / 实验室采购', tag: '标准套件',
    pain: '要给几十名学生配同一套器材，规格必须完全一致，还要能开发票走报销。',
    need: '标准化方案模板、统一 BOM、批量下单、发票与对公付款。',
    value: '平台预设教学方案模板，一键复制生成统一 BOM，支持对公转账与增值税发票。',
    budget: '单批 ¥3,000 – ¥30,000',
  },
  {
    id: 'hobbyist', icon: 'sparkle', name: '极客爱好者 / DIY', tag: '兴趣探索',
    pain: '想法很多但不确定可行性，容易堆一堆用不上的模块在抽屉里。',
    need: '按场景推荐组合（智能家居 / 机器人 / 环境监测）、难度与工时预估。',
    value: '场景化方案模板 + 难度评分 + 装配工时预估，先看可行性再花钱。',
    budget: '单方案 ¥200 – ¥1,500',
  },
];

/* ---------- 完整使用流程 ---------- */
const FLOW = [
  { n: '01', id: 'browse',   title: '浏览模块库',   actor: '用户', desc: '按 8 大分类或关键词检索，用接口类型、供电电压、价格区间快速收敛候选集。', out: '候选模块列表' },
  { n: '02', id: 'inspect',  title: '查看参数详情', actor: '用户', desc: '阅读完整规格表、供电需求、总线占用与实测场景；系统即时提示与当前方案的兼容性。', out: '规格认知' },
  { n: '03', id: 'compose',  title: '选型与组合',   actor: '用户', desc: '把模块加入工作台，逐区配置主控 / 传感器 / 执行器 / 电源；可替换、调数量、命名方案。', out: '草稿方案' },
  { n: '04', id: 'validate', title: '自动校验',     actor: '系统', desc: '校验总线数量、IO 占用、电平匹配、I2C 地址冲突、功耗预算、算力档位与驱动/外接电源依赖。', out: '兼容性报告' },
  { n: '05', id: 'summary',  title: '方案预览与汇总', actor: '系统', desc: '生成资源占用表、功耗估算、成本合计、难度评分与装配工时，可导出 BOM。', out: '方案清单' },
  { n: '06', id: 'order',    title: '下单',         actor: '用户', desc: '填写收货信息与发票需求，确认清单后创建订单，获得订单号与支付倒计时。', out: '待付款订单' },
  { n: '07', id: 'pay',      title: '付款',         actor: '用户', desc: '选择微信支付或支付宝，扫码完成支付；支付结果由服务端异步回调确认。', out: '已付款订单' },
  { n: '08', id: 'fulfil',   title: '后台处理',     actor: '平台', desc: '后台确认收款、生成配货单、逐项备货、录入快递单号并发货。', out: '已发货订单' },
  { n: '09', id: 'receive',  title: '收货与完成',   actor: '用户', desc: '前台查询物流轨迹，确认收货后订单完成；可对方案复购或改为模板。', out: '已完成订单' },
];

/* ---------- 核心功能模块定义 ---------- */
const FEATURES = [
  { id: 'F1', icon: 'grid',   name: '硬件分类浏览', pages: 'catalog.html', desc: '8 大分类 + 多维筛选（关键词 / 接口 / 供电 / 价格 / 排序），支持卡片与紧凑两种视图。' },
  { id: 'F2', icon: 'doc',    name: '模块参数详情', pages: 'module.html',  desc: '完整规格表、接口与协议、供电需求、库存与热度；结合当前方案实时给出兼容性结论与替代推荐。' },
  { id: 'F3', icon: 'sliders',name: '自定义选型与组合', pages: 'builder.html', desc: '三栏工作台，按功能分区装配方案；支持增删改数量、替换、命名、保存草稿与导出。' },
  { id: 'F4', icon: 'shield', name: '兼容性校验引擎', pages: 'builder.html', desc: '9 条规则覆盖总线数量、IO 占用、电平匹配、I2C 地址冲突、功耗预算、算力档位、协议、驱动与外接电源。' },
  { id: 'F5', icon: 'list',   name: '方案预览与汇总', pages: 'builder.html / checkout.html', desc: '资源占用表、功耗估算、成本明细、难度评分、装配工时与 BOM 导出。' },
  { id: 'F6', icon: 'flame',  name: '选型热度',  pages: 'index.html / catalog.html', desc: '7 日 / 30 日双维度指数、环比涨跌、分类热度聚合、迷你趋势线，并融合本机真实选型行为。' },
  { id: 'F7', icon: 'cart',   name: '下单与付款', pages: 'checkout.html / pay.html', desc: '收货信息校验、订单创建、微信支付与支付宝双通道、支付倒计时与状态轮询、服务端回调确认。' },
  { id: 'F8', icon: 'console',name: '后台处理',  pages: 'admin.html', desc: '订单看板、状态流转（待付款→已付款→备货→发货→完成）、快递录入、库存调整、CSV/JSON 导出。' },
];

/* ---------- 热度模块元信息（示意数据说明） ---------- */
const HEAT_META = {
  title: '选型热度（示意）',
  disclaimer: '本模块为演示数据。热度指数由「平台侧需求分布基线」与「本机真实选型行为」加权合成，用于验证排序、筛选与图表链路，不代表真实市场数据。',
  formula: '热度 = clamp( 基线需求指数 × 0.7 + 本机选型加权 × 0.3 , 0 , 100 )',
  seedNote: '基线需求指数为静态种子数据（见 assets/js/data.js 的 heat 字段）；本机选型加权来自 localStorage 中记录的加购与浏览行为。',
  prodNote: '生产环境替换方式：把 window.Mosaic.heat.record() 埋点上报到服务端（如 /api/analytics/heat），热度列表改为请求 /api/heat?range=7d 返回，其余渲染逻辑不变。',
  ranges: [
    { id: '7d', label: '近 7 日', key: 'd7' },
    { id: '30d', label: '近 30 日', key: 'd30' },
  ],
};

/* ---------- 支付渠道 ---------- */
const PAY_CHANNELS = [
  {
    id: 'wechat', name: '微信支付', en: 'WeChat Pay', tone: '#1aad19', mode: 'Native 扫码支付',
    desc: '服务端调用 V3 统一下单获取 code_url，前端渲染二维码；支付结果通过异步通知回调确认。',
    steps: ['服务端 POST /v3/pay/transactions/native 下单', '返回 code_url 生成二维码', '用户扫码支付', '微信回调 /api/pay/wechat/notify 验签后置为已付款'],
    required: ['商户号 mchid', 'APIv3 密钥', '商户私钥 apiclient_key.pem', '证书序列号'],
  },
  {
    id: 'alipay', name: '支付宝', en: 'Alipay', tone: '#1677ff', mode: '当面付 · 预下单',
    desc: '服务端调用 alipay.trade.precreate 获取 qr_code；支付结果通过 notify_url 异步通知确认。',
    steps: ['服务端 alipay.trade.precreate 预下单', '返回 qr_code 生成二维码', '用户扫码支付', '支付宝回调 /api/pay/alipay/notify 验签后置为已付款'],
    required: ['AppID', '应用私钥', '支付宝公钥', '网关地址 openapi.alipay.com'],
  },
  {
    id: 'mock', name: '演示模式', en: 'Demo', tone: '#a78bfa', mode: '本地模拟回调',
    desc: '不产生真实资金往来。用于验证下单 → 付款 → 后台流转的完整链路，可手动触发「模拟支付成功」。',
    steps: ['本地生成订单与二维码占位', '点击「模拟支付成功」', '本地状态置为已付款', '后台立即可见并继续流转'],
    required: ['无需任何资质'],
  },
];

/* ---------- 配送与计费规则 ---------- */
const SHIPPING = {
  freeThreshold: 299,
  fee: 15,
  remoteFee: 30,
  remoteProvinces: ['新疆', '西藏', '内蒙古', '青海', '宁夏', '甘肃', '海南'],
  assemblyFee: 39,          /* 代装配服务费 */
  rushFeeRate: 0.15,        /* 加急系数 */
  etaDays: { normal: '3–5', rush: '1–2' },
};

/* ---------- 订单状态机 ---------- */
const ORDER_STATES = [
  { id: 'pending',   name: '待付款', tone: 'warn',   desc: '订单已创建，等待用户完成支付' },
  { id: 'paid',      name: '已付款', tone: 'accent', desc: '支付成功，等待平台确认与配货' },
  { id: 'picking',   name: '备货中', tone: 'blue',   desc: '后台正在逐项拣货与质检' },
  { id: 'shipped',   name: '已发货', tone: 'ok',     desc: '已交付物流，可在前台查询单号' },
  { id: 'done',      name: '已完成', tone: 'ok',     desc: '用户确认收货，订单结束' },
  { id: 'cancelled', name: '已取消', tone: 'danger', desc: '超时未支付或用户主动取消' },
  { id: 'refunded',  name: '已退款', tone: 'danger', desc: '已发起退款并完成退款流程' },
];
const STATE_MAP = Object.fromEntries(ORDER_STATES.map(s => [s.id, s]));

/* 状态流转允许的动作 */
const ORDER_ACTIONS = {
  pending:   [{ to: 'paid', label: '确认收款', kind: 'primary' }, { to: 'cancelled', label: '取消订单', kind: 'danger' }],
  paid:      [{ to: 'picking', label: '开始备货', kind: 'primary' }, { to: 'refunded', label: '退款', kind: 'danger' }],
  picking:   [{ to: 'shipped', label: '发货', kind: 'primary', needTracking: true }, { to: 'refunded', label: '退款', kind: 'danger' }],
  shipped:   [{ to: 'done', label: '标记完成', kind: 'primary' }],
  done:      [], cancelled: [], refunded: [],
};

/* 平台口径 */
const SITE = {
  name: 'MOSAIC',
  cn: '拼造',
  tagline: '把模块，拼成你想要的硬件。',
  desc: '在线选型、自动校验、一键下单的硬件定制平台。',
  version: 'v1.0.0',
  updated: '2026-10-13',
  currency: '¥',
};

/* 导出（同时挂到 window，便于无模块环境直接使用） */
const MosaicData = {
  SITE, CATEGORIES, CAT_ORDER, MODULES, MODULE_MAP, BOARDS, PARTS,
  CLASS_LABEL, CLASS_DESC, PROTO_META, PERSONAS, FLOW, FEATURES,
  HEAT_META, PAY_CHANNELS, SHIPPING, ORDER_STATES, STATE_MAP, ORDER_ACTIONS,
};
if (typeof window !== 'undefined') window.MosaicData = MosaicData;
if (typeof module !== 'undefined' && module.exports) module.exports = MosaicData;
