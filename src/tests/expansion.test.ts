import { describe, expect, it } from 'vitest';
import { Engine, archivedCount, createState, discoveredMax } from '../game/engine';
import { D } from '../game/numbers';
import { capacity, eventRate, firstDiscoveryRate, income, probability } from '../game/economy';
import { deserialize, serialize } from '../game/save';
import { reactorDisplayPool } from '../game/visuals';
import { ATOMIC_PROFILES } from '../data/atomic';
import { KNOWLEDGE, element } from '../data/elements';
import { CALCIUM_ELEMENT, PLAYABLE_ELEMENTS, REACTORS, XENON_ELEMENT } from '../game/config';

function discover(e: Engine, z: number) {
  e.state.coins = D('1e40'); e.state.data = D('1e30');
  for (let n = discoveredMax(e.state) + 1; n <= z; n++) { e.target(1, n); e.state.reactors[0].discoveryHazard = 0; e.step(.1); }
}
function released10Save(version = 1) {
  const e = new Engine(createState(741, 100000)); discover(e, 10); e.build(2); e.build(3);
  e.state.elements[0].inventory = D(38); e.state.elements[0].totalProduced = D(38); e.deposit(1); e.buy(1, 'atoms', 12);
  e.state.elements[9].inventory = D(50); e.state.elements[9].totalProduced = D(50); e.deposit(10);
  e.state.coins = D('1e40'); e.state.data = D(90000);
  const raw = JSON.parse(serialize(e.state, 100000));
  raw.saveVersion = version; raw.elements = raw.elements.slice(0, 10); raw.reactors = raw.reactors.slice(0, 3);
  raw.stats.completedAt = raw.stats.neonCompletedAt; raw.stats.milestones.complete = raw.stats.milestones.neonArchive;
  delete raw.stats.neonCompletedAt; delete raw.stats.milestones.neonArchive; delete raw.stats.calciumCompletedAt; delete raw.stats.xeCompletedAt;
  return raw;
}
function released20Save() {
  const e = new Engine(createState(742, 100000)); discover(e, 20);
  for (const id of [2, 3, 4, 5]) e.build(id);
  e.research('feed'); e.research('reaction'); e.research('allocation');
  e.state.elements[0].inventory = D(38); e.state.elements[0].totalProduced = D(38); e.deposit(1);
  e.state.elements[9].inventory = D(50); e.state.elements[9].totalProduced = D(50); e.deposit(10);
  e.state.elements[19].inventory = D(50); e.state.elements[19].totalProduced = D(50); e.deposit(20);
  const raw = JSON.parse(serialize(e.state, 100000));
  raw.saveVersion = 2; raw.elements = raw.elements.slice(0, 20); raw.reactors = raw.reactors.slice(0, 5);
  raw.stats.completedAt = raw.stats.calciumCompletedAt; delete raw.stats.calciumCompletedAt; delete raw.stats.xeCompletedAt;
  return raw;
}

