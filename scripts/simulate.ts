import { writeFileSync, mkdirSync } from 'node:fs';
import { Engine, createState, discoveredMax, highestReactor } from '../src/game/engine';
import { D } from '../src/game/numbers';
import { eventRate, income, price } from '../src/game/economy';
import { MODULES, REACTORS } from '../src/game/config';
import type { Module, Upgrade } from '../src/game/types';

export function pilot(e: Engine, strategy: 'balanced' | 'automation') {
  const s = e.state, max = discoveredMax(s);
  // Real resource checks inside every command. No free equipment or guaranteed discoveries.
  for (const id of [2,3]) e.build(id);
  const top = highestReactor(s);
  if (max < 10) e.target(top.id, max + 1, true);
  else { if (top.target !== 10 || top.exploring) e.target(top.id,10,false); }
  if (max >= 4 && s.reactors[1].built) {
    for (const key of ['feed','reaction','allocation'] as Module[]) {
      const m = MODULES[key];
      if (!s.modules[key] && s.coins.gte(m.coins) && s.data.gte(m.data) && max >= m.unlock) e.research(key);
    }
    // The baseline automation policy preserves money for new equipment instead of spending everything.
    s.automation.reserve = D(s.reactors[2].built ? 20000 : 180000);
    s.automation.feed = strategy === 'automation';
  }
  for (const r of s.reactors.filter(r=>r.built)) {
    const next = !s.reactors[1].built ? REACTORS[1] : !s.reactors[2].built ? REACTORS[2] : null;
    const reserve = next && max >= next.unlock ? D(next.buildCoins) : D(0);
    const candidates: {key:Upgrade; roi:number}[] = [];
    for(const key of ['atoms','speed','yield','capacity'] as Upgrade[]) {
      if(key==='capacity'&&(r.id===1||r.upgrades.capacity>=4)) continue;
      if(key==='yield'&&r.upgrades.yield>=8) continue;
      const cost=price(r,key), clone={...r,upgrades:{...r.upgrades,[key]:r.upgrades[key]+1}}, delta=income(clone).minus(income(r));
      if(delta.lte(0)||s.coins.minus(reserve).lt(cost)) continue;
      const roi=cost.div(delta).toNumber(); if(roi < (strategy==='balanced'?160:110)) candidates.push({key,roi});
    }
    candidates.sort((a,b)=>a.roi-b.roi);
    if(candidates.length) e.buy(r.id,candidates[0].key,1);
    if(r.id!==top.id && r.target!==Math.min(max,REACTORS[r.id-1].softMax)) e.target(r.id,Math.min(max,REACTORS[r.id-1].softMax),false);
  }
  if(max===10) e.deposit(10,true);
  if(strategy==='automation'&&s.modules.allocation) for(let z=1;z<=max;z++) e.deposit(z,true);
  s.notices=[];
}

const count=Math.max(10,Number(process.argv.find(a=>a.startsWith('--runs='))?.split('=')[1]||1000));
const limit=7200, dt=5, summary:any={ runsPerStrategy:count, dtSeconds:dt, limitMinutes:limit/60, generatedAt:new Date().toISOString(), strategies:{} };
for(const strategy of ['balanced','automation'] as const) {
  const outcomes:{ milestones:Record<string,number>; upgrades:unknown; max:number; failed:boolean }[]=[];
  const started=Date.now();
  for(let run=0;run<count;run++) {
    const seed=(Math.imul(run+1,2654435761)+(strategy==='balanced'?17:41))>>>0, e=new Engine(createState(seed,0));
    while(e.state.elapsed<limit && e.state.stats.completedAt===null) { pilot(e,strategy); e.step(dt,true); }
    outcomes.push({milestones:e.state.stats.milestones,upgrades:e.state.reactors.map(r=>({...r.upgrades})),max:discoveredMax(e.state),failed:e.state.stats.completedAt===null});
    if((run+1)%100===0) process.stderr.write(`${strategy}: ${run+1}/${count}\n`);
  }
  const quantiles=(key:string)=>{ const vals=outcomes.map(o=>o.milestones[key]).filter(v=>v!==undefined).sort((a,b)=>a-b); return { reached:vals.length,p10:vals.length?+(vals[Math.floor((vals.length-1)*.1)]/60).toFixed(2):null,p50:vals.length?+(vals[Math.floor((vals.length-1)*.5)]/60).toFixed(2):null,p90:vals.length?+(vals[Math.floor((vals.length-1)*.9)]/60).toFixed(2):null }; };
  summary.strategies[strategy]={ stages:Object.fromEntries(['element2','reactor2','reactor3','element10','complete'].map(key=>[key,quantiles(key)])), failed:outcomes.filter(o=>o.failed).length, stalledExamples:outcomes.map((o,i)=>({...o,run:i})).filter(o=>o.failed).slice(0,3),examplePurchases:outcomes[0].upgrades,wallSeconds:+((Date.now()-started)/1000).toFixed(2) };
  console.log(`${strategy}: ${JSON.stringify(summary.strategies[strategy])}`);
}
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/simulation.json',JSON.stringify(summary,null,2));
console.log('Saved artifacts/simulation.json (all stage durations in minutes).');
