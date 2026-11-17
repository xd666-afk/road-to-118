import { describe, expect, it } from 'vitest';
import { Engine, createState, discoveredMax } from '../game/engine';
import { D } from '../game/numbers';
import { capacity, eventRate, income, probability } from '../game/economy';
import { deserialize, serialize } from '../game/save';
import { reactorDisplayPool } from '../game/visuals';
import { ATOMIC_PROFILES } from '../data/atomic';
import { KNOWLEDGE, element } from '../data/elements';

function discover(e: Engine, z: number) {
  e.state.coins=D('1e40');e.state.data=D('1e30');
  for(let n=discoveredMax(e.state)+1;n<=z;n++){e.target(1,n);e.state.reactors[0].discoveryHazard=0;e.step(.1);}
}
function legacySave(version=1) {
  const e=new Engine(createState(741,100000));discover(e,10);e.build(2);e.build(3);
  e.state.elements[0].inventory=D(38);e.state.elements[0].totalProduced=D(38);e.deposit(1);e.buy(1,'atoms',12);
  e.state.elements[9].inventory=D(50);e.state.elements[9].totalProduced=D(50);e.deposit(10);
  e.state.coins=D('1e40');e.state.data=D(90000);
  const raw=JSON.parse(serialize(e.state,100000));
  raw.saveVersion=version;raw.elements=raw.elements.slice(0,10);raw.reactors=raw.reactors.slice(0,3);
  raw.stats.completedAt=raw.stats.neonCompletedAt;raw.stats.milestones.complete=raw.stats.milestones.neonArchive;
  delete raw.stats.neonCompletedAt;delete raw.stats.milestones.neonArchive;
  return raw;
}

describe('twenty-element progression and migration',()=>{
  it('opens IV at Ne and V at Ar, independently of submitting either element',()=>{
    const e=new Engine(createState(742));discover(e,9);expect(e.build(4)).toBe(false);
    discover(e,10);expect(e.state.elements[9].deposited).toBe(0);expect(e.build(4)).toBe(true);
    discover(e,17);expect(e.build(5)).toBe(false);discover(e,18);expect(e.build(5)).toBe(true);
    expect(e.state.reactors[0].built).toBe(true);
  });
  it('keeps Ne as a historical milestone and completes the new stage only at 50 Ca',()=>{
    const e=new Engine(createState(743));discover(e,20);
    e.state.elements[9].inventory=D(50);e.state.elements[9].totalProduced=D(50);e.deposit(10);
    expect(e.state.stats.neonCompletedAt).not.toBeNull();expect(e.state.stats.completedAt).toBeNull();
    expect(e.state.notices.filter(n=>n.kind==='complete')).toHaveLength(0);
    const ca=e.state.elements[19];ca.inventory=D(49);ca.totalProduced=D(49);e.deposit(20);expect(e.state.stats.completedAt).toBeNull();
    ca.inventory=D(1);ca.totalProduced=D(50);e.deposit(20);e.deposit(20);
    expect(e.state.achievements).toContain('complete');expect(e.state.achievements).toContain('calcium_complete');
    expect(e.state.notices.filter(n=>n.kind==='complete')).toHaveLength(1);
    const loaded=deserialize(serialize(e.state));expect(loaded.stats.completedAt).toBe(e.state.stats.completedAt);
  });
  it.each([0,1])('preserves released v%i balances, RNG, partial archives and the Ne milestone',version=>{
    const raw=legacySave(version),s=deserialize(JSON.stringify(raw));
    expect(s.saveVersion).toBe(2);expect(s.elements).toHaveLength(20);expect(s.reactors).toHaveLength(5);
    expect(s.coins.toString()).toBe(raw.coins);expect(s.data.toString()).toBe(raw.data);expect(s.rng).toBe(raw.rng);
    expect(s.elements[0].deposited).toBe(38);expect(s.elements[0].inventory.eq(12)).toBe(true);
    expect(s.stats.neonCompletedAt).toBe(raw.stats.completedAt);expect(s.stats.completedAt).toBeNull();
    expect(s.stats.milestones.neonArchive).toBe(raw.stats.milestones.complete);expect(s.stats.milestones.complete).toBeUndefined();
    expect(s.achievements).toContain('complete');expect(s.elements.slice(10).every(e=>!e.discovered)).toBe(true);
    expect(s.reactors.slice(3).every(r=>!r.built)).toBe(true);
    const e=new Engine(s);expect(e.build(4)).toBe(true);e.target(4,11);e.state.reactors[3].discoveryHazard=0;e.step(.1);
    expect(discoveredMax(s)).toBe(11);expect(s.elements[0].deposited).toBe(38);
  });
  it('rejects forged shapes, future unlocks and stage flags instead of silently erasing progress',()=>{
    const raw=JSON.parse(serialize(createState(744)));
    for(const mutate of [(r:any)=>r.reactors[3].built=true,(r:any)=>r.reactors[4].built=true,(r:any)=>r.stats.completedAt=1,(r:any)=>r.stats.neonCompletedAt=1,(r:any)=>r.elements.pop(),(r:any)=>r.saveVersion=3]){
      const copy=structuredClone(raw);mutate(copy);expect(()=>deserialize(JSON.stringify(copy))).toThrow();
    }
    const old=legacySave();old.stats.completedAt=null;expect(()=>deserialize(JSON.stringify(old))).toThrow();
  });
  it('makes new devices faster than conventionally upgraded predecessors and keeps leap chances positive',()=>{
    const s=createState(745);s.reactors.forEach(r=>r.built=true);
    for(const [previous,next] of [[s.reactors[2],s.reactors[3]],[s.reactors[3],s.reactors[4]]]){
      previous.upgrades.capacity=4;previous.upgrades.yield=8;
      expect(eventRate(next).gt(eventRate(previous))).toBe(true);expect(income(next).gt(income(previous))).toBe(true);
    }
    expect(probability(11,4)).toBeGreaterThan(probability(11,3)*100);
    expect(probability(19,5)).toBeGreaterThan(probability(19,4)*10);
    expect(probability(20,1)).toBeGreaterThan(0);expect(probability(21,5)).toBe(0);
    expect(capacity(s.reactors[4]).gt(0)).toBe(true);
  });
  it('uses discovered third/fourth-period samples, larger spheres and complete science data',()=>{
    const s=createState(746);s.elements.forEach((e,i)=>e.discovered=i<17);s.reactors[3].target=18;
    expect(reactorDisplayPool(s,s.reactors[3])).toEqual([11,12,13,14,15,16,17]);
    s.elements[17].discovered=true;s.elements[18].discovered=true;s.reactors[4].target=20;
    expect(reactorDisplayPool(s,s.reactors[4])).toEqual([19]);
    for(let z=11;z<=20;z++){expect(KNOWLEDGE[z].source).toContain(`/element/${z}/`);expect(element(z).mass).toBeDefined();expect(ATOMIC_PROFILES[z].shells.reduce((a,b)=>a+b,0)).toBe(z);}
    expect(ATOMIC_PROFILES[17].isotope).toBe(35);expect(ATOMIC_PROFILES[18].isotope).toBe(40);
    expect(ATOMIC_PROFILES[15].melting).toContain('白磷');expect(element(15).specimenDescription).toContain('红磷');
  });
});
