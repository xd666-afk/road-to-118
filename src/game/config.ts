import type { Module, Upgrade } from './types';
export const GAME_VERSION = '0.2.3';
export const PLAYABLE_ELEMENTS = 20;
export const FINAL_ELEMENT = 20;
export const REACTORS = [
  { id: 1, roman: 'I', name: '自由碰撞容器', subtitle: 'FREE COLLISION CHAMBER', range: 'H — Be', softMax: 4, anchor: 2, p: .075, q: .25, h: .2, k: .65, samples: 2, cap: 14, gain: 1, buildCoins: 0, buildData: 0, unlock: 1, description: '从两颗氢原子开始。观察混合粒子，用自由碰撞积累碰撞能。' },
  { id: 2, roman: 'II', name: '受控反应容器', subtitle: 'CONTROLLED REACTION VESSEL', range: 'Be — N', softMax: 7, anchor: 4, p: .012, q: .32, h: .15, k: 2, samples: 16, cap: 42, gain: 6, buildCoins: 600, buildData: 400, unlock: 4, description: '电磁约束与独立反应控制，让中段元素研究突破旧容器的瓶颈。' },
  { id: 3, roman: 'III', name: '先进核反应装置', subtitle: 'ADVANCED RESEARCH STATION', range: 'N — Ne', softMax: 10, anchor: 7, p: .0025, q: .25, h: .15, k: 8, samples: 32, cap: 180, gain: 32, buildCoins: 25000, buildData: 18000, unlock: 7, description: '高频实验与并行生产，向氖的最终发现和正式收录推进。' },
  { id: 4, roman: 'IV', name: '离子束反应器', subtitle: 'ION BEAM REACTOR', range: 'Na — Ar', softMax: 18, anchor: 11, p: .0009, q: .48, h: .15, k: 12, samples: 48, cap: 1200, gain: 140, buildCoins: 250000, buildData: 90000, unlock: 10, description: '定向离子束开启钠到氩的新一轮探索。' },
  { id: 5, roman: 'V', name: '回旋加速器', subtitle: 'CYCLOTRON', range: 'K — Ca', softMax: 20, anchor: 19, p: .000025, q: .55, h: .15, k: 20, samples: 64, cap: 4000, gain: 1400, buildCoins: 4000000, buildData: 600000, unlock: 18, description: '更高能级的束流，向钾与钙的阶段终点推进。' },
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
  { id: 'calcium_complete', name: '第二十号里程碑', description: '提交 50 Ca，完成 v0.2', hidden: false },
  { id: 'twenty_collection', name: '二十种元素的档案', description: '点亮 H — Ca 全部二十格', hidden: false },
  { id: 'impossible', name: '不可能的碰撞', description: '使用 I 型容器成功合成硼', hidden: true },
  { id: 'limit', name: '超越设计极限', description: '使用 I 型容器成功合成碳', hidden: true },
  { id: 'old', name: '旧时代的奇迹', description: '使用 II 型容器成功合成氧或更高元素', hidden: true },
  { id: 'upstream', name: '逆流而上', description: '低级容器成功合成超出其推荐上限至少 2 的元素', hidden: true },
] as const;
export const OFFLINE_LIMIT = 4 * 60 * 60;

