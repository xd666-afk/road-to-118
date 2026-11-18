import { MODULES, PLAYABLE_ELEMENTS, REACTORS } from './config';
import { element } from '../data/elements';
import { archivedCount, discoveredMax, highestReactor, type Engine } from './engine';
import { price } from './economy';
import type { GameState, Module } from './types';

export interface Advice {
  id: string; label: string; detail: string; enabled: boolean;
  action: 'buy' | 'resume' | 'research' | 'build' | 'explore' | 'produce' | 'deposit' | 'table';
  reactor?: number; target?: number; module?: Module;
}

/** Recommendations use the same costs and actions as the game; they never grant resources. */
export function recommend(s: GameState): Advice {
  const max = discoveredMax(s), top = highestReactor(s);
  const next = REACTORS.find(c => !s.reactors[c.id - 1].built && max >= c.unlock);
  const canBuild = next && s.coins.gte(next.buildCoins) && s.data.gte(next.buildData);
  const funding = (coins: number, data: number) => {
    const missing = [s.coins.lt(coins) ? `${Math.ceil(coins - s.coins.toNumber()).toLocaleString('zh-CN')} 碰撞能` : '', s.data.lt(data) ? `${Math.ceil(data - s.data.toNumber()).toLocaleString('zh-CN')} 点数据` : ''].filter(Boolean);
    return missing.length ? `还需 ${missing.join('、')}，实验运行时会继续积累。` : '资源已备齐，可以立即执行。';
  };
  if (!s.reactors.some(r => r.built && r.active) && !canBuild) return { id: 'resume', label: '恢复实验', detail: '所有仪器已暂停。恢复后继续积累碰撞能和研究数据。', enabled: true, action: 'resume' };
  if (s.stats.purchases === 0 && max < 4) return { id: 'first-buy', label: '补充第一份氢样本', detail: '实验正在自动运行。攒到 5 碰撞能后，补充样本，让实验更快。', enabled: s.coins.gte(price(s.reactors[0], 'atoms')), action: 'buy', reactor: 1 };
  const research = (key: Module): Advice => ({ id: `research-${key}`, label: `研发${MODULES[key].name}`, detail: funding(MODULES[key].coins, MODULES[key].data), enabled: s.coins.gte(MODULES[key].coins) && s.data.gte(MODULES[key].data), action: 'research', module: key });
  if (max >= 2 && !s.modules.feed) return research('feed');
  const build = (): Advice => ({ id: `build-${next!.id}`, label: `建造 ${next!.roman} 级仪器`, detail: funding(next!.buildCoins, next!.buildData), enabled: s.coins.gte(next!.buildCoins) && s.data.gte(next!.buildData), action: 'build', reactor: next!.id });
  if (next?.id === 2) return build();
  if (s.reactors[1].built && !s.modules.reaction) return research('reaction');
  if (archivedCount(s) === 0 && s.modules.reaction && max < 10) {
    const h = s.elements[0], enough = h.inventory.gte(50 - h.deposited), running = s.reactors[0].target === 1 && s.reactors[0].active;
    return { id: 'first-archive', label: enough ? '提交并点亮 H' : running ? '氢样本正在生产…' : '让 I 型生产氢样本', detail: `档案 ${h.deposited}/50；库存 ${Math.floor(h.inventory.toNumber())}。累计提交 50 单位即可永久点亮。`, enabled: enough || !running, action: enough ? 'deposit' : 'produce', reactor: 1, target: 1 };
  }
  if (next) return build();
  if (max < PLAYABLE_ELEMENTS) {
    const waiting = top.active && top.exploring && top.target === max + 1;
    return { id: 'explore', label: waiting ? `正在探索 ${element(max + 1).symbol}` : `继续探索 · ${element(max + 1).symbol}`, detail: waiting ? '每次实验都有机会发现新元素。等待期间可升级设备；平均等待并非倒计时。' : '让最高级仪器连续探索新元素，首次发现后自动前往下一种。', enabled: !waiting, action: 'explore', reactor: top.id, target: max + 1 };
  }
  const ca = s.elements[19];
  if (!ca.archived) {
    const enough = ca.inventory.gte(50 - ca.deposited), running = top.target === 20 && top.active;
    return { id: 'calcium', label: enough ? '提交钙的记录' : running ? '钙正在生产…' : '生产钙 · 完成阶段目标', detail: `钙档案 ${ca.deposited}/50；库存 ${Math.floor(ca.inventory.toNumber())}。生产后提交，完成本版阶段目标。`, enabled: enough || !running, action: enough ? 'deposit' : 'produce', reactor: top.id, target: 20 };
  }
  return { id: 'collection', label: '继续收录元素', detail: `已收录 ${archivedCount(s)}/20。可以继续点亮完整的前二十种元素档案。`, enabled: true, action: 'table' };
}

export function applyAdvice(e: Engine, advice: Advice): void {
  // Re-evaluate before applying so an old view cannot spend on an obsolete recommendation.
  const current = recommend(e.state);
  if (current.id !== advice.id || current.label !== advice.label || !current.enabled) return;
  if (current.action === 'resume') e.state.reactors.filter(r => r.built).forEach(r => { r.active = true; });
  if (current.action === 'buy') e.buy(current.reactor!, 'atoms', 1);
  if (current.action === 'research') e.research(current.module!);
  if (current.action === 'build') e.build(current.reactor!);
  if (current.action === 'deposit') e.deposit(current.target!);
  if (current.action === 'explore' || current.action === 'produce') {
    e.target(current.reactor!, current.target!, current.action === 'explore');
    e.state.reactors[current.reactor! - 1].active = true;
  }
}

export function openingStep(s: GameState): number {
  if (archivedCount(s) > 0 && s.modules.reaction && s.reactors[1].built) return 6;
  if (s.stats.purchases === 0 && discoveredMax(s) < 4) return 0;
  if (s.modules.reaction) return 5;
  if (s.reactors[1].built) return 4;
  if (s.modules.feed) return 3;
  if (discoveredMax(s) >= 2) return 2;
  return s.stats.purchases > 0 ? 1 : 0;
}
