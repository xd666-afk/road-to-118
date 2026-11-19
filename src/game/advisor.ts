import { ARCHIVE_UNITS, CALCIUM_ELEMENT, MODULES, PLAYABLE_ELEMENTS, REACTORS, UPGRADES, XENON_ELEMENT } from './config';
import { element } from '../data/elements';
import { archivedCount, discoveredMax, highestReactor, type Engine } from './engine';
import { eventRate, income, price } from './economy';
import type { GameState, Module, Upgrade } from './types';
import { abilityBonuses } from './abilityProgress';
import { discoveryStage, observationProgress, stageReadiness } from './discovery';

export interface Advice {
  id: string; label: string; detail: string; enabled: boolean;
  action: 'buy' | 'upgrade' | 'resume' | 'research' | 'build' | 'explore' | 'produce' | 'deposit' | 'archive' | 'table';
  reactor?: number; target?: number; module?: Module; upgrade?: Upgrade;
}

function fasterConstruction(s: GameState, next: { buildCoins: number; buildData: number; roman: string }): Advice | undefined {
  const running = s.reactors.filter(r => r.built && r.active);
  const bonus = abilityBonuses(s);
  const energyBoost = 1 + bonus.energy / 100;
  const dataBoost = 1 + bonus.data / 100;
  const coinsPerSecond = running.reduce((sum, r) => sum + income(r).toNumber(), 0) * energyBoost;
  const dataPerSecond = running.reduce((sum, r) => sum + eventRate(r).toNumber(), 0) * dataBoost;
  if (!coinsPerSecond || !dataPerSecond) return;
  const coinsMissing = next.buildCoins - s.coins.toNumber();
  const dataMissing = Math.max(0, next.buildData - s.data.toNumber());
  const wait = Math.max(coinsMissing / coinsPerSecond, dataMissing / dataPerSecond);
  if (!Number.isFinite(wait) || wait < 30) return;
  let best: Advice | undefined;
  let bestTime = wait - 8;
  for (const r of running) for (const key of ['yield', 'capacity', 'speed', 'atoms'] as const) {
    if (key === 'capacity' && r.id === 1) continue;
    const cost = price(r, key);
    if (cost.gt(s.coins) || r.upgrades[key] >= 1e7) continue;
    const upgraded = { ...r, upgrades: { ...r.upgrades, [key]: r.upgrades[key] + 1 } };
    const extraCoins = income(upgraded).minus(income(r)).toNumber() * energyBoost;
    const extraData = eventRate(upgraded).minus(eventRate(r)).toNumber() * dataBoost;
    const seconds = Math.max((coinsMissing + cost.toNumber()) / (coinsPerSecond + extraCoins), dataMissing / (dataPerSecond + extraData));
    if (seconds >= bestTime) continue;
    bestTime = seconds;
    best = {
      id: `fund-${next.roman}-${r.id}-${key}-${r.upgrades[key]}`, label: `升级 ${REACTORS[r.id - 1].roman} 级 · ${UPGRADES[key].name}`,
      detail: `花费 ${Math.ceil(cost.toNumber()).toLocaleString('zh-CN')} 碰撞能买 1 级，按当前产速可更快凑齐 ${next.roman} 级仪器。`,
      action: 'upgrade', enabled: true, reactor: r.id, upgrade: key,
    };
  }
  return best;
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
    const h = s.elements[0], enough = h.inventory.gte(ARCHIVE_UNITS - h.deposited), running = s.reactors[0].target === 1 && s.reactors[0].active;
    return { id: 'first-archive', label: enough ? '提交并点亮 H' : running ? '氢样本正在生产…' : '让 I 型生产氢样本', detail: `档案 ${h.deposited}/${ARCHIVE_UNITS}；库存 ${Math.floor(h.inventory.toNumber())}。累计提交 ${ARCHIVE_UNITS} 单位即可永久点亮。`, enabled: enough || !running, action: enough ? 'deposit' : 'produce', reactor: 1, target: 1 };
  }
  const ne = s.elements[9], ca = s.elements[CALCIUM_ELEMENT - 1], xe = s.elements[XENON_ELEMENT - 1];
  // Ne is a historical checkpoint: with Ca still undiscovered, finish this
  // archive before further exploration. A higher reactor that is already
  // affordable still gets built first.
  const neStage = ne.discovered && !ne.archived && !ca.discovered;
  const neProducer = s.reactors.filter(r => r.built && REACTORS[r.id - 1].softMax >= 10).at(-1);
  if (next && neStage && (canBuild || !neProducer)) return build();
  if (neStage) {
    const suitable = neProducer ?? top;
    const enough = ne.inventory.gte(ARCHIVE_UNITS - ne.deposited), running = suitable.target === 10 && suitable.active;
    return { id: 'neon', label: enough ? '提交氖的记录' : running ? '氖正在生产…' : '生产氖 · 收录档案', detail: `氖档案 ${ne.deposited}/${ARCHIVE_UNITS}；库存 ${Math.floor(ne.inventory.toNumber())}。使用 ${REACTORS[suitable.id - 1].roman} 级仪器真实生产氖，累计提交 ${ARCHIVE_UNITS} 份完成这一历史节点。`, enabled: enough || !running, action: enough ? 'deposit' : 'produce', reactor: suitable.id, target: 10 };
  }
  // Calcium remains the twentieth milestone. It is intentionally not labelled
  // as the end of the version; VI opens on discovery and zinc/krypton continue.
  if (ca.discovered && !ca.archived && max <= CALCIUM_ELEMENT) {
    const producer = s.reactors.filter(r => r.built && REACTORS[r.id - 1].softMax >= CALCIUM_ELEMENT).at(-1) ?? top;
    const enough = ca.inventory.gte(ARCHIVE_UNITS - ca.deposited), running = producer.target === CALCIUM_ELEMENT && producer.active;
    return { id: 'calcium', label: enough ? '提交钙的记录' : running ? '钙正在生产…' : '生产钙 · 保留第二十号里程碑', detail: `钙档案 ${ca.deposited}/${ARCHIVE_UNITS}；库存 ${Math.floor(ca.inventory.toNumber())}。提交 ${ARCHIVE_UNITS} Ca 只保留历史里程碑，之后仍需建造 VI 级仪器并继续到氙。`, enabled: enough || !running, action: enough ? 'deposit' : 'produce', reactor: producer.id, target: CALCIUM_ELEMENT };
  }
  // VI and VII are required range transitions. VIII is an optional post-Xe
  // capacity instrument and should not block the final archive sweep.
  if (next && (next.id <= 7 || (next.id === 8 && xe.archived && archivedCount(s) === PLAYABLE_ELEMENTS && canBuild))) {
    if (!canBuild && next.id >= 6) return fasterConstruction(s, next) ?? build();
    return build();
  }
  if (max < PLAYABLE_ELEMENTS) {
    const stage = discoveryStage(max + 1);
    if (stage) {
      const { reactor, capacity, tuning, archived, tuned } = stageReadiness(s, stage);
      const device = REACTORS[stage.reactor - 1], target = max + 1;
      if (!tuned) {
        const upgrade = capacity < stage.capacity || price(reactor, 'capacity').lt(price(reactor, 'yield')) ? 'capacity' : 'yield';
        const cost = price(reactor, upgrade);
        const detail = `扩容 ${capacity}/${stage.capacity} · 调校 ${tuning}/${stage.tuning}（扩容＋单次收益）。`;
        return { id: `tune-${device.id}-${upgrade}-${reactor.upgrades[upgrade]}`, label: `培养 ${device.roman} 级 · ${UPGRADES[upgrade].name}`, detail: detail + (s.coins.gte(cost) ? '' : `还差 ${Math.ceil(cost.minus(s.coins).toNumber()).toLocaleString('zh-CN')} 碰撞能。`), enabled: s.coins.gte(cost), action: 'upgrade', reactor: device.id, upgrade };
      }
      if (!archived) {
        const z = stage.specimen, sample = s.elements[z - 1];
        const producer = s.reactors.find(r => r.built && REACTORS[r.id - 1].softMax >= z) ?? reactor;
        const enough = sample.inventory.gte(ARCHIVE_UNITS - sample.deposited);
        const producing = producer.active && producer.target === z && !producer.exploring;
        const symbol = element(z).symbol;
        return { id: `calibration-${z}`, label: enough ? `收录 ${symbol} · 开放探索` : producing ? `正在生产 ${symbol}` : `生产校准样本 · ${symbol}`,
          detail: `收录 ${symbol} 至 ${ARCHIVE_UNITS} 份，开放 ${element(stage.from).symbol}–${element(stage.to).symbol}。已提交 ${sample.deposited}/${ARCHIVE_UNITS}，库存 ${Math.floor(sample.inventory.toNumber())}。`,
          enabled: enough || !producing, action: enough ? 'deposit' : 'produce', target: z, reactor: producer.id };
      }
      const running = reactor.active && reactor.target === target && reactor.exploring;
      return { id: `observe-${target}`, label: running ? `正在研究 · ${element(target).symbol}` : `开始研究 · ${element(target).symbol}`,
        detail: running ? `观测进度 ${Math.floor(observationProgress(s, target) * 100)}%。升级扩容可缩短观测时间。` : `${device.roman} 级已校准，可开始累积观测进度。`,
        enabled: !running, action: 'explore', target, reactor: device.id };
    }
    const waiting = top.active && top.exploring && top.target === max + 1;
    return { id: 'explore', label: waiting ? `正在探索 ${element(max + 1).symbol}` : `继续探索 · ${element(max + 1).symbol}`, detail: waiting ? '每次实验都有机会发现新元素。等待期间可升级设备；平均等待并非倒计时。' : '让最高级仪器连续探索新元素，首次发现后自动前往下一种。钙、锌和氪都只是路线节点。', enabled: !waiting, action: 'explore', reactor: top.id, target: max + 1 };
  }
  if (!xe.archived) {
    const producer = s.reactors.filter(r => r.built && REACTORS[r.id - 1].softMax >= XENON_ELEMENT).at(-1) ?? top;
    const enough = xe.inventory.gte(ARCHIVE_UNITS - xe.deposited), running = producer.target === XENON_ELEMENT && producer.active;
    return { id: 'xenon', label: enough ? '提交氙的记录' : running ? '氙正在生产…' : '生产氙 · 点亮第五十四号', detail: `氙档案 ${xe.deposited}/${ARCHIVE_UNITS}；库存 ${Math.floor(xe.inventory.toNumber())}。氙是本版终点，但提交 ${ARCHIVE_UNITS} Xe 之后还要补齐 H–Xe 的全部五十四格。`, enabled: enough || !running, action: enough ? 'deposit' : 'produce', reactor: producer.id, target: XENON_ELEMENT };
  }
  const archived = archivedCount(s);
  if (archived < PLAYABLE_ELEMENTS) {
    if (!s.modules.allocation) return research('allocation');
    if (s.automation.mode === 'archive' && s.automation.reaction && s.automation.allocation && s.automation.allocationScope === 'all') {
      return { id: 'archive-running', label: '查看收录进度', detail: `仪器正在补齐 H–Xe 档案 · ${archived}/${PLAYABLE_ELEMENTS}。每点亮一格，对应能力立即生效。`, enabled: true, action: 'table' };
    }
    return { id: 'archive-sweep', label: `补齐 H–Xe 档案 · ${archived}/${PLAYABLE_ELEMENTS}`, detail: '切换到收录优先，各代仪器会分工生产，元素分配模块自动提交库存。', enabled: true, action: 'archive' };
  }
  return { id: 'collection', label: 'H–Xe 已完整收录', detail: `已收录 ${archived}/${PLAYABLE_ELEMENTS}。第 55–118 号只作为未来研究目标显示，本版没有宣称它们已开放或已测试。`, enabled: true, action: 'table' };
}

export function applyAdvice(e: Engine, advice: Advice): void {
  // Re-evaluate before applying so an old view cannot spend on an obsolete recommendation.
  const current = recommend(e.state);
  if (current.id !== advice.id || current.label !== advice.label || !current.enabled) return;
  if (current.action === 'resume') e.state.reactors.filter(r => r.built).forEach(r => { r.active = true; });
  if (current.action === 'buy') e.buy(current.reactor!, 'atoms', 1);
  if (current.action === 'upgrade') e.buy(current.reactor!, current.upgrade!, 1);
  if (current.action === 'research') e.research(current.module!);
  if (current.action === 'build') e.build(current.reactor!);
  if (current.action === 'deposit') e.deposit(current.target!);
  if (current.action === 'archive') {
    e.state.automation.reaction = true;
    e.state.automation.allocation = true;
    e.state.automation.allocationScope = 'all';
    e.setMode('archive');
  }
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