describe('H–Xe progression, instrumentation and migration', () => {
  it('opens IV at Ne, V at Ar, VI at Ca, VII at Kr and VIII at Xe', () => {
    const e = new Engine(createState(743));
    discover(e, 9); expect(e.build(2)).toBe(true); expect(e.build(3)).toBe(true); expect(e.build(4)).toBe(false);
    discover(e, 10); expect(e.state.elements[9].deposited).toBe(0); expect(e.build(4)).toBe(true);
    discover(e, 17); expect(e.build(5)).toBe(false); discover(e, 18); expect(e.build(5)).toBe(true);
    expect(e.build(6)).toBe(false); discover(e, 20); expect(e.build(6)).toBe(true);
    expect(e.build(7)).toBe(false); discover(e, 36); expect(e.build(7)).toBe(true);
    expect(e.build(8)).toBe(false); discover(e, 54); expect(e.build(8)).toBe(true);
    expect(e.state.reactors.slice(0, 3).every(r => r.built)).toBe(true);
  });
  it('keeps Ne and Ca as historical checkpoints, Xe as the 54th, and only marks completedAt at 54/54', () => {
    const e = new Engine(createState(744)); discover(e, 20);
    e.state.elements[9].inventory = D(50); e.state.elements[9].totalProduced = D(50); e.deposit(10);
    expect(e.state.stats.neonCompletedAt).not.toBeNull(); expect(e.state.stats.completedAt).toBeNull();
    const ca = e.state.elements[CALCIUM_ELEMENT - 1]; ca.inventory = D(50); ca.totalProduced = D(50); e.deposit(CALCIUM_ELEMENT);
    expect(e.state.stats.calciumCompletedAt).not.toBeNull(); expect(e.state.stats.xeCompletedAt).toBeNull(); expect(e.state.stats.completedAt).toBeNull();
    expect(e.state.achievements).toContain('complete'); expect(e.state.achievements).toContain('calcium_complete');
    expect(e.state.notices.filter(n => n.kind === 'complete')).toHaveLength(0);
    discover(e, 54);
    const xe = e.state.elements[XENON_ELEMENT - 1]; xe.inventory = D(50); xe.totalProduced = D(50); e.deposit(XENON_ELEMENT);
    expect(e.state.stats.xeCompletedAt).not.toBeNull(); expect(e.state.stats.completedAt).toBeNull();
    expect(e.state.achievements).toContain('xenon_complete');
    for (let z = 1; z <= PLAYABLE_ELEMENTS; z++) {
      const row = e.state.elements[z - 1]; if (row.archived) continue;
      row.inventory = D(50); row.totalProduced = row.totalProduced.plus(50); e.deposit(z, true);
    }
    expect(e.state.stats.completedAt).not.toBeNull();
    expect(e.state.notices.filter(n => n.kind === 'complete')).toHaveLength(1);
    const loaded = deserialize(serialize(e.state)); expect(loaded.stats.completedAt).toBe(e.state.stats.completedAt); expect(loaded.stats.xeCompletedAt).toBe(e.state.stats.xeCompletedAt);
  });
  it.each([0, 1])('preserves released v%i balances, RNG, partial archives and the Ne milestone', version => {
    const raw = released10Save(version), s = deserialize(JSON.stringify(raw));
    expect(s.saveVersion).toBe(3); expect(s.elements).toHaveLength(54); expect(s.reactors).toHaveLength(8);
    expect(s.coins.toString()).toBe(raw.coins); expect(s.data.toString()).toBe(raw.data); expect(s.rng).toBe(raw.rng);
    expect(s.elements[0].deposited).toBe(38); expect(s.elements[0].inventory.eq(12)).toBe(true);
    expect(s.stats.neonCompletedAt).toBe(raw.stats.completedAt); expect(s.stats.calciumCompletedAt).toBeNull(); expect(s.stats.xeCompletedAt).toBeNull(); expect(s.stats.completedAt).toBeNull();
    expect(s.stats.milestones.neonArchive).toBe(raw.stats.milestones.complete); expect(s.stats.milestones.complete).toBeUndefined();
    expect(s.achievements).toContain('complete'); expect(s.elements.slice(10).every(e => !e.discovered)).toBe(true);
    expect(s.reactors.slice(3).every(r => !r.built)).toBe(true);
    const e = new Engine(s);
    expect(e.build(4)).toBe(false);
    const balance = s.coins;
    const price = REACTORS[3];
    s.data = D(price.buildData);
    expect(e.build(4)).toBe(true);
    expect(s.coins.eq(balance.minus(price.buildCoins))).toBe(true);
    expect(s.data.eq(0)).toBe(true);
    e.target(4, 11); e.state.reactors[3].discoveryHazard = 0; e.step(.1);
    expect(discoveredMax(s)).toBe(11); expect(s.elements[0].deposited).toBe(38);
  });

  it('slows the first Na discovery even when upgraded instruments share the target', () => {
    const e = new Engine(createState(743));
    discover(e, 10);
    e.build(3);
    e.build(4);
    e.target(3, 11);
    e.target(4, 11);
    const reactors = e.state.reactors;
    const third = reactors[2], fourth = reactors[3];
    const normal = firstDiscoveryRate(fourth, reactors);
    for (const reactor of [third, fourth]) {
      reactor.upgrades.atoms = 1000;
      reactor.upgrades.capacity = 40;
      reactor.discoveryHazard = .8;
    }
    const boosted = firstDiscoveryRate(fourth, reactors);
    expect(boosted.gt(normal)).toBe(true);
    expect(boosted.plus(firstDiscoveryRate(third, reactors)).lt(D(1).div(24))).toBe(true);
    e.step(5);
    expect(discoveredMax(e.state)).toBe(10);
    e.step(60);
    expect(discoveredMax(e.state)).toBe(11);
    e.state.elements[10].inventory = D(0);
    e.step(5, false);
    expect(e.state.elements[10].inventory.gt(50)).toBe(true);
  });
  it('migrates a released v2 20/5 save without turning its Ca completion into Xe', () => {
    const raw = released20Save(), s = deserialize(JSON.stringify(raw));
    expect(s.saveVersion).toBe(3); expect(s.elements).toHaveLength(54); expect(s.reactors).toHaveLength(8);
    expect(s.elements[CALCIUM_ELEMENT - 1].archived).toBe(true);
    expect(s.stats.neonCompletedAt).not.toBeNull();
    expect(s.stats.calciumCompletedAt).toBe(raw.stats.completedAt);
    expect(s.stats.xeCompletedAt).toBeNull();
    expect(s.stats.completedAt).toBeNull();
    expect(s.stats.milestones.complete).toBe(raw.stats.milestones.complete);
    expect(s.stats.milestones.xeArchive).toBeUndefined();
    expect(s.elements.slice(20).every(e => !e.discovered && e.deposited === 0)).toBe(true);
    expect(s.reactors.slice(5).every(r => !r.built)).toBe(true);
    // The migrated save can genuinely continue: build VI, discover 21,
    // then build VII and reach/archive Xe and all 54 through the Engine.
    const e = new Engine(s); e.state.coins = D('1e40'); e.state.data = D('1e30');
    expect(e.build(6)).toBe(true); e.target(6, 21, true); e.state.reactors[5].discoveryHazard = 0; e.step(.1);
    expect(discoveredMax(e.state)).toBe(21);
    for (let z = 22; z <= 54; z++) { e.target(6, z, true); e.state.reactors[5].discoveryHazard = 0; e.step(.1); }
    expect(discoveredMax(e.state)).toBe(54); expect(e.build(7)).toBe(true);
    const xe = e.state.elements[XENON_ELEMENT - 1]; xe.inventory = D(50); xe.totalProduced = D(50); e.deposit(XENON_ELEMENT);
    expect(e.state.stats.xeCompletedAt).not.toBeNull();
    for (let z = 1; z <= PLAYABLE_ELEMENTS; z++) {
      const row = e.state.elements[z - 1]; if (row.archived) continue;
      row.inventory = D(50); row.totalProduced = row.totalProduced.plus(50); e.deposit(z, true);
    }
    expect(e.state.stats.completedAt).not.toBeNull();
    expect(archivedCount(e.state)).toBe(PLAYABLE_ELEMENTS);
  });
  it('rejects forged shapes, future unlocks and wrong checkpoint flags instead of silently erasing progress', () => {
    const raw = JSON.parse(serialize(createState(745)));
    for (const mutate of [
      (r: any) => r.reactors[3].built = true,
      (r: any) => r.reactors[5].built = true,
      (r: any) => r.reactors[6].built = true,
      (r: any) => r.stats.completedAt = 1,
      (r: any) => r.stats.calciumCompletedAt = 1,
      (r: any) => r.stats.xeCompletedAt = 1,
      (r: any) => r.stats.neonCompletedAt = 1,
      (r: any) => r.elements.pop(),
      (r: any) => r.saveVersion = 4,
    ]) { const copy = structuredClone(raw); mutate(copy); expect(() => deserialize(JSON.stringify(copy))).toThrow(); }
    const old = released20Save(); old.stats.completedAt = null; expect(() => deserialize(JSON.stringify(old))).toThrow();
  });
  it('makes new instruments faster than conventionally upgraded predecessors and richer at equal investment', () => {
    const s = createState(746); s.reactors.forEach(r => r.built = true);
    for (const [previous, next] of [[s.reactors[3], s.reactors[4]], [s.reactors[4], s.reactors[5]], [s.reactors[5], s.reactors[6]], [s.reactors[6], s.reactors[7]]]) {
      previous.upgrades.capacity = 4; previous.upgrades.yield = 8;
      expect(eventRate(next).gt(eventRate(previous))).toBe(true);
      expect(income({ ...next, upgrades: { ...previous.upgrades } }).gt(income(previous))).toBe(true);
    }
    for (let z = 21; z <= 36; z++) expect(probability(z, 6)).toBeGreaterThan(0);
    for (let z = 37; z <= 54; z++) expect(probability(z, 7)).toBeGreaterThan(0);
    expect(probability(54, 6)).toBeGreaterThan(0); expect(probability(53, 7)).toBeGreaterThan(0);
    expect(probability(55, 8)).toBe(0);
    expect(capacity(s.reactors[6]).gt(0)).toBe(true);
  });
  it('selects representative samples by adjacent reactor ranges and keeps all 21–54 records readable', () => {
    const s = createState(747); s.elements.forEach((e, i) => { e.discovered = i < 30; });
    s.reactors[5].target = 30;
    expect(reactorDisplayPool(s, s.reactors[5])).toEqual(Array.from({ length: 10 }, (_, i) => 21 + i));
    s.elements.forEach(e => { e.discovered = true; }); s.reactors[6].target = 54;
    expect(reactorDisplayPool(s, s.reactors[6])).toEqual(Array.from({ length: 18 }, (_, i) => 37 + i));
    for (let z = 21; z <= 54; z++) {
      expect(KNOWLEDGE[z].source).toContain(`/element/${z}/`);
      expect(element(z).mass).toBeDefined();
      expect(element(z).specimenDescription).toBeTruthy();
      expect(ATOMIC_PROFILES[z].shells.reduce((a, b) => a + b, 0)).toBe(z);
    }
    expect(ATOMIC_PROFILES[35].state).toBe('液态');
    expect(ATOMIC_PROFILES[54].isotope).toBe(132);
    expect(REACTORS[7].unlock).toBe(54);
  });
});
