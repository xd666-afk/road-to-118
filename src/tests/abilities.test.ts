import { expect, it } from 'vitest';
import { abilityBonuses } from '../game/abilityProgress';
import { getElementAbility } from '../game/elementAbilities';
import { Engine, createState } from '../game/engine';
import { D } from '../game/numbers';
import { deserialize, serialize } from '../game/save';
import { archiveUnits } from '../game/config';
import { discoveryStage, stageReadiness } from '../game/discovery';

it('assigns one ability to every playable element and keeps the early hydrogen goal at 100', () => {
  const names = new Set<string>();
  for (let z = 1; z <= 56; z++) names.add(getElementAbility(z)!.name);
  expect(names.size).toBe(56);
  expect(getElementAbility(57)).toBeUndefined();

  const e = new Engine(createState(7));
  const h = e.state.elements[0];
  h.inventory = D(99);
  h.totalProduced = D(99);
  expect(e.deposit(1)).toBe(99);
  expect(abilityBonuses(e.state).energy).toBe(0);
  h.inventory = D(2);
  h.totalProduced = D(101);
  expect(e.deposit(1)).toBe(1);
  expect(h.inventory.eq(1)).toBe(true);
  expect(abilityBonuses(e.state).energy).toBe(3);
  expect(abilityBonuses(deserialize(serialize(e.state))).energy).toBe(3);
});

it('opens calcium exploration at 100 while its bonus activates exactly once at 150', () => {
  const e = new Engine(createState(29));
  e.state.elements.slice(0,20).forEach(row => { row.discovered = true; });
  e.state.coins = D(1e10); e.state.data = D(5e6);
  expect(e.build(6)).toBe(true);
  Object.assign(e.state.reactors[5].upgrades, { capacity: 1, yield: 3 });
  const ca = e.state.elements[19];
  ca.inventory = ca.totalProduced = D(149);
  const stage = discoveryStage(21)!;
  expect(stageReadiness(e.state, stage).ready).toBe(false);
  expect(e.deposit(20, false, 'calibration')).toBe(100);
  expect(stageReadiness(e.state, stage)).toMatchObject({ ready: true, calibrated: true });
  expect(e.deposit(20, false, 'calibration')).toBe(0);
  expect(e.deposit(20)).toBe(49);
  expect(ca.deposited).toBe(149);
  expect(abilityBonuses(e.state).production).toBe(0);
  expect(e.state.stats.calciumCompletedAt).toBeNull();
  ca.inventory = D(1); ca.totalProduced = D(150);
  expect(e.deposit(20)).toBe(1);
  expect(abilityBonuses(e.state).production).toBe(4);
  expect(e.deposit(20)).toBe(0);
  expect(e.state.notices.filter(n => n.kind === 'archive' && n.z === 20)).toHaveLength(1);
});

it('limits automatic calibration and filing rebates to the first hundred samples', () => {
  const e = new Engine(createState(32));
  e.state.elements.slice(0,20).forEach(row => { row.discovered = true; });
  e.state.reactors[0].active = false;
  e.state.modules.allocation = true;
  e.state.automation.allocation = true;
  e.state.automation.allocationScope = 'calibration';
  e.state.moduleLevels.allocation = 2;
  const ca = e.state.elements[19];
  ca.inventory = ca.totalProduced = D(200);
  e.step(1);
  expect(ca.deposited).toBe(100);
  expect(ca.archived).toBe(false);
  expect(e.state.data.eq(2000)).toBe(true);
  e.state.automation.allocationScope = 'all';
  e.step(1);
  expect(ca.deposited).toBe(archiveUnits(20));
  expect(ca.archived).toBe(true);
  expect(e.state.data.eq(2000)).toBe(true);
});

it('migrates version 8 completed abilities and continues partial higher-value archives', () => {
  const s = createState(31);
  s.elements.slice(0, 54).forEach(row => { row.discovered = true; });
  Object.assign(s.elements[53], { archived: true, deposited: 100, totalProduced: D(100) });
  Object.assign(s.elements[35], { deposited: 90, inventory: D(500), totalProduced: D(590) });
  s.stats.xeCompletedAt = 15;
  const old = JSON.parse(serialize(s));
  old.saveVersion = 8;
  const restored = deserialize(JSON.stringify(old));
  expect(restored.elements[53]).toMatchObject({ archived: true, deposited: 100 });
  expect(abilityBonuses(restored)[getElementAbility(54)!.channel]).toBe(getElementAbility(54)!.percent);
  const e = new Engine(restored);
  expect(e.deposit(36)).toBe(500);
  expect(e.state.elements[35]).toMatchObject({ archived: false, deposited: 590 });
  expect(deserialize(serialize(e.state)).elements[35].deposited).toBe(590);
});

it('honors an archived legacy sample and keeps partial submissions toward the new goal', () => {
  const raw = JSON.parse(serialize(createState(7)));
  raw.saveVersion = 3;
  raw.elements = raw.elements.slice(0, 54);
  raw.activeAbilities = [];
  Object.assign(raw.elements[0], { archived: true, deposited: 50, totalProduced: '50' });
  Object.assign(raw.elements[1], { discovered: true, deposited: 38, inventory: '65', totalProduced: '103' });
  const state = deserialize(JSON.stringify(raw));
  const reloaded = deserialize(serialize(state));
  expect(reloaded.elements[0]).toMatchObject({ archived: true, deposited: 50 });
  expect(reloaded.elements[0].totalProduced.eq(50)).toBe(true);
  expect(abilityBonuses(reloaded).energy).toBe(3);
  const e = new Engine(reloaded);
  expect(e.deposit(2)).toBe(62);
  expect(e.state.elements[1].inventory.eq(3)).toBe(true);
  expect(abilityBonuses(e.state).energy).toBe(5);
});

it('applies earned bonuses to actual energy, data and production with fixed offline settlement', () => {
  const baseline = new Engine(createState(9));
  baseline.target(1, 1);
  for (let z = 1; z <= 5; z++) baseline.state.elements[z - 1].discovered = true;
  const boosted = new Engine(deserialize(serialize(baseline.state)));
  for (const z of [1, 4, 5]) {
    const row = boosted.state.elements[z - 1];
    row.inventory = D(100); row.totalProduced = D(100);
    boosted.deposit(z);
  }
  baseline.step(300, false);
  boosted.step(300, false);
  expect(boosted.state.coins.eq(baseline.state.coins.mul('1.03'))).toBe(true);
  expect(boosted.state.data.eq(baseline.state.data.mul('1.03'))).toBe(true);
  expect(boosted.state.elements[0].inventory.gt(baseline.state.elements[0].inventory)).toBe(true);
  expect(boosted.state.stats.events.eq(baseline.state.stats.events)).toBe(true);
});
