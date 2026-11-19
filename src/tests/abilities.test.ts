import { expect, it } from 'vitest';
import { activateElementAbility, abilityBonuses, availableAbilities } from '../game/abilityProgress';
import { getElementAbility } from '../game/elementAbilities';
import { Engine, createState } from '../game/engine';
import { D } from '../game/numbers';
import { deserialize, serialize } from '../game/save';

it('assigns one ability to every playable element and retains only legitimate activations on load', () => {
  const names = new Set<string>();
  for (let z = 1; z <= 54; z++) names.add(getElementAbility(z)!.name);
  expect(names.size).toBe(54);
  expect(getElementAbility(55)).toBeUndefined();

  const e = new Engine(createState(7));
  expect(activateElementAbility(e.state, 1)).toBe(false);
  e.state.elements[0].inventory = D(50);
  e.state.elements[0].totalProduced = D(50);
  expect(e.deposit(1)).toBe(50);
  expect(availableAbilities(e.state)).toEqual([1]);
  expect(activateElementAbility(e.state, 1)).toBe(true);
  expect(activateElementAbility(e.state, 1)).toBe(false);
  const raw = JSON.parse(serialize(e.state));
  raw.activeAbilities = [1, 1, 2, 55, '1'];
  const loaded = deserialize(JSON.stringify(raw));
  expect(loaded.activeAbilities).toEqual([1]);
  expect(availableAbilities(loaded)).toEqual([]);
  expect(abilityBonuses(loaded)).toEqual({ energy: 3, data: 0, production: 0 });
});

it('applies earned bonuses to actual energy, data and production with fixed offline settlement', () => {
  const baseline = new Engine(createState(9));
  baseline.target(1, 1);
  for (let z = 1; z <= 5; z++) baseline.state.elements[z - 1].discovered = true;
  for (const z of [1, 4, 5]) {
    const row = baseline.state.elements[z - 1];
    row.inventory = D(50); row.totalProduced = D(50);
    baseline.deposit(z);
  }
  const boosted = new Engine(deserialize(serialize(baseline.state)));
  for (const z of [1, 4, 5]) expect(activateElementAbility(boosted.state, z)).toBe(true);
  baseline.step(300, false);
  boosted.step(300, false);
  expect(boosted.state.coins.eq(baseline.state.coins.mul('1.03'))).toBe(true);
  expect(boosted.state.data.eq(baseline.state.data.mul('1.03'))).toBe(true);
  expect(boosted.state.elements[0].inventory.gt(baseline.state.elements[0].inventory)).toBe(true);
  expect(boosted.state.stats.events.eq(baseline.state.stats.events)).toBe(true);
});
