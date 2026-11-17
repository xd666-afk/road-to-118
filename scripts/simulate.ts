import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Engine, createState, discoveredMax, highestReactor, archivedCount } from '../src/game/engine';
import { D } from '../src/game/numbers';
import { income, price } from '../src/game/economy';
import { REACTORS } from '../src/game/config';
import type { Upgrade } from '../src/game/types';

type Strategy = 'balanced' | 'automation' | 'newcomer';
export function pilot(e: Engine, strategy: Strategy) {
  const s = e.state, max = discoveredMax(s);
  if (strategy === 'newcomer' && archivedCount(s) === 0) {
    // Follow the visible opening hints, one action per visit. No optimal
    // upgrade shopping or instantaneous card dismissal is assumed here.
    if (s.stats.purchases === 0) e.buy(1, 'atoms', 1);
    else if (max >= 2 && !s.modules.feed) e.research('feed');
    else if (max > 1 && max < 4) e.target(1, max + 1, true);
    else if (max >= 4 && !s.reactors[1].built) e.build(2);
    else if (s.reactors[1].built && !s.modules.reaction) e.research('reaction');
    else if (s.modules.reaction) {
      if (s.elements[0].inventory.gte(50 - s.elements[0].deposited)) e.deposit(1, true);
      else e.target(1, 1, false);
    }
    s.notices = []; return;
  }
  // Newcomers act every 8s and select discoveries manually, including card-reading time.
  for (const id of [2, 3]) e.build(id);
  if (!s.modules.feed) e.research('feed');
  if (s.reactors[1].built) e.research('reaction');
  if (max >= 7) e.research('allocation');
  s.automation.feed = s.modules.feed && strategy !== 'balanced';
  const next = !s.reactors[1].built ? REACTORS[1] : !s.reactors[2].built ? REACTORS[2] : null;
  s.automation.reserve = D(next?.buildCoins || 100);
  const top = highestReactor(s);
  if (max < 10) e.target(top.id, max + 1, strategy !== 'newcomer');
  else if (top.target !== 10 || top.exploring) e.target(top.id, 10, false);
  for (const r of s.reactors.filter(r => r.built)) {
    const reserve = next && max >= next.unlock ? D(next.buildCoins) : D(0);
    const candidates: { key: Upgrade; roi: number; cost: number }[] = [];
    for (const key of ['atoms', 'speed', 'yield', 'capacity'] as Upgrade[]) {
      if (key === 'capacity' && (r.id === 1 || r.upgrades.capacity >= 4)) continue;
      if (key === 'yield' && r.upgrades.yield >= 8) continue;
      const cost = price(r, key), clone = { ...r, upgrades: { ...r.upgrades, [key]: r.upgrades[key] + 1 } }, delta = income(clone).minus(income(r));
      if (delta.lte(0) || s.coins.minus(reserve).lt(cost)) continue;
      const roi = cost.div(delta).toNumber();
      if (strategy === 'newcomer' || roi < (strategy === 'balanced' ? 160 : 110)) candidates.push({ key, roi, cost: cost.toNumber() });
    }
    candidates.sort(strategy === 'newcomer' ? (a, b) => a.cost - b.cost : (a, b) => a.roi - b.roi);
    if (candidates.length) e.buy(r.id, candidates[0].key, 1);
    if (r.id !== top.id) {
      const z = s.modules.reaction && !s.elements[0].archived ? 1 : Math.min(max, REACTORS[r.id - 1].softMax);
      if (r.target !== z) e.target(r.id, z, false);
    }
  }
  for (let z = 1; z <= max; z++) if (s.elements[z - 1].inventory.gte(50) || s.elements[z - 1].deposited > 0) e.deposit(z, true);
  s.notices = [];
}

