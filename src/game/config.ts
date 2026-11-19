import type { Module, Upgrade } from './types';
export const GAME_VERSION = '0.5.0';
/** Current playable range is H–Xe (1–54). Elements 55–118 stay visible as future research. */
export const PLAYABLE_ELEMENTS = 54;
export const FINAL_ELEMENT = 54;
export const XENON_ELEMENT = 54;
export const CALCIUM_ELEMENT = 20;
export const SAVE_VERSION = 3;
export const REACTORS = [
  { id: 1, roman: 'I', name: '自由碰撞容器', subtitle: 'FREE COLLISION CHAMBER', range: 'H — Be', softMax: 4, anchor: 2, p: .075, q: .25, h: .2, k: .65, samples: 2, cap: 14, gain: 1, buildCoins: 0, buildData: 0, unlock: 1, description: '从两颗氢原子开始。观察混合粒子，用自由碰撞积累碰撞能。' },
  { id: 2, roman: 'II', name: '受控反应容器', subtitle: 'CONTROLLED REACTION VESSEL', range: 'Be — N', softMax: 7, anchor: 4, p: .012, q: .32, h: .15, k: 2, samples: 16, cap: 42, gain: 6, buildCoins: 600, buildData: 400, unlock: 4, description: '电磁约束与独立反应控制，让中段元素研究突破旧容器的瓶颈。' },
  { id: 3, roman: 'III', name: '先进核反应装置', subtitle: 'ADVANCED RESEARCH STATION', range: 'N — Ne', softMax: 10, anchor: 7, p: .0025, q: .25, h: .15, k: 8, samples: 32, cap: 180, gain: 32, buildCoins: 25000, buildData: 18000, unlock: 7, description: '高频实验与并行生产，向氖的发现和正式收录推进。' },
  { id: 4, roman: 'IV', name: '离子束反应器', subtitle: 'ION BEAM REACTOR', range: 'Na — Ar', softMax: 18, anchor: 11, p: .0009, q: .48, h: .15, k: 12, samples: 48, cap: 1200, gain: 140, buildCoins: 400000, buildData: 125000, unlock: 10, description: '定向离子束开启钠到氩的新一轮探索。' },
  { id: 5, roman: 'V', name: '回旋加速器', subtitle: 'CYCLOTRON', range: 'K — Ca', softMax: 20, anchor: 19, p: .000025, q: .55, h: .15, k: 20, samples: 64, cap: 4000, gain: 1400, buildCoins: 6500000, buildData: 900000, unlock: 18, description: '更高能级的束流，完成钾与钙的里程碑；钙不是本版终点。' },
  { id: 6, roman: 'VI', name: '同步辐射研究环', subtitle: 'SYNCHROTRON RESEARCH RING', range: 'Sc — Kr', softMax: 36, anchor: 21, p: .00055, q: .8, h: .25, k: 5, samples: 96, cap: 10000, gain: 6000, buildCoins: 6000000000, buildData: 4200000, unlock: 20, description: '同步辐射与并行探测器推进到第四周期中段：钪到氪。' },
  { id: 7, roman: 'VII', name: '重离子储存环', subtitle: 'HEAVY-ION STORAGE RING', range: 'Rb — Xe', softMax: 54, anchor: 37, p: .00045, q: .86, h: .3, k: 8, samples: 128, cap: 20000, gain: 25000, buildCoins: 110000000000, buildData: 7800000, unlock: 36, description: '重离子束流覆盖铷到氙，把第五周期收束成完整档案。' },
  { id: 8, roman: 'VIII', name: '强子对撞环', subtitle: 'HADRON COLLIDER RING', range: 'Cs — Og', softMax: 86, anchor: 55, p: .0003, q: .9, h: .22, k: 12, samples: 160, cap: 40000, gain: 120000, buildCoins: 360000000000, buildData: 12000000, unlock: 54, description: '为未来的 55–118 号元素预留的更高能级；本版中用于持续生产与补档。' },
] as const;
export const productionParallel = (id: number) => id === 1 ? 8 : 32;
export const UPGRADES: Record<Upgrade, { name: string; base: number; ratio: number; description: string }> = {
  atoms: { name: '补充氢样本', base: 5, ratio: 1.14, description: '反应样本 +1，氢库存 +1' },
  speed: { name: '粒子加速', base: 20, ratio: 1.35, description: '提高每秒实验次数，达到设备上限后停止增长' },
  yield: { name: '单次收益', base: 60, ratio: 1.55, description: '每次实验所得碰撞能 ×1.35，不增加实验次数' },
  capacity: { name: '设备扩容', base: 2500, ratio: 1.85, description: 'II 级及以后实验速度上限 ×1.18' },
};
export const MODULES: Record<Module, { name: string; description: string; unlock: number; coins: number; data: number }> = {
  feed: { name: '原料补充', description: '自动补充样本，满负荷时停止。', unlock: 2, coins: 60, data: 30 },
  reaction: { name: '自动反应', description: '批量生产已发现元素。', unlock: 4, coins: 180, data: 80 },
  allocation: { name: '元素分配', description: '自动提交库存，收录元素。', unlock: 7, coins: 3000, data: 500 },
};
export const ACHIEVEMENTS = [
  { id: 'collision', name: '第一道信号', description: '完成第一次有效碰撞', hidden: false },
  { id: 'helium', name: '宇宙的第二种答案', description: '首次发现氦', hidden: false },
  { id: 'archive', name: '正式入档', description: '首次累计提交 50 单位并点亮元素', hidden: false },
  { id: 'bulk', name: '规模的力量', description: '一次批量购买至少 10 级升级', hidden: false },
  { id: 'reactor2', name: '控制变量', description: '建成 II 型反应容器', hidden: false },
  { id: 'automation', name: '让实验继续', description: '研发第一个工业模块', hidden: false },
  { id: 'reactor3', name: '新的能级', description: '建成 III 型核反应装置', hidden: false },
  { id: 'neon', name: '通往霓虹', description: '首次发现氖', hidden: false },
  { id: 'complete', name: '第十号里程碑', description: '提交 50 Ne，保留第一阶段里程碑', hidden: false },
  { id: 'collection', name: '十种元素，一本档案', description: '点亮 H — Ne 全部十格', hidden: false },
  { id: 'reactor4', name: '一道束流，新的边界', description: '建成 IV 级离子束反应器', hidden: false },
  { id: 'reactor5', name: '回旋的能量', description: '建成 V 级回旋加速器', hidden: false },
  { id: 'argon', name: '第三周期的句点', description: '首次发现氩', hidden: false },
  { id: 'calcium', name: '通往第二十号', description: '首次发现钙', hidden: false },
  { id: 'calcium_complete', name: '第二十号里程碑', description: '提交 50 Ca，保留第二十号里程碑并继续向氙推进', hidden: false },
  { id: 'twenty_collection', name: '二十种元素的档案', description: '点亮 H — Ca 全部二十格', hidden: false },
  { id: 'reactor6', name: '同步辐射的窗口', description: '建成 VI 级同步辐射研究环', hidden: false },
  { id: 'zinc', name: '第三十号的中场', description: '首次发现锌：第 30 号不是终点，继续向氪与氙推进', hidden: false },
  { id: 'krypton', name: '第四周期的句点', description: '首次发现氪：第四周期结束，第五周期仍在前面', hidden: false },
  { id: 'reactor7', name: '重离子束流', description: '建成 VII 级重离子储存环', hidden: false },
  { id: 'xenon', name: '第五十四号 · 氙', description: '首次发现氙并点亮本阶段终点', hidden: false },
  { id: 'xenon_complete', name: '氙的完整档案', description: '提交 50 Xe，保留第五十四号里程碑', hidden: false },
  { id: 'fifty_four_collection', name: '五十四种元素，一本档案', description: '点亮 H — Xe 全部五十四格', hidden: false },
  { id: 'reactor8', name: '为未来预留的能级', description: '建成 VIII 级强子对撞环', hidden: false },
  { id: 'impossible', name: '不可能的碰撞', description: '使用 I 型容器成功合成硼', hidden: true },
  { id: 'limit', name: '超越设计极限', description: '使用 I 型容器成功合成碳', hidden: true },
  { id: 'old', name: '旧时代的奇迹', description: '使用 II 型容器成功合成氧或更高元素', hidden: true },
  { id: 'upstream', name: '逆流而上', description: '低级容器成功合成超出其推荐上限至少 2 的元素', hidden: true },
] as const;
export const OFFLINE_LIMIT = 4 * 60 * 60;

