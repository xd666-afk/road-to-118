import { D, Big, finiteNumber } from './numbers';
import type { Amount } from './numbers';
import { abilityBonuses } from './abilityProgress';
import { discoveryStage, observationProgress, observationRate, stageReadiness } from './discovery';
import { ACHIEVEMENTS, ARCHIVE_UNITS, CALCIUM_ELEMENT, FINAL_ELEMENT, MODULES, OFFLINE_LIMIT, PLAYABLE_ELEMENTS, REACTORS, SAVE_VERSION, XENON_ELEMENT, productionParallel } from './config';
import { coinPerEvent, eventRate, firstDiscoveryRate, maxAffordable, price, probability, usefulAtomPurchase } from './economy';
import { poisson, random, waitingHazard } from './rng';
import type { GameState, Module, Notice, ReactorJob, ReactorState, Upgrade, WorkMode } from './types';
import { element } from '../data/elements';

export function createState(seed = Date.now() >>> 0, now = Date.now()): GameState {
  const s: GameState = {
    saveVersion: SAVE_VERSION, savedAt: now, elapsed: 0, seed, rng: seed >>> 0, coins: D(0), data: D(0),
    reactors: REACTORS.map(({ id }) => ({ id, built: id === 1, active: true, target: 2, exploring: false, job: 'manual', upgrades: { atoms: 0, speed: 0, yield: 0, capacity: 0 }, events: D(0), discoveryHazard: 1, productionRemainder: D(0), eventRemainder: D(0) })),
    elements: Array.from({ length: PLAYABLE_ELEMENTS }, (_, i) => ({ discovered: i === 0, inventory: D(0), deposited: 0, archived: false, firstDiscoveredAt: i === 0 ? 0 : null, firstDiscoveredReactor: i === 0 ? 1 : null, totalProduced: D(0) })),
    modules: { feed: false, reaction: false, allocation: false },
    automation: { feed: false, reaction: false, allocation: false, reserve: D(100), mode: 'custom', target: 1, feedScope: 'latest', allocationScope: 'all' },
    stats: { events: D(0), produced: D(0), earned: D(0), peak: D(0), builds: 1, purchases: 0, lastEvent: '实验室已准备就绪', neonCompletedAt: null, calciumCompletedAt: null, xeCompletedAt: null, completedAt: null, milestones: {} },
    achievements: [], settings: { scientific: false, reducedMotion: false, guideDismissed: false, mix: [1] },
    notices: [], noticeSeq: 0,
  };
  for (const r of s.reactors) r.discoveryHazard = waitingHazard(s);
  return s;
}
export const discoveredMax = (s: GameState) => s.elements.filter(e => e.discovered).length;
export const archivedCount = (s: GameState) => s.elements.filter(e => e.archived).length;
export const highestReactor = (s: GameState) => s.reactors.filter(r => r.built).at(-1)!;
export const FIRST_HELIUM_SECONDS = 5;

export function createFirstRun(seed?: number, now?: number): GameState {
  const s = createState(seed, now);
  s.firstRun = { step: 'welcome' };
  s.reactors[0].active = false;
  s.reactors[0].target = 1;
  return s;
}

export class Engine {
  state: GameState;
  // UI notifications are transient; achievement/progression flags live in state.
  constructor(state = createState()) { this.state = state; }
  notify(kind: Notice['kind'], text: string, z?: number) {
    const s = this.state; s.stats.lastEvent = text;
    s.notices.push({ id: ++s.noticeSeq, kind, text, z });
    if (s.notices.length > 80) s.notices.splice(0, s.notices.length - 80);
  }
  award(id: string) {
    const s = this.state;
    if (s.achievements.includes(id)) return;
    s.achievements.push(id); this.notify('achievement', `成就解锁 · ${ACHIEVEMENTS.find(a => a.id === id)?.name}`);
  }
  toggleReactor(id: number) {
    const r = this.state.reactors[id - 1];
    if (!r?.built) return;
    r.active = !r.active;
    if (id === 1 && r.active && this.state.firstRun?.step === 'start') this.state.firstRun = { step: 'charge' };
  }

