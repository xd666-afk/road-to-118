import type { Module, Upgrade } from './types';
export const REACTORS = [
  { id: 1, roman: 'I', name: '自由碰撞容器', subtitle: 'FREE COLLISION CHAMBER', range: 'H — Be', softMax: 4, anchor: 2, p: .04, q: .2, h: .2, k: .25, samples: 2, cap: 14, gain: 1, buildCoins: 0, buildData: 0, unlock: 1, description: '从两颗氢原子开始。观察混合粒子，用自由碰撞积累碰撞能。' },
  { id: 2, roman: 'II', name: '受控反应容器', subtitle: 'CONTROLLED REACTION VESSEL', range: 'Be — N', softMax: 7, anchor: 4, p: .008, q: .2, h: .15, k: 2, samples: 16, cap: 42, gain: 6, buildCoins: 4000, buildData: 3600, unlock: 4, description: '电磁约束与独立反应控制，让中段元素研究突破旧容器的瓶颈。' },
  { id: 3, roman: 'III', name: '先进核反应装置', subtitle: 'ADVANCED RESEARCH STATION', range: 'N — Ne', softMax: 10, anchor: 7, p: .001, q: .22, h: .15, k: 8, samples: 32, cap: 180, gain: 32, buildCoins: 180000, buildData: 85000, unlock: 7, description: '高吞吐实验与并行生产，向氖的最终发现和正式收录推进。' },
] as const;
export const UPGRADES: Record<Upgrade, { name: string; base: number; ratio: number; description: string }> = {
  atoms: { name: '补充氢样本', base: 10, ratio: 1.17, description: '活跃样本 +1，氢库存 +1' },
  speed: { name: '粒子加速', base: 60, ratio: 1.4, description: '运动速率递增，受设备处理上限约束' },
  yield: { name: '碰撞收益', base: 500, ratio: 1.65, description: '每次有效实验收益 ×1.35' },
  capacity: { name: '设备扩容', base: 2500, ratio: 1.85, description: 'II / III 型处理上限 ×1.18' },
};
export const MODULES: Record<Module, { name: string; description: string; unlock: number; coins: number; data: number }> = {
  feed: { name: '原料补充', description: '每秒按保留预算自动购买氢样本；样本与档案库存分开。', unlock: 4, coins: 1200, data: 250 },
  reaction: { name: '自动反应', description: '已发现元素启用并行批量生产：I / II / III 型为 8 / 32 / 32 倍；首次探索保持基础概率。', unlock: 4, coins: 4000, data: 500 },
  allocation: { name: '元素分配', description: '自动分批提交库存；累计 50 单位后停止收录，保留后续产物。', unlock: 7, coins: 20000, data: 1500 },
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
  { id: 'complete', name: '第十号里程碑', description: '提交 50 Ne，完成 v0.1', hidden: false },
  { id: 'collection', name: '十种元素，一本档案', description: '点亮 H — Ne 全部十格', hidden: false },
  { id: 'impossible', name: '不可能的碰撞', description: '使用 I 型容器成功合成硼', hidden: true },
  { id: 'limit', name: '超越设计极限', description: '使用 I 型容器成功合成碳', hidden: true },
  { id: 'old', name: '旧时代的奇迹', description: '使用 II 型容器成功合成氧或更高元素', hidden: true },
  { id: 'upstream', name: '逆流而上', description: '低级容器成功合成超出其推荐上限至少 2 的元素', hidden: true },
] as const;
export const OFFLINE_LIMIT = 4 * 60 * 60;

