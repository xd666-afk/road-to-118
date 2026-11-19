import { describe, expect, it } from 'vitest';
import { Engine, archivedCount, createFirstRun, createState, discoveredMax } from '../game/engine';
import { D, format } from '../game/numbers';
import { activeAtoms, eventRate, income, maxAffordable, price, probability } from '../game/economy';
import { deserialize, serialize } from '../game/save';
import { ELEMENTS, KNOWLEDGE } from '../data/elements';
const rich = () => { const e = new Engine(createState(123, 100000)); e.state.coins = D('1e100'); e.state.data = D('1e100'); return e; };
function discoverThrough(e: Engine, z: number) { for (let next = discoveredMax(e.state) + 1; next <= z; next++) { e.target(1, next); e.state.reactors[0].discoveryHazard = 0; e.step(.1); } }

describe('authoritative progression', () => {
  it('first He synthesis waits for the player and resumes after save, offline time, and pause', () => {
    const e = new Engine(createFirstRun());
    expect(e.target(1, 2, true)).toBe(false);
    e.beginOpening();
    e.toggleReactor(1);
    e.advance(20);
    expect(e.target(1, 2, true)).toBe(false);
    expect(e.state.elements[1].discovered).toBe(false);
    expect(e.buy(1, 'atoms', 1)).toBe(1);
    expect(e.target(1, 2, true)).toBe(true);
    e.advance(2);

    const resumed = new Engine(deserialize(serialize(e.state, 1000)));
    resumed.offline(31_000);
    resumed.toggleReactor(1);
    resumed.advance(10);
    expect(resumed.state.elements[1].discovered).toBe(false);
    resumed.toggleReactor(1);
    resumed.advance(2.75);
    expect(resumed.state.elements[1].discovered).toBe(false);
    resumed.advance(.25);
    expect(resumed.state.elements[1].inventory.eq(1)).toBe(true);
    expect(resumed.state.notices.filter(notice => notice.kind === 'discovery').map(notice => notice.z)).toEqual([2]);
    expect(resumed.state.reactors[0].target).toBe(2);
  });
  it('starts with exactly two H active samples, no coins; time yields money', () => { const e = new Engine(createState(1)); expect(activeAtoms(e.state.reactors[0]).eq(2)).toBe(true); expect(e.state.coins.eq(0)).toBe(true); expect(discoveredMax(e.state)).toBe(1); e.step(1); expect(e.state.coins.gt(0)).toBe(true); });
  it('rejects skipped or future targets; discovers ordered elements through Xe exactly once', () => { const e = rich(); expect(e.target(1, 3)).toBe(false); discoverThrough(e, 54); expect(discoveredMax(e.state)).toBe(54); expect(e.target(1, 55)).toBe(false); expect(e.state.notices.filter(n => n.kind === 'discovery').map(n => n.z)).toEqual(Array.from({length:53},(_,i)=>i+2)); e.step(100); expect(e.state.notices.filter(n => n.kind === 'discovery')).toHaveLength(53); });
  it('allows discovery independently of archiving, and gates construction at Be / N', () => { const e = rich(); expect(e.build(2)).toBe(false); discoverThrough(e, 4); expect(archivedCount(e.state)).toBe(0); expect(e.build(2)).toBe(true); expect(e.build(2)).toBe(false); expect(e.build(3)).toBe(false); discoverThrough(e, 7); expect(e.build(3)).toBe(true); expect(e.state.reactors.slice(0,3).every(r => r.built)).toBe(true); expect(e.state.reactors.slice(3).every(r=>!r.built)).toBe(true); });
  it('archives in integer installments, once, with no negative stock or active-sample drain', () => { const e = rich(), h = e.state.elements[0]; h.inventory = D(49); h.totalProduced = D(49); expect(e.deposit(1)).toBe(49); expect(h.archived).toBe(false); expect(e.deposit(1)).toBe(0); h.inventory = D(2); h.totalProduced = D(51); expect(e.deposit(1)).toBe(1); expect(h.archived).toBe(true); expect(h.inventory.eq(1)).toBe(true); expect(e.deposit(1)).toBe(0); expect(activeAtoms(e.state.reactors[0]).eq(2)).toBe(true); expect(e.state.notices.filter(n => n.kind === 'archive')).toHaveLength(1); });
  it('keeps Ca as a historical milestone, then completes Xe and full H–Xe separately', () => {
    const e = rich(); discoverThrough(e, 20);
    expect(e.state.stats.completedAt).toBeNull(); expect(e.state.stats.calciumCompletedAt).toBeNull();
    const ca = e.state.elements[19]; ca.inventory = D(49); ca.totalProduced = D(49); e.deposit(20);
    expect(e.state.stats.calciumCompletedAt).toBeNull(); expect(e.state.stats.completedAt).toBeNull();
    ca.inventory = D(1); ca.totalProduced = D(50); e.deposit(20);
    expect(e.state.stats.calciumCompletedAt).not.toBeNull(); expect(e.state.stats.completedAt).toBeNull();
    expect(e.state.notices.filter(n => n.kind === 'complete')).toHaveLength(0);
    discoverThrough(e, 54);
    const xe = e.state.elements[53]; xe.inventory = D(50); xe.totalProduced = D(50); e.deposit(54);
    expect(e.state.stats.xeCompletedAt).not.toBeNull(); expect(e.state.stats.completedAt).toBeNull();
    for (let z = 1; z <= 54; z++) {
      const element = e.state.elements[z - 1];
      if (element.archived) continue;
      element.inventory = D(50); element.totalProduced = element.totalProduced.plus(50); e.deposit(z, true);
    }
    expect(e.state.stats.completedAt).not.toBeNull();
    expect(e.state.notices.filter(n => n.kind === 'complete')).toHaveLength(1);
    const coins = e.state.coins; e.step(1); expect(e.state.coins.gte(coins)).toBe(true);
  });
  it('retains positive leap probabilities and awards hidden achievements for known repeat products', () => { const e = rich(); discoverThrough(e, 8); e.state.achievements = []; e.state.notices = []; e.target(1, 6); e.step(1e7); expect(probability(10, 1)).toBeGreaterThan(0); expect(e.state.achievements).toContain('limit'); expect(e.state.achievements).toContain('upstream'); expect(e.state.notices.some(n => n.kind === 'discovery')).toBe(false); e.build(2); e.target(2, 8); e.step(1e7); expect(e.state.achievements).toContain('old'); });
  it('new devices improve target probability/throughput and keep old chambers intact', () => { const e = rich(); discoverThrough(e, 7); e.build(2); e.build(3); const [a,b,c] = e.state.reactors; expect(eventRate(b).gt(eventRate(a))).toBe(true); expect(eventRate(c).gt(eventRate(b))).toBe(true); expect(probability(6,2)).toBeGreaterThan(probability(6,1)*10); expect(probability(9,3)).toBeGreaterThan(probability(9,2)*10); });
});
describe('economy, bulk purchases and huge numbers', () => {
  it.each([6,16,40,100,1000])('formats and round-trips 1e%i without Number overflow', exponent => { const value = D(`1e${exponent}`); expect(format(value)).not.toMatch(/Infinity|NaN/); expect(format(value, true)).toContain('e'); const e = new Engine(createState(2)); e.state.coins = value; const loaded = deserialize(serialize(e.state,100000)); expect(loaded.coins.eq(value)).toBe(true); expect(value.plus(value).eq(value.mul(2))).toBe(true); expect(value.minus(value.div(2)).eq(value.div(2))).toBe(true); });
  it('uses the Chinese unit mapping and handles zero safely', () => { expect(format(0)).toBe('0'); expect(format('1e4')).toBe('1万'); expect(format('1e16')).toBe('1京'); expect(format('1e40')).toBe('1正'); expect(format('1e44')).toBe('1载'); });
  it('charges the exact geometric batch price and improves income', () => { const e = rich(), r = e.state.reactors[0], before = e.state.coins, cost = price(r,'atoms',10), rate = income(r); expect(e.buy(1,'atoms',10)).toBe(10); expect(e.state.coins.eq(before.minus(cost))).toBe(true); expect(income(r).gt(rate)).toBe(true); expect(e.state.elements[0].inventory.eq(10)).toBe(true); });
  it('MAX computes logarithmically, never overspends, and checks exact boundaries', () => { const e = new Engine(createState(2)), r = e.state.reactors[0]; expect(e.buy(1,'atoms','max')).toBe(0); e.state.coins = price(r,'atoms',100); expect(maxAffordable(r,'atoms',e.state.coins)).toBe(100); const spent = price(r,'atoms',100); e.buy(1,'atoms','max'); expect(e.state.coins.eq(0)).toBe(true); expect(spent.gt(0)).toBe(true); e.state.coins = D('1e1000'); const amount = maxAffordable(r,'yield',e.state.coins); expect(amount).toBeGreaterThan(1000); const before = e.state.coins; expect(price(r,'yield',amount).lte(before)).toBe(true); expect(price(r,'yield',amount+1).gt(before)).toBe(true); e.buy(1,'yield','max'); expect(e.state.coins.gte(0)).toBe(true); expect(income(r).isFinite()).toBe(true); });
  it('does not charge failed purchases or buy unsupported upgrades', () => { const e = new Engine(createState(2)); expect(e.buy(1,'atoms',100)).toBe(0); expect(e.buy(1,'capacity',1)).toBe(0); expect(e.state.coins.eq(0)).toBe(true); });
  it('settles astronomical batches safely and keeps fifty-unit deposits exact', () => { const e = rich(); discoverThrough(e,10); e.build(3); e.research('feed'); e.research('reaction'); e.state.automation.feed=false; e.state.reactors[0].active=false; const r=e.state.reactors[2]; r.upgrades={atoms:10000000,speed:10000000,yield:10000,capacity:10000}; e.target(3,10); e.step(.1); expect(e.state.coins.isFinite()).toBe(true); expect(e.state.stats.events.isFinite()).toBe(true); expect(e.state.elements[9].inventory.gt('1e8')).toBe(true); expect(e.state.elements[9].inventory.isInteger()).toBe(true); expect(e.deposit(10)).toBe(50); expect(e.state.elements[9].deposited).toBe(50); });
  it('income is independent of dt and rendering frequency', () => { const a = new Engine(createState(30)), b = new Engine(createState(30)); a.state.reactors[0].target = 1; b.state.reactors[0].target = 1; for(let i=0;i<1000;i++) a.step(.1); for(let i=0;i<10;i++) b.step(10); expect(a.state.coins.div(b.state.coins).minus(1).abs().lt('1e-30')).toBe(true); expect(a.state.stats.events.div(b.state.stats.events).minus(1).abs().lt('1e-30')).toBe(true); });
});
describe('automation, offline and saves', () => {
  it('introduces the first automation module after He without requiring Be or archiving', () => { const e = rich(); expect(e.research('feed')).toBe(false); discoverThrough(e,2); expect(e.research('feed')).toBe(true); expect(archivedCount(e.state)).toBe(0); expect(e.state.modules.reaction).toBe(false); });
  it('automatic feeding stops at useful throughput and preserves construction funds after saturation', () => { const e = rich(); discoverThrough(e,2); e.research('feed'); const r=e.state.reactors[0]; e.state.coins=D(100000); e.state.automation.reserve=D(600); e.step(.1); expect(r.upgrades.atoms).toBeGreaterThan(0); expect(r.upgrades.atoms).toBeLessThan(10); const bought=r.upgrades.atoms, balance=e.state.coins; e.step(1); expect(r.upgrades.atoms).toBe(bought); expect(e.state.coins.gt(balance)).toBe(true); expect(e.state.coins.gte(600)).toBe(true); });
  it('keeps new opening milestones through save/load and accepts prior saves without them', () => { const e=rich(); e.buy(1,'atoms',1); discoverThrough(e,2); e.research('feed'); const loaded=deserialize(serialize(e.state)); expect(loaded.stats.milestones.firstUpgrade).toBe(0); expect(loaded.stats.milestones.module_feed).toBe(e.state.elapsed); const old=JSON.parse(serialize(e.state));delete old.stats.milestones.firstUpgrade;delete old.stats.milestones.module_feed;expect(deserialize(JSON.stringify(old)).stats.milestones.firstUpgrade).toBeUndefined(); });
  it('requires ordered modules; buys inside reserve; allocation stops at fifty', () => { const e = rich(); discoverThrough(e, 7); expect(e.research('reaction')).toBe(false); expect(e.research('feed')).toBe(true); expect(e.research('reaction')).toBe(true); expect(e.research('allocation')).toBe(true); e.state.coins = D(200); e.state.automation.reserve = D(150); e.state.reactors[0].active = false; const h = e.state.elements[0]; h.inventory = D(75); h.totalProduced = D(75); e.step(1); expect(e.state.coins.gte(150)).toBe(true); expect(h.deposited).toBe(50); expect(h.inventory.gte(25)).toBe(true); const deposited = h.deposited; e.step(1); expect(h.deposited).toBe(deposited); });
  it('manual exploration remains available under production and archive modes', () => { const e = rich(); discoverThrough(e, 4); e.research('feed'); e.research('reaction'); for (const mode of ['produce','archive'] as const) { e.setMode(mode,2); expect(e.target(1,discoveredMax(e.state)+1,true)).toBe(true); e.state.reactors[0].discoveryHazard=0; e.step(1); } expect(discoveredMax(e.state)).toBe(6); });
  it('offline caps at 4 hours, never discovers or awards hidden achievements, time reversal yields zero', () => { const e = new Engine(createState(5,100000)); const negative = e.offline(90000); expect(negative.seconds).toBe(0); expect(e.state.coins.eq(0)).toBe(true); const summary = e.offline(100000 + 24*3600*1000); expect(summary.seconds).toBe(14400); expect(discoveredMax(e.state)).toBe(1); discoverThrough(e,6); e.state.achievements = []; e.target(1,6); e.state.savedAt=100000; e.offline(100000+14400000); expect(e.state.elements[5].inventory.gt(0)).toBe(true); expect(e.state.achievements).not.toContain('limit'); expect(e.state.achievements).not.toContain('upstream'); });
  it('round-trips fully populated state with RNG state preserved and accepts a structured v0 migration', () => { const e = rich(); discoverThrough(e,7); e.build(2); e.build(3); e.research('feed'); e.research('reaction'); e.state.notices=[]; const text = serialize(e.state,999999), loaded = deserialize(text); expect(JSON.parse(serialize(loaded,999999))).toEqual(JSON.parse(text)); const old = JSON.parse(text); old.saveVersion=0; old.elements=old.elements.slice(0,10); old.reactors=old.reactors.slice(0,3); delete old.stats.neonCompletedAt; delete old.stats.calciumCompletedAt; delete old.stats.xeCompletedAt; expect(deserialize(JSON.stringify(old)).saveVersion).toBe(3); });
  it.each(['{bad','{}','null','[]','{"saveVersion":100}'])('rejects malformed saves safely: %s', text => { expect(() => deserialize(text)).toThrow(); });
  it('rejects invalid balances, noninteger deposits, out-of-order discoveries and corrupt unlocks', () => { const raw = JSON.parse(serialize(createState(3))); for(const mutate of [(s:any)=>s.coins='Infinity',(s:any)=>s.elements[0].deposited=49.5,(s:any)=>s.elements[3].discovered=true,(s:any)=>s.reactors[2].built=true,(s:any)=>s.elements[0].inventory='1e1000']) { const copy=structuredClone(raw);mutate(copy);expect(()=>deserialize(JSON.stringify(copy))).toThrow(); } });
});
describe('educational data', () => {
  it('places all 118 real elements in unique valid cells and supplies readable H–Xe knowledge', () => { expect(ELEMENTS).toHaveLength(118); expect(new Set(ELEMENTS.map(e=>e.z)).size).toBe(118); expect(new Set(ELEMENTS.map(e=>`${e.row}:${e.col}`)).size).toBe(118); expect(ELEMENTS.every(e=>e.col>=1&&e.col<=18&&[1,2,3,4,5,6,7,9,10].includes(e.row))).toBe(true); expect(ELEMENTS[9]).toMatchObject({z:10,symbol:'Ne',col:18,row:2});expect(ELEMENTS[53]).toMatchObject({z:54,symbol:'Xe',name:'氙',col:18,row:5});expect(ELEMENTS[117]).toMatchObject({z:118,symbol:'Og',name:'鿫',col:18,row:7}); expect(Object.keys(KNOWLEDGE)).toHaveLength(54); expect(ELEMENTS.slice(0,54).every(e=>e.mass&&e.specimenDescription&&KNOWLEDGE[e.z])).toBe(true); expect(Object.values(KNOWLEDGE).every(k=>k.source.startsWith('https://periodic-table.rsc.org/'))).toBe(true); });
});