  beginOpening() {
    if (this.state.firstRun?.step === 'welcome') this.state.firstRun = { step: 'start' };
  }

  skipOpening() {
    const s = this.state;
    if (!s.firstRun || s.firstRun.step === 'helium') return;
    if (s.firstRun.step === 'welcome' || s.firstRun.step === 'start') s.reactors[0].active = true;
    s.firstRun = { step: 'free' };
    s.settings.guideDismissed = true;
  }

  target(id: number, z: number, exploring = false): boolean {
    if (!this.setTarget(id, z, exploring)) return false;
    const reactor = this.state.reactors[id - 1];
    if (reactor.job !== 'manual') {
      reactor.job = 'manual';
      this.state.automation.mode = 'custom';
    }
    return true;
  }

  private setTarget(id: number, z: number, exploring = false): boolean {
    const s = this.state, r = s.reactors[id - 1];
    if (!r?.built || !Number.isInteger(z) || z < 1 || z > Math.min(PLAYABLE_ELEMENTS, discoveredMax(s) + 1)) return false;
    if (id === 1 && z === 2 && s.firstRun) {
      if (s.firstRun.step === 'welcome' || s.firstRun.step === 'start' || s.firstRun.step === 'charge' || s.firstRun.step === 'sample') return false;
      if (s.firstRun.step !== 'helium') {
        s.firstRun = { step: 'helium', remaining: FIRST_HELIUM_SECONDS };
        s.settings.guideDismissed = true;
      }
      exploring = false;
    }
    if (r.target !== z) { r.discoveryHazard = waitingHazard(s); r.productionRemainder = D(0); }
    r.target = z; r.exploring = exploring; return true;
  }
  buy(id: number, key: Upgrade, count: number | 'max'): number {
    const s = this.state, r = s.reactors[id - 1];
    if (s.firstRun?.step === 'charge') return 0;
    if (!r?.built || !(key in r.upgrades) || (key === 'capacity' && id === 1)) return 0;
    const n = count === 'max' ? maxAffordable(r, key, s.coins) : Math.max(0, Math.floor(count));
    if (!n || n > 1e7 - r.upgrades[key]) return 0;
    const cost = price(r, key, n); if (cost.gt(s.coins)) return 0;
    s.coins = Big.max(0, s.coins.minus(cost)); r.upgrades[key] += n; s.stats.purchases += n;
    if (s.stats.milestones.firstUpgrade === undefined) s.stats.milestones.firstUpgrade = s.elapsed;
    if (key === 'atoms') { s.elements[0].inventory = s.elements[0].inventory.plus(n); s.elements[0].totalProduced = s.elements[0].totalProduced.plus(n); s.stats.produced = s.stats.produced.plus(n); }
    if (id === 1 && key === 'atoms' && s.firstRun?.step === 'sample') s.firstRun = { step: 'explore' };
    if (n >= 10) this.award('bulk');
    return n;
  }
  build(id: number): boolean {
    const s = this.state, r = s.reactors[id - 1], c = REACTORS[id - 1];
    if (!r || r.built || !s.elements[c.unlock - 1].discovered || s.coins.lt(c.buildCoins) || s.data.lt(c.buildData)) return false;
    s.coins = s.coins.minus(c.buildCoins); s.data = s.data.minus(c.buildData); r.built = true;
    r.target = Math.min(PLAYABLE_ELEMENTS, discoveredMax(s) + 1);
    r.exploring = s.modules.reaction && s.automation.reaction;
    if (s.modules.reaction && s.automation.mode !== 'custom') this.setMode(s.automation.mode);
    s.stats.builds++; s.stats.milestones[`reactor${id}`] = s.elapsed;
    this.award(`reactor${id}`); this.notify('info', `${c.name}已投入运行`); return true;
  }
  research(key: Module): boolean {
    const s = this.state, c = MODULES[key];
    const order: Module[] = ['feed', 'reaction', 'allocation'], index = order.indexOf(key);
    if (!c || s.modules[key] || (index > 0 && !s.modules[order[index - 1]]) || !s.elements[c.unlock - 1].discovered || s.coins.lt(c.coins) || s.data.lt(c.data)) return false;
    s.coins = s.coins.minus(c.coins); s.data = s.data.minus(c.data); s.modules[key] = true; s.automation[key] = true;
    s.stats.milestones[`module_${key}`] = s.elapsed;
    this.award('automation'); this.notify('info', `${c.name}模块已上线`); return true;
  }
  setMode(mode: WorkMode, z = this.state.automation.target) {
    const s = this.state;
    if (!s.modules.reaction || !['explore', 'produce', 'archive'].includes(mode) || !Number.isInteger(z)) return;
    s.automation.mode = mode;
    s.automation.target = Math.max(1, Math.min(discoveredMax(s), z));
    const researcher = highestReactor(s).id;
    for (const r of s.reactors) {
      if (!r.built) continue;
      r.job = mode === 'explore' ? r.id === researcher ? 'explore' : 'archive' : mode;
      if (mode === 'produce') this.setTarget(r.id, s.automation.target);
      else r.exploring = false;
    }
    this.routeJobs();
  }

