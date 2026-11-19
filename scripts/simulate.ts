import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Engine, createFirstRun, discoveredMax, highestReactor, archivedCount } from '../src/game/engine';
import { D } from '../src/game/numbers';
import { income, price } from '../src/game/economy';
import { FINAL_ELEMENT, PLAYABLE_ELEMENTS, REACTORS } from '../src/game/config';
import type { Upgrade } from '../src/game/types';
import { activateElementAbility, availableAbilities } from '../src/game/abilityProgress';
import { applyAdvice, recommend } from '../src/game/advisor';

const CADENCE = { balanced: 6, automation: 10, newcomer: 8, guided: 8 } as const;
type Strategy = keyof typeof CADENCE;
const STRATEGIES = Object.keys(CADENCE) as Strategy[];
const SEED_OFFSET: Record<Strategy, number> = { balanced: 17, automation: 41, newcomer: 71, guided: 103 };

/**
 * Deterministic, non-cheating pilot. Every branch calls the same Engine API a
 * player can use: one reactor build, one module research, at most one upgrade
 * batch and at most one manual deposit per action window. No resources are
 * injected, no target is skipped, and no all-elements shortcut exists.
 */
export function pilot(e: Engine, strategy: Strategy) {
  const s = e.state, max = discoveredMax(s);
  if (s.firstRun?.step === 'welcome') { e.beginOpening(); return; }
  if (s.firstRun?.step === 'start') { e.toggleReactor(1); return; }
  if (s.firstRun?.step === 'sample') { e.buy(1, 'atoms', 1); return; }
  if (s.firstRun?.step === 'explore') { e.target(1, 2, true); return; }
  if (s.firstRun?.step === 'helium') return;

  // One click in the periodic table activates the earned bonuses together.
  for (const z of availableAbilities(s)) activateElementAbility(s, z);
  if (strategy === 'guided') {
    applyAdvice(e, recommend(s));
    s.notices = [];
    return;
  }
  if (strategy === 'newcomer' && archivedCount(s) === 0) {
    // The visible opening hints, one action per 8-second visit, including the
    // time to read the discovery card and dismiss it manually.
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

  // Build at most one affordable instrument per visit, in unlock order.
  for (const config of REACTORS.slice(1)) {
    if (s.reactors[config.id - 1].built || max < config.unlock) continue;
    if (s.coins.gte(config.buildCoins) && s.data.gte(config.buildData)) { e.build(config.id); break; }
  }
  // Modules are researched in their real order, one per visit.
  for (const key of ['feed', 'reaction', 'allocation'] as const) {
    if (!s.modules[key] && max >= ({ feed: 2, reaction: 4, allocation: 7 }[key])) { e.research(key); break; }
  }

  const top = highestReactor(s);
  const next = REACTORS.find(config => !s.reactors[config.id - 1].built && max >= config.unlock);
  const reserve = next ? D(next.buildCoins) : D(0);
  s.automation.reserve = reserve;
  s.automation.feed = s.modules.feed && strategy !== 'balanced';

  // At Xe, switch once to the real archive pipeline. Its per-reactor range
  // targeting and the allocation module then deposit the remaining 54 rows.
  if (max >= FINAL_ELEMENT && archivedCount(s) < PLAYABLE_ELEMENTS && s.modules.reaction && s.automation.mode !== 'archive') {
    e.setMode('archive');
  }

  if (s.automation.mode !== 'archive' && max < PLAYABLE_ELEMENTS) {
    const nextTarget = max + 1;
    if (top.target !== nextTarget || !top.exploring) e.target(top.id, nextTarget, true);
    if (s.modules.reaction) {
      for (const reactor of s.reactors.filter(reactor => reactor.built && reactor.id !== top.id)) {
        const target = e.archiveTarget(reactor.id);
        if (s.elements[target - 1]?.discovered && !s.elements[target - 1].archived && reactor.target !== target) e.target(reactor.id, target, false);
      }
    }
  } else if (s.automation.mode === 'archive' && max >= FINAL_ELEMENT && archivedCount(s) < PLAYABLE_ELEMENTS) {
    // Re-seed in-range targets if a newly built reactor joined after the first
    // switch. Normally step() already advances archived targets itself.
    for (const reactor of s.reactors.filter(reactor => reactor.built && !reactor.exploring && s.elements[reactor.target - 1]?.archived)) {
      e.target(reactor.id, e.archiveTarget(reactor.id), false);
    }
  }

  // One upgrade decision per visit, choosing the best measured income return
  // among all built reactors. Balance leaves the next construction budget alone.
  if (s.modules.feed || max >= 4) {
    const candidates: { reactor: number; key: Upgrade; roi: number; cost: number }[] = [];
    for (const reactor of s.reactors.filter(reactor => reactor.built)) {
      for (const key of ['atoms', 'speed', 'yield', 'capacity'] as Upgrade[]) {
        if (key === 'capacity' && (reactor.id === 1 || reactor.upgrades.capacity >= 4)) continue;
        if (key === 'yield' && reactor.upgrades.yield >= 8) continue;
        if (key === 'speed' && reactor.upgrades.speed >= 12) continue;
        const cost = price(reactor, key), clone = { ...reactor, upgrades: { ...reactor.upgrades, [key]: reactor.upgrades[key] + 1 } };
        const delta = income(clone).minus(income(reactor));
        if (delta.lte(0) || s.coins.minus(reserve).lt(cost)) continue;
        const roi = cost.div(delta).toNumber();
        if (roi < (strategy === 'balanced' ? 160 : 110)) candidates.push({ reactor: reactor.id, key, roi, cost: cost.toNumber() });
      }
    }
    candidates.sort((a, b) => a.roi - b.roi);
    if (candidates.length) e.buy(candidates[0].reactor, candidates[0].key, 1);
  }

  // Manual submissions are allowed too; the allocation module is the normal
  // path, but a player can submit one visible archive per action window.
  const nextArchive = s.elements.findIndex((element, index) => element.discovered && !element.archived && element.inventory.gte(50 - element.deposited));
  if (nextArchive >= 0) e.deposit(nextArchive + 1, true);
  s.notices = [];
}

const count = Math.max(10, Number(process.argv.find(a => a.startsWith('--runs='))?.split('=')[1] || 300));
const selected = process.argv.find(a => a.startsWith('--strategy='))?.split('=')[1];
const destination = process.argv.find(a => a.startsWith('--output='))?.slice('--output='.length) || 'artifacts/simulation-xe54.json';
if (selected && !STRATEGIES.some(strategy => strategy === selected)) throw new Error('Unknown simulation strategy');
const limit = 7200, dt = 2;
const summary: any = {
  runsPerStrategy: count, dtSeconds: dt, limitMinutes: limit / 60,
  generatedAt: new Date().toISOString(),
  engine: 'Production Decimal.js and Engine.step, fresh game and real tutorial actions. First He uses the same timed synthesis as the game. Earned abilities are activated through the bulk action.',
  actionCadenceSeconds: CADENCE,
  seedPolicy: 'seed = (run+1)*2654435761 + strategyOffset mod 2^32', seedOffsets: SEED_OFFSET,
  balance: REACTORS.map(r => ({ id: r.id, roman: r.roman, range: r.range, softMax: r.softMax, anchor: r.anchor, anchorP: r.p, q: r.q, buildCoins: r.buildCoins, buildData: r.buildData, unlock: r.unlock })),
  strategies: {},
};
for (const strategy of STRATEGIES) {
  if (selected && strategy !== selected) continue;
  const outcomes: {
    milestones: Record<string, number>; upgrades: unknown; discovered: number; archived: number; failed: boolean;
    opening: { discovered: number; archived: number; reactor2: boolean; feed: boolean; reaction: boolean };
  }[] = [];
  const started = Date.now();
  for (let run = 0; run < count; run++) {
    const seed = (Math.imul(run + 1, 2654435761) + SEED_OFFSET[strategy]) >>> 0;
    const e = new Engine(createFirstRun(seed, 0));
    let nextAction = 0;
    let opening = { discovered: 1, archived: 0, reactor2: false, feed: false, reaction: false };
    while (e.state.elapsed < limit && e.state.stats.completedAt === null) {
      if (e.state.elapsed + 1e-9 >= nextAction) { pilot(e, strategy); nextAction = e.state.elapsed + CADENCE[strategy]; }
      e.step(dt, true);
      if (e.state.elapsed === 180) opening = { discovered: discoveredMax(e.state), archived: archivedCount(e.state), reactor2: e.state.reactors[1].built, feed: e.state.modules.feed, reaction: e.state.modules.reaction };
    }
    outcomes.push({ milestones: e.state.stats.milestones, upgrades: e.state.reactors.map(r => ({ ...r.upgrades })), discovered: discoveredMax(e.state), archived: archivedCount(e.state), failed: e.state.stats.completedAt === null, opening });
    if ((run + 1) % 100 === 0) process.stderr.write(`${strategy}: ${run + 1}/${count}\n`);
  }
  const durationQuantiles = (durations: number[]) => {
    const vals = durations.filter(Number.isFinite).sort((a, b) => a - b);
    const q = (fraction: number) => vals.length ? +(vals[Math.min(vals.length - 1, Math.floor((vals.length - 1) * fraction))] / 60).toFixed(2) : null;
    return { reached: vals.length, reachedPercent: +(vals.length / count * 100).toFixed(1), p10: q(.1), p50: q(.5), p90: q(.9) };
  };
  const quantiles = (key: string) => durationQuantiles(outcomes.map(o => o.milestones[key]));
  const stageKeys = ['firstUpgrade', 'element2', 'element3', 'element4', 'module_feed', 'reactor2', 'module_reaction', 'firstArchive', 'reactor3', 'element10', 'neonArchive', 'reactor4', 'element11', 'element18', 'element20', 'complete', 'reactor5', 'element30', 'reactor6', 'element36', 'reactor7', 'element54', 'xeArchive', 'stage54'];
  const openingShare = (check: (o: typeof outcomes[number]['opening']) => boolean) => +(outcomes.filter(o => check(o.opening)).length / count * 100).toFixed(1);
  summary.strategies[strategy] = {
    stages: Object.fromEntries(stageKeys.map(key => [key, quantiles(key)])),
    sodiumToArgon: durationQuantiles(outcomes.map(({ milestones }) => milestones.element18 - milestones.element11)),
    keyTargets: { xeDiscovered: quantiles('element54'), xeArchived: quantiles('xeArchive'), all54Collected: quantiles('stage54') },
    opening3Minutes: { reactor2Percent: openingShare(o => o.reactor2), automationPercent: openingShare(o => o.feed), parallelProductionPercent: openingShare(o => o.reaction), firstArchivePercent: openingShare(o => o.archived > 0), averageDiscovered: +(outcomes.reduce((sum, o) => sum + o.opening.discovered, 0) / count).toFixed(2) },
    failedToCollect54: outcomes.filter(o => o.failed).length,
    reachedAll54Percent: +(outcomes.filter(o => !o.failed).length / count * 100).toFixed(1),
    averageDiscoveredAtLimit: +(outcomes.reduce((sum, o) => sum + o.discovered, 0) / count).toFixed(2),
    averageArchivedAtLimit: +(outcomes.reduce((sum, o) => sum + o.archived, 0) / count).toFixed(2),
    stalledExamples: outcomes.map((o, i) => ({ ...o, run: i })).filter(o => o.failed).slice(0, 3),
    examplePurchases: outcomes[0].upgrades,
    wallSeconds: +((Date.now() - started) / 1000).toFixed(2),
  };
  console.log(`${strategy}: ${JSON.stringify({ keyTargets: summary.strategies[strategy].keyTargets, reachedAll54Percent: summary.strategies[strategy].reachedAll54Percent, failed: summary.strategies[strategy].failedToCollect54 })}`);
}
mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, JSON.stringify(summary, null, 2));
console.log(`Saved ${destination} (stage durations in minutes; ${count} fixed seeds per strategy; limit ${limit / 60} min; no claim about 118).`);
