import { D, Big, finiteNumber } from './numbers';
import { ACHIEVEMENTS, MODULES, OFFLINE_LIMIT, REACTORS } from './config';
import { coinPerEvent, eventRate, maxAffordable, price, probability } from './economy';
import { poisson, random, waitingHazard } from './rng';
import type { GameState, Module, Notice, ReactorState, Upgrade, WorkMode } from './types';
import { element } from '../data/elements';

export function createState(seed = Date.now() >>> 0, now = Date.now()): GameState {
  const s: GameState = {
    saveVersion: 1, savedAt: now, elapsed: 0, seed, rng: seed >>> 0, coins: D(0), data: D(0),
    reactors: [1, 2, 3].map(id => ({ id, built: id === 1, active: true, target: 2, exploring: false, upgrades: { atoms: 0, speed: 0, yield: 0, capacity: 0 }, events: D(0), discoveryHazard: 1, productionRemainder: D(0), eventRemainder: D(0) })),
    elements: Array.from({ length: 10 }, (_, i) => ({ discovered: i === 0, inventory: D(0), deposited: 0, archived: false, firstDiscoveredAt: i === 0 ? 0 : null, firstDiscoveredReactor: i === 0 ? 1 : null, totalProduced: D(0) })),
    modules: { feed: false, reaction: false, allocation: false },
    automation: { feed: false, reaction: false, allocation: false, reserve: D(100), mode: 'explore', target: 1 },
    stats: { events: D(0), produced: D(0), earned: D(0), peak: D(0), builds: 1, purchases: 0, lastEvent: '实验室已准备就绪', completedAt: null, milestones: {} },
    achievements: [], settings: { scientific: false, reducedMotion: false, guideDismissed: false, mix: [1] },
    notices: [], noticeSeq: 0,
  };
  for (const r of s.reactors) r.discoveryHazard = waitingHazard(s);
  return s;
}
export const discoveredMax = (s: GameState) => s.elements.filter(e => e.discovered).length;
export const archivedCount = (s: GameState) => s.elements.filter(e => e.archived).length;
export const highestReactor = (s: GameState) => s.reactors.filter(r => r.built).at(-1)!;

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
  target(id: number, z: number, exploring = false): boolean {
    const r = this.state.reactors[id - 1];
    if (!r?.built || !Number.isInteger(z) || z < 1 || z > Math.min(10, discoveredMax(this.state) + 1)) return false;
    if (r.target !== z) { r.discoveryHazard = waitingHazard(this.state); r.productionRemainder = D(0); }
    r.target = z; r.exploring = exploring; return true;
  }
  buy(id: number, key: Upgrade, count: number | 'max'): number {
    const s = this.state, r = s.reactors[id - 1];
    if (!r?.built || !(key in r.upgrades) || (key === 'capacity' && id === 1)) return 0;
    const n = count === 'max' ? maxAffordable(r, key, s.coins) : Math.max(0, Math.floor(count));
    if (!n || n > 1e7 - r.upgrades[key]) return 0;
    const cost = price(r, key, n); if (cost.gt(s.coins)) return 0;
    s.coins = Big.max(0, s.coins.minus(cost)); r.upgrades[key] += n; s.stats.purchases += n;
    if (key === 'atoms') { s.elements[0].inventory = s.elements[0].inventory.plus(n); s.elements[0].totalProduced = s.elements[0].totalProduced.plus(n); s.stats.produced = s.stats.produced.plus(n); }
    if (n >= 10) this.award('bulk');
    return n;
  }
  build(id: number): boolean {
    const s = this.state, r = s.reactors[id - 1], c = REACTORS[id - 1];
    if (!r || r.built || !s.elements[c.unlock - 1].discovered || s.coins.lt(c.buildCoins) || s.data.lt(c.buildData)) return false;
    s.coins = s.coins.minus(c.buildCoins); s.data = s.data.minus(c.buildData); r.built = true;
    r.target = Math.min(10, discoveredMax(s) + 1); r.exploring = false;
    s.stats.builds++; s.stats.milestones[`reactor${id}`] = s.elapsed;
    this.award(`reactor${id}`); this.notify('info', `${c.name}已投入运行`); return true;
  }
  research(key: Module): boolean {
    const s = this.state, c = MODULES[key];
    const order: Module[] = ['feed', 'reaction', 'allocation'], index = order.indexOf(key);
    if (!c || s.modules[key] || (index > 0 && !s.modules[order[index - 1]]) || !s.elements[c.unlock - 1].discovered || s.coins.lt(c.coins) || s.data.lt(c.data)) return false;
    s.coins = s.coins.minus(c.coins); s.data = s.data.minus(c.data); s.modules[key] = true; s.automation[key] = true;
    this.award('automation'); this.notify('info', `${c.name}模块已上线`); return true;
  }
  setMode(mode: WorkMode, z = this.state.automation.target) {
    const s = this.state; s.automation.mode = mode; s.automation.target = Math.max(1, Math.min(discoveredMax(s), z));
    if (s.modules.allocation) s.automation.allocation = mode === 'archive';
    if (mode === 'explore') this.target(highestReactor(s).id, Math.min(10, discoveredMax(s) + 1), true);
    else for (const r of s.reactors.filter(r => r.built)) {
      const target = mode === 'archive' ? this.archiveTarget(r.id) : s.automation.target;
      this.target(r.id, target, false);
    }
  }
  archiveTarget(offset = 1): number {
    const available = this.state.elements.map((e, i) => ({ e, z: i + 1 })).filter(({ e }) => e.discovered && !e.archived);
    if (!available.length) return this.state.automation.target;
    // Ne is the explicit v0.1 objective. Old reactors may fill earlier entries in parallel.
    if (this.state.elements[9].discovered && !this.state.elements[9].archived && offset === highestReactor(this.state).id) return 10;
    return available[(offset - 1) % available.length].z;
  }
  deposit(z: number, silent = false): number {
    const s = this.state, e = s.elements[z - 1];
    if (!e?.discovered || e.archived) return 0;
    const n = Math.min(50 - e.deposited, finiteNumber(e.inventory.floor(), 50));
    if (n <= 0) return 0;
    e.inventory = Big.max(0, e.inventory.minus(n)); e.deposited += n;
    if (e.deposited === 50) {
      e.archived = true; this.award('archive'); this.notify('archive', `${element(z).name}已正式收录 · 周期表已点亮`, z);
      if (z === 10 && s.stats.completedAt === null) { s.stats.completedAt = s.elapsed; s.stats.milestones.complete = s.elapsed; this.award('complete'); this.notify('complete', '50 份氖的记录，属于你的第十号里程碑。', 10); }
      if (archivedCount(s) === 10) this.award('collection');
    } else if (!silent) this.notify('info', `已提交 ${n} 单位${element(z).name} · ${e.deposited}/50`);
    return n;
  }
  private produce(r: ReactorState, amount: ReturnType<typeof D>, online: boolean) {
    if (amount.lte(0)) return;
    const s = this.state, z = r.target, e = s.elements[z - 1];
    if (!e.discovered) {
      if (!online || z !== discoveredMax(s) + 1 || z > 10) return;
      e.discovered = true; e.firstDiscoveredAt = s.elapsed; e.firstDiscoveredReactor = r.id;
      s.stats.milestones[`element${z}`] = s.elapsed;
      this.notify('discovery', `首次发现 · ${element(z).name} ${element(z).symbol}`, z);
      if (!s.settings.mix.includes(z) && s.settings.mix.length < 5) s.settings.mix.push(z);
      if (z === 2) this.award('helium');
      if (z === 10) { this.award('neon'); this.notify('milestone', '你已抵达氖。提交累计 50 Ne，完成 v0.1。', 10); }
    }
    e.inventory = e.inventory.plus(amount); e.totalProduced = e.totalProduced.plus(amount); s.stats.produced = s.stats.produced.plus(amount);
    if (online) {
      if (r.id === 1 && z === 5) this.award('impossible');
      if (r.id === 1 && z === 6) this.award('limit');
      if (r.id === 2 && z >= 8) this.award('old');
      if (z >= REACTORS[r.id - 1].softMax + 2) this.award('upstream');
    }
    if (online && r.exploring && z < 10) this.target(r.id, Math.min(10, discoveredMax(s) + 1), true);
  }
  /** The sole authority for all income. Canvas never calls this method. */
  step(seconds: number, online = true) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const s = this.state; s.elapsed += seconds;
    for (const r of s.reactors) {
      if (!r.built || !r.active) continue;
      const events = eventRate(r).mul(seconds), gain = events.mul(coinPerEvent(r));
      r.events = r.events.plus(events); s.stats.events = s.stats.events.plus(events);
      s.coins = s.coins.plus(gain); s.stats.earned = s.stats.earned.plus(gain); s.data = s.data.plus(events);
      if (s.stats.events.gte(1)) this.award('collision');
      const e = s.elements[r.target - 1], p = probability(r.target, r.id);
      if (!e.discovered) {
        if (!online || r.target !== discoveredMax(s) + 1) continue;
        // Exponential survival clock: genuine online probability, independent of visual frames.
        const hazard = events.mul(-Math.log1p(-p));
        if (hazard.gte(r.discoveryHazard)) { this.produce(r, D(1), true); r.discoveryHazard = waitingHazard(s); }
        else r.discoveryHazard -= hazard.toNumber();
      } else {
        const parallel = s.modules.reaction && s.automation.reaction ? [8, 32, 32][r.id - 1] : 1;
        const expected = events.mul(p).mul(parallel);
        let count;
        if (!online) {
          // Offline stable production keeps fractions between settlements, without rare-event achievements.
          const total = expected.plus(r.productionRemainder); count = total.floor(); r.productionRemainder = total.minus(count);
        } else if (expected.gte(1e8)) {
          // Massive batches: deterministic expectation avoids overflowing a Poisson parameter.
          const total = expected.plus(r.productionRemainder); count = total.floor(); r.productionRemainder = total.minus(count);
        } else if (events.lt(1000) && parallel === 1) {
          const total = events.plus(r.eventRemainder), attempts = total.floor().toNumber(); r.eventRemainder = total.minus(attempts);
          let hits = 0; for (let i = 0; i < attempts; i++) { // bounded to < 1000 trials
            // Use the same serializable RNG as discovery clocks.
            if (random(s) < p) hits++;
          }
          count = D(hits);
        } else count = D(poisson(s, expected.toNumber()));
        this.produce(r, count, online);
      }
    }
    s.stats.peak = Big.max(s.stats.peak, s.coins);
    if (s.modules.feed && s.automation.feed) {
      const r = highestReactor(s), budget = Big.max(0, s.coins.minus(s.automation.reserve));
      // Budgeted, logarithmic batch purchase, never one-operation-per-atom.
      const n = maxAffordable(r, 'atoms', budget);
      if (n > 0) this.buy(r.id, 'atoms', n);
    }
    if (s.modules.allocation && s.automation.allocation) for (let z = 1; z <= 10; z++) this.deposit(z, true);
    if (s.automation.mode === 'archive' && s.modules.reaction && s.automation.reaction) for (const r of s.reactors) {
      if (r.built && !r.exploring && s.elements[r.target - 1].archived) this.target(r.id, this.archiveTarget(r.id), false);
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