  setReactorJob(id: number, job: ReactorJob, z?: number): boolean {
    const s = this.state, r = s.reactors[id - 1];
    if (!r?.built || !s.modules.reaction || !['manual', 'explore', 'produce', 'archive'].includes(job)) return false;
    if (job === 'produce') {
      const target = z ?? (s.elements[r.target - 1].discovered ? r.target : 1);
      if (!Number.isInteger(target) || !s.elements[target - 1]?.discovered || !this.setTarget(id, target)) return false;
    }
    r.job = job;
    r.exploring = false;
    s.automation.mode = 'custom';
    this.routeJobs();
    return true;
  }

  private routeJobs() {
    const s = this.state;
    if (!s.modules.reaction || !s.automation.reaction) return;
    const working = s.reactors.filter(r => r.built && r.active && r.job !== 'manual');
    if (!working.length) return;
    const next = discoveredMax(s) + 1;
    const stage = discoveryStage(next);
    const assigned = new Set(working.filter(r => r.job === 'produce').map(r => r.target));
    for (const r of working.reverse()) {
      if (r.job === 'produce') continue;
      if (r.job === 'explore' && (next <= 10 || (stage?.reactor === r.id && stageReadiness(s, stage).ready))) {
        this.setTarget(r.id, next, true);
        continue;
      }
      const z = this.archiveTarget(r.id, assigned, stage?.specimen);
      this.setTarget(r.id, z);
      assigned.add(z);
    }
  }

