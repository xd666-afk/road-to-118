import { writeFileSync, mkdirSync } from 'node:fs';
import { Engine, createState, discoveredMax, archivedCount } from '../src/game/engine';
import { recommend, applyAdvice, openingStep } from '../src/game/advisor';

// No injected funds, discoveries, probabilities or upgrades. Follow the visible
// recommendation once every 8 seconds, leaving notices out of the engine policy.
const outcomes = [];
for (let run = 0; run < 30; run++) {
  const seed = (Math.imul(run + 1, 2654435761) + 1911) >>> 0;
  const e = new Engine(createState(seed, 0));
  const changes: { t: number; id: string; label: string }[] = [];
  let last = '';
  while (e.state.elapsed < 3600 && e.state.stats.completedAt === null) {
    if (e.state.elapsed % 8 === 0) {
      const a = recommend(e.state);
      if (a.id !== last) { changes.push({ t: e.state.elapsed, id: a.id, label: a.label }); last = a.id; }
      if (a.enabled && a.action !== 'table') applyAdvice(e, a);
    }
    e.step(2, true);
    e.state.notices = [];
  }
  outcomes.push({ seed, elapsed: e.state.elapsed, max: discoveredMax(e.state),
    archiveCount: archivedCount(e.state), openingStep: openingStep(e.state),
    neonArchived: e.state.elements[9].archived, calciumArchived: e.state.elements[19].archived,
    milestones: e.state.stats.milestones, advice: recommend(e.state), changes,
    upgrades: e.state.reactors.filter(r => r.built).map(r => ({id:r.id, ...r.upgrades})) });
}
const times = outcomes.filter(o => o.calciumArchived).map(o => o.elapsed / 60).sort((a,b)=>a-b);
const result = { policy: '30 seeded runs, real new-game resources, visible advice every 8s, 2s engine steps, 60m cap; engine simulation only, not a real-time human playthrough',
  reachedCalcium: times.length, reachedNeonArchive: outcomes.filter(o=>o.neonArchived).length,
  fastestMinutes: times[0] ?? null, medianMinutes: times[Math.floor(times.length/2)] ?? null,
  slowestMinutes: times.at(-1) ?? null, outcomes };
mkdirSync('artifacts/nexus-playtest-20261118', {recursive:true});
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
  || 'artifacts/nexus-playtest-20261118/advisor-simulation.json';
writeFileSync(output, JSON.stringify(result,null,2));
console.log(JSON.stringify({...result, outcomes: undefined}));