const count = Math.max(10, Number(process.argv.find(a => a.startsWith('--runs='))?.split('=')[1] || 1000));
const selected = process.argv.find(a => a.startsWith('--strategy='))?.split('=')[1];
const destination = process.argv.find(a => a.startsWith('--output='))?.slice('--output='.length) || 'artifacts/simulation.json';
if (selected && !['balanced', 'automation', 'newcomer'].includes(selected)) throw new Error('Unknown simulation strategy');
const limit = 3600, dt = 2;
const summary: any = { runsPerStrategy: count, dtSeconds: dt, limitMinutes: limit / 60, generatedAt: new Date().toISOString(), balance: REACTORS.map(r => ({ id: r.id, anchorP: r.p, q: r.q, buildCoins: r.buildCoins, buildData: r.buildData })), newcomerPolicy: 'opening hints, one action every 8 seconds', strategies: {} };
for (const strategy of ['balanced', 'automation', 'newcomer'] as const) {
  if (selected && strategy !== selected) continue;
  const outcomes: { milestones: Record<string, number>; upgrades: unknown; max: number; failed: boolean; opening: { discovered: number; archived: number; reactor2: boolean; feed: boolean; reaction: boolean } }[] = [];
  const started = Date.now();
  for (let run = 0; run < count; run++) {
    const seed = (Math.imul(run + 1, 2654435761) + ({ balanced: 17, automation: 41, newcomer: 71 }[strategy])) >>> 0;
    const e = new Engine(createState(seed, 0));
    let opening = { discovered: 1, archived: 0, reactor2: false, feed: false, reaction: false };
    while (e.state.elapsed < limit && e.state.stats.completedAt === null) {
      if (strategy !== 'newcomer' || e.state.elapsed % 8 === 0) pilot(e, strategy);
      e.step(dt, true);
      if (e.state.elapsed === 180) opening = { discovered: discoveredMax(e.state), archived: archivedCount(e.state), reactor2: e.state.reactors[1].built, feed: e.state.modules.feed, reaction: e.state.modules.reaction };
    }
    outcomes.push({ milestones: e.state.stats.milestones, upgrades: e.state.reactors.map(r => ({ ...r.upgrades })), max: discoveredMax(e.state), failed: e.state.stats.completedAt === null, opening });
    if ((run + 1) % 100 === 0) process.stderr.write(`${strategy}: ${run + 1}/${count}\n`);
  }
  const quantiles = (key: string) => { const vals = outcomes.map(o => o.milestones[key]).filter(v => v !== undefined).sort((a, b) => a - b); return { reached: vals.length, p10: vals.length ? +(vals[Math.floor((vals.length - 1) * .1)] / 60).toFixed(2) : null, p50: vals.length ? +(vals[Math.floor((vals.length - 1) * .5)] / 60).toFixed(2) : null, p90: vals.length ? +(vals[Math.floor((vals.length - 1) * .9)] / 60).toFixed(2) : null }; };
  const openingShare = (check: (o: typeof outcomes[number]['opening']) => boolean) => +(outcomes.filter(o => check(o.opening)).length / count * 100).toFixed(1);
  summary.strategies[strategy] = {
    stages: Object.fromEntries(['firstUpgrade', 'element2', 'element3', 'element4', 'module_feed', 'reactor2', 'module_reaction', 'firstArchive', 'reactor3', 'element10', 'complete'].map(key => [key, quantiles(key)])),
    opening3Minutes: { reactor2Percent: openingShare(o => o.reactor2), automationPercent: openingShare(o => o.feed), parallelProductionPercent: openingShare(o => o.reaction), firstArchivePercent: openingShare(o => o.archived > 0), averageDiscovered: +(outcomes.reduce((sum, o) => sum + o.opening.discovered, 0) / count).toFixed(2) },
    failed: outcomes.filter(o => o.failed).length,
    stalledExamples: outcomes.map((o, i) => ({ ...o, run: i })).filter(o => o.failed).slice(0, 3), examplePurchases: outcomes[0].upgrades, wallSeconds: +((Date.now() - started) / 1000).toFixed(2),
  };
  console.log(`${strategy}: ${JSON.stringify(summary.strategies[strategy])}`);
}
mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, JSON.stringify(summary, null, 2));
console.log(`Saved ${destination} (stage durations in minutes; opening snapshot at 180 seconds).`);