  archiveTarget(reactorId = 1, assigned: ReadonlySet<number> = new Set(), specimen?: number): number {
    const s = this.state;
    const incomplete = s.elements.map((e, i) => ({ e, z: i + 1 }))
      .filter(({ e }) => e.discovered && !e.archived && e.inventory.lt(ARCHIVE_UNITS - e.deposited));
    if (!incomplete.length) return s.automation.target;
    const unassigned = incomplete.filter(({ z }) => !assigned.has(z));
    const available = unassigned.length ? unassigned : incomplete;
    // The current objective is finished by the most advanced device; older
    // devices then sweep the elements inside their own ranges.
    const top = highestReactor(s);
    if (reactorId === top.id && incomplete.some(({ z }) => z === FINAL_ELEMENT)) return FINAL_ELEMENT;
    const config = REACTORS[reactorId - 1];
    if (config) {
      const inRange = available.filter(({ z }) => z >= Math.max(1, config.anchor - 1) && z <= config.softMax);
      if (inRange.length) {
        if (specimen !== undefined && inRange.some(({ z }) => z === specimen)) return specimen;
        // Work downward within the assigned range so the stage edge is not starved.
        inRange.sort((a, b) => b.z - a.z);
        return inRange[0].z;
      }
      // If this device has already cleared its range, help with the element it
      // can produce most reliably instead of idling on an impossible target.
      const best = available.map(({ z }) => ({ z, p: probability(z, reactorId) })).sort((a, b) => b.p - a.p)[0];
      if (best) return best.z;
    }
    return available[0].z;
  }
  deposit(z: number, silent = false): number {
    const s = this.state, e = s.elements[z - 1];
    if (!e?.discovered || e.archived) return 0;
    const n = Math.min(ARCHIVE_UNITS - e.deposited, finiteNumber(e.inventory.floor(), ARCHIVE_UNITS));
    if (n <= 0) return 0;
    e.inventory = Big.max(0, e.inventory.minus(n)); e.deposited += n;
    if (e.deposited === ARCHIVE_UNITS) {
      e.archived = true; this.award('archive'); this.notify('archive', `${element(z).name}已正式收录 · 元素能力生效`, z);
      if (s.stats.milestones.firstArchive === undefined) s.stats.milestones.firstArchive = s.elapsed;
      if (z === 10 && s.stats.neonCompletedAt === null) { s.stats.neonCompletedAt = s.elapsed; s.stats.milestones.neonArchive = s.elapsed; this.award('complete'); this.notify('milestone', '氖档案已收录，继续向第二十号元素前进。', 10); }
      if (z === CALCIUM_ELEMENT && s.stats.calciumCompletedAt === null) {
        s.stats.calciumCompletedAt = s.elapsed; s.stats.milestones.complete = s.elapsed;
        this.award('calcium_complete');
        this.notify('milestone', '钙档案已收录，第二十号里程碑保留；下一站是锌、氪与氙，而不是终点。', CALCIUM_ELEMENT);
      }
      if (z === XENON_ELEMENT && s.stats.xeCompletedAt === null) {
        s.stats.xeCompletedAt = s.elapsed; s.stats.milestones.xeArchive = s.elapsed;
        this.award('xenon_complete');
        this.notify('milestone', '氙档案已收录，第五十四号里程碑达成；继续补齐 H–Xe 全部五十四格。', XENON_ELEMENT);
      }
      if (s.elements.slice(0, 10).every(e => e.archived)) this.award('collection');
      if (s.elements.slice(0, CALCIUM_ELEMENT).every(e => e.archived)) this.award('twenty_collection');
      if (archivedCount(s) === PLAYABLE_ELEMENTS && s.stats.completedAt === null) {
        s.stats.completedAt = s.elapsed; s.stats.milestones.stage54 = s.elapsed;
        this.award('fifty_four_collection');
        this.notify('complete', `H–Xe 全部 ${PLAYABLE_ELEMENTS} 格档案已点亮；这是当前版本的完整收集，不代表 55–118 已开放。`, XENON_ELEMENT);
      }
    } else if (!silent) this.notify('info', `已提交 ${n} 单位${element(z).name} · ${e.deposited}/${ARCHIVE_UNITS}`);
    return n;
  }
  private produce(r: ReactorState, amount: ReturnType<typeof D>, online: boolean) {
    if (amount.lte(0)) return;
    const s = this.state, z = r.target, e = s.elements[z - 1];
    if (!e.discovered) {
      if (!online || z !== discoveredMax(s) + 1 || z > PLAYABLE_ELEMENTS) return;
      e.discovered = true; e.firstDiscoveredAt = s.elapsed; e.firstDiscoveredReactor = r.id;
      s.stats.milestones[`element${z}`] = s.elapsed;
      this.notify('discovery', `首次发现 · ${element(z).name} ${element(z).symbol}`, z);
      if (!s.settings.mix.includes(z) && s.settings.mix.length < 5) s.settings.mix.push(z);
      if (z === 2) this.award('helium');
      if (z === 10) { this.award('neon'); this.notify('milestone', '已发现氖 · IV 级离子束反应器已开放。', 10); }
      if (z === 18) { this.award('argon'); this.notify('milestone', '已发现氩 · V 级回旋加速器已开放。', 18); }
      if (z === CALCIUM_ELEMENT) { this.award('calcium'); this.notify('milestone', '已发现钙 · 收录后达成第二十号里程碑，VI 级同步辐射研究环已开放。', CALCIUM_ELEMENT); }
      if (z === 30) { this.award('zinc'); this.notify('milestone', '已发现锌 · 第 30 号只是中段，继续向氪与氙推进。', 30); }
      if (z === 36) { this.award('krypton'); this.notify('milestone', '已发现氪 · 第四周期结束；VII 级重离子储存环已开放，目标仍是氙。', 36); }
      if (z === XENON_ELEMENT) { this.award('xenon'); this.notify('milestone', '已发现氙 · 收录氙以点亮第五十四号档案。', XENON_ELEMENT); }
    }
    e.inventory = e.inventory.plus(amount); e.totalProduced = e.totalProduced.plus(amount); s.stats.produced = s.stats.produced.plus(amount);
    if (online) {
      if (r.id === 1 && z === 5) this.award('impossible');
      if (r.id === 1 && z === 6) this.award('limit');
      if (r.id === 2 && z >= 8) this.award('old');
      if (z >= REACTORS[r.id - 1].softMax + 2) this.award('upstream');
    }
    if (online && r.exploring && (r.job === 'manual' || s.automation.reaction) && z < PLAYABLE_ELEMENTS) this.setTarget(r.id, Math.min(PLAYABLE_ELEMENTS, discoveredMax(s) + 1), true);
  }
  canManualPulse(reactorId: number): boolean {
    const r = this.state.reactors[reactorId - 1];
    const step = this.state.firstRun?.step;
    return Number.isInteger(reactorId) && !!r?.built && r.active
      && (step === undefined || step === 'free' || (step === 'charge' && reactorId === 1));
  }

