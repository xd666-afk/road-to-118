import { expect, test } from 'vitest';
import { caesiumRun } from '../game/accelerator';
import { abilityBonuses } from '../game/abilityProgress';
import { CAESIUM_ELEMENT, XENON_ELEMENT } from '../game/config';
import { createState, discoveredMax, Engine } from '../game/engine';
import { D } from '../game/numbers';
import { deserialize, serialize } from '../game/save';

test('migrates an H–Xe save and completes Cs only through paid, online accelerator runs', () => {
  const state = createState(55, 1000);
  for (const row of state.elements.slice(0, XENON_ELEMENT)) {
    Object.assign(row, { discovered: true, archived: true, deposited: 100, totalProduced: D(100) });
  }
  Object.assign(state.stats, { neonCompletedAt: 10, calciumCompletedAt: 20, xeCompletedAt: 40, completedAt: 60 });
  const xenon = state.elements[XENON_ELEMENT - 1];
  xenon.inventory = D(caesiumRun.xenon * 4);
  xenon.totalProduced = D(100).plus(xenon.inventory);
  state.data = D(caesiumRun.data * 4);
  state.reactors[0].active = false;
  const before = JSON.parse(serialize(state, 1000));
  before.saveVersion = 5;
  before.elements.pop();
  before.accelerator = { built: 4, commissioned: false };
  let engine = new Engine(deserialize(JSON.stringify(before)));
  expect(discoveredMax(engine.state)).toBe(XENON_ELEMENT);
  expect(engine.state.stats.completedAt).toBe(60);
  expect(engine.target(1, CAESIUM_ELEMENT)).toBe(false);
  expect(engine.startCaesiumRun()).toBe(false);
  expect(engine.commissionAccelerator()).toBe(true);

  const originalBonus = abilityBonuses(engine.state).data;
  for (let batch = 1; batch <= 4; batch++) {
    expect(engine.startCaesiumRun()).toBe(true);
    expect(engine.startCaesiumRun()).toBe(false);
    engine.step(4);
    expect(engine.claimCaesiumRun()).toBe(false);
    engine = new Engine(deserialize(serialize(engine.state, 2000)));
    engine.offline(62_000);
    expect(engine.state.accelerator.runRemaining).toBe(caesiumRun.seconds - 4);
    engine.step(caesiumRun.seconds - 4);
    expect(engine.claimCaesiumRun()).toBe(true);
    expect(engine.claimCaesiumRun()).toBe(false);
    expect(engine.state.elements[CAESIUM_ELEMENT - 1].inventory.eq(batch * caesiumRun.output)).toBe(true);
  }
  expect(discoveredMax(engine.state)).toBe(CAESIUM_ELEMENT);
  expect(engine.state.data.isZero()).toBe(true);
  expect(engine.state.elements[XENON_ELEMENT - 1].inventory.isZero()).toBe(true);
  expect(engine.deposit(CAESIUM_ELEMENT)).toBe(100);
  expect(abilityBonuses(engine.state).data - originalBonus).toBe(4);
  const restored = deserialize(serialize(engine.state));
  expect(restored.stats.completedAt).toBe(60);
  expect(restored.elements[CAESIUM_ELEMENT - 1].archived).toBe(true);
});
