import { expect, it } from 'vitest';
import { abilityBonuses } from '../game/abilityProgress';
import { getElementAbility } from '../game/elementAbilities';
import { Engine, createState } from '../game/engine';
import { D } from '../game/numbers';
import { deserialize, serialize } from '../game/save';

it('assigns one ability to every playable element and applies it on the hundredth submission', () => {
  const names = new Set<string>();
  for (let z = 1; z <= 55; z++) names.add(getElementAbility(z)!.name);
  expect(names.size).toBe(55);
  expect(getElementAbility(56)).toBeUndefined();

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