  /** Immediate collision energy and research data, independent of simulation time. */
  manualPulse(reactorId: number): { energy: Amount; data: Amount } | null {
    if (!this.canManualPulse(reactorId)) return null;
    const s = this.state;
    const r = s.reactors[reactorId - 1];
    const bonuses = abilityBonuses(s);
    const energyMultiplier = bonuses?.energy ? D(100 + bonuses.energy).div(100) : null;
    const dataMultiplier = bonuses?.data ? D(100 + bonuses.data).div(100) : null;
    const events = Big.max(D(2), eventRate(r).mul(D('0.055')).floor());
    const baseGain = events.mul(coinPerEvent(r));
    const energy = energyMultiplier ? baseGain.mul(energyMultiplier) : baseGain;
    const data = dataMultiplier ? events.mul(dataMultiplier) : events;
    r.events = r.events.plus(events);
    s.stats.events = s.stats.events.plus(events);
    s.coins = s.coins.plus(energy);
    s.stats.earned = s.stats.earned.plus(energy);
    s.data = s.data.plus(data);
    s.stats.peak = Big.max(s.stats.peak, s.coins);
    if (s.stats.events.gte(1)) this.award('collision');
    if (s.firstRun?.step === 'charge' && s.coins.gte(price(r, 'atoms'))) s.firstRun = { step: 'sample' };
    return { energy, data };
  }
  /** The sole authority for automatic income. Canvas never calls this method. */
  step(seconds: number, online = true) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const s = this.state; s.elapsed += seconds;
    this.routeJobs();
    const bonuses = abilityBonuses(s);
    const energyMultiplier = bonuses?.energy ? D(100 + bonuses.energy).div(100) : null;
    const dataMultiplier = bonuses?.data ? D(100 + bonuses.data).div(100) : null;
    const productionBonus = bonuses?.production ? D(bonuses.production).div(100) : null;
    for (const r of s.reactors) {
      if (!r.built || !r.active) continue;
      const rate = eventRate(r);
      const events = rate.mul(seconds);
      const baseGain = events.mul(coinPerEvent(r));
      const gain = energyMultiplier ? baseGain.mul(energyMultiplier) : baseGain;
      r.events = r.events.plus(events); s.stats.events = s.stats.events.plus(events);
      s.coins = s.coins.plus(gain); s.stats.earned = s.stats.earned.plus(gain);
      s.data = s.data.plus(dataMultiplier ? events.mul(dataMultiplier) : events);
      if (s.stats.events.gte(1)) this.award('collision');
      const e = s.elements[r.target - 1];
      if (!e.discovered) {
        if (!online || r.target !== discoveredMax(s) + 1) continue;
        const stage = discoveryStage(r.target);
        if (stage) {
          if (r.id !== stage.reactor || !stageReadiness(s, stage).ready) continue;
          const progress = observationProgress(s, r.target) + observationRate(r, stage, r.target, rate) * seconds;
          if (progress >= 1 - 1e-12) {
            delete s.observation;
            this.produce(r, D(1), true);
          } else s.observation = { z: r.target, progress };
          continue;
        }
        if (r.id === 1 && r.target === 2 && s.firstRun) {
          if (s.firstRun.step === 'helium') {
            s.firstRun.remaining = Math.max(0, s.firstRun.remaining - seconds);
            if (s.firstRun.remaining <= 1e-9) {
              r.exploring = false;
              this.produce(r, D(1), true);
              delete s.firstRun;
            }
          }
          continue;
        }
        // Exponential survival clock: genuine online probability, independent of visual frames.
        const hazard = firstDiscoveryRate(r, rate).mul(seconds);
        if (hazard.gte(r.discoveryHazard)) { this.produce(r, D(1), true); r.discoveryHazard = waitingHazard(s); }
        else r.discoveryHazard -= hazard.toNumber();
      } else {
        const p = probability(r.target, r.id);
        const parallel = s.modules.reaction && s.automation.reaction ? productionParallel(r.id) : 1;
        const expected = events.mul(p).mul(parallel);
        let count;
        const fixedProduction = !online || expected.gte(1e8);
        if (fixedProduction) {
          // Offline and massive batches settle by expectation, preserving fractions.
          count = expected;
        } else if (events.lt(1000) && parallel === 1) {
          const total = events.plus(r.eventRemainder), attempts = total.floor().toNumber(); r.eventRemainder = total.minus(attempts);
          let hits = 0; for (let i = 0; i < attempts; i++) { // bounded to < 1000 trials
            // Use the same serializable RNG as discovery clocks.
            if (random(s) < p) hits++;
          }
          count = D(hits);
        } else count = D(poisson(s, expected.toNumber()));
        if (fixedProduction || productionBonus) {
          // Online bonuses add to actual production. They never alter first discovery odds.
          const total = (productionBonus ? count.plus(count.mul(productionBonus)) : count).plus(r.productionRemainder);
          count = total.floor();
          r.productionRemainder = total.minus(count);
        }
        this.produce(r, count, online);
      }
    }
    s.stats.peak = Big.max(s.stats.peak, s.coins);
    if (s.modules.feed && s.automation.feed) {
      const reactors = s.automation.feedScope === 'all' ? s.reactors.filter(r => r.built && r.active).reverse() : [highestReactor(s)];
      for (const r of reactors) {
        // Recompute the budget for each line so the combined purchases respect the reserve.
        const n = usefulAtomPurchase(r, Big.max(0, s.coins.minus(s.automation.reserve)));
        if (n > 0) this.buy(r.id, 'atoms', n);
      }
    }
    if (s.modules.allocation && s.automation.allocation) {
      if (s.automation.allocationScope === 'all') {
        for (let z = 1; z <= PLAYABLE_ELEMENTS; z++) this.deposit(z, true);
      } else {
        const stage = discoveryStage(discoveredMax(s) + 1);
        if (stage) this.deposit(stage.specimen, true);
      }
    }
  }
  advance(seconds: number, online = true) {
    const duration = Math.max(0, Math.min(OFFLINE_LIMIT, Number.isFinite(seconds) ? seconds : 0));
    // Online fixed chunks keep automation responsive; offline uses bounded minute chunks.
    const chunk = online ? 1 : 60;
    let remaining = duration;
    while (remaining > 1e-9) { const dt = Math.min(chunk, remaining); this.step(dt, online); remaining -= dt; }
    return duration;
  }
  offline(now = Date.now()) {
    const s = this.state, before = s.coins, produced = s.stats.produced;
    const seconds = this.advance(Math.max(0, (now - s.savedAt) / 1000), false); s.savedAt = now;
    return { seconds, coins: s.coins.minus(before), produced: s.stats.produced.minus(produced) };
  }
}

