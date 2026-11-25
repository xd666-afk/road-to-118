import { expect, test } from 'vitest';
import { acceleratorBatch, acceleratorRecipes, bariumBeamOffset } from '../game/accelerator';
import { abilityBonuses } from '../game/abilityProgress';
import { BARIUM_ELEMENT, CAESIUM_ELEMENT, XENON_ELEMENT, archiveUnits } from '../game/config';
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
  const runs = Math.ceil(archiveUnits(CAESIUM_ELEMENT) / acceleratorBatch.output);
  xenon.inventory = D(acceleratorRecipes[CAESIUM_ELEMENT].units * runs);
  xenon.totalProduced = D(100).plus(xenon.inventory);
  state.data = D(acceleratorRecipes[CAESIUM_ELEMENT].data * runs);
  state.reactors[0].active = false;
  const before = JSON.parse(serialize(state, 1000));
  before.saveVersion = 5;
  before.elements = before.elements.slice(0, XENON_ELEMENT);
  before.accelerator = { built: 4, commissioned: false };
  let engine = new Engine(deserialize(JSON.stringify(before)));
  expect(discoveredMax(engine.state)).toBe(XENON_ELEMENT);
  expect(engine.state.stats.completedAt).toBe(60);
  expect(engine.target(1, CAESIUM_ELEMENT)).toBe(false);
  expect(engine.startAcceleratorRun(CAESIUM_ELEMENT)).toBe(false);
  expect(engine.commissionAccelerator()).toBe(true);

  const originalBonus = abilityBonuses(engine.state).data;
  for (let batch = 1; batch <= runs; batch++) {
    expect(engine.startAcceleratorRun(CAESIUM_ELEMENT)).toBe(true);
    expect(engine.startAcceleratorRun(CAESIUM_ELEMENT)).toBe(false);
    engine.step(4);
    expect(engine.claimAcceleratorRun(CAESIUM_ELEMENT)).toBe(false);
    engine = new Engine(deserialize(serialize(engine.state, 2000)));
    engine.offline(62_000);
    expect(engine.state.accelerator.runRemaining).toBe(acceleratorBatch.seconds - 4);
    engine.step(acceleratorBatch.seconds - 4);
    expect(engine.claimAcceleratorRun(CAESIUM_ELEMENT)).toBe(true);
    expect(engine.claimAcceleratorRun(CAESIUM_ELEMENT)).toBe(false);
    expect(engine.state.elements[CAESIUM_ELEMENT - 1].inventory.eq(batch * acceleratorBatch.output)).toBe(true);
  }
  expect(discoveredMax(engine.state)).toBe(CAESIUM_ELEMENT);
  expect(engine.state.data.isZero()).toBe(true);
  expect(engine.state.elements[XENON_ELEMENT - 1].inventory.isZero()).toBe(true);
  expect(engine.deposit(CAESIUM_ELEMENT)).toBe(archiveUnits(CAESIUM_ELEMENT));
  expect(abilityBonuses(engine.state).data - originalBonus).toBe(4);
  const restored = deserialize(serialize(engine.state));
  expect(restored.stats.completedAt).toBe(60);
  expect(restored.elements[CAESIUM_ELEMENT - 1].archived).toBe(true);
});

test('three different signal sweeps can be locked and keep their sample bonus after reload', () => {
  const state = createState(56);
  state.elements.slice(0, XENON_ELEMENT).forEach(row => { row.discovered = true; });
  state.accelerator = { built: 4, commissioned: true };
  state.reactors[0].active = false;
  state.elements[XENON_ELEMENT - 1].inventory = D(acceleratorRecipes[CAESIUM_ELEMENT].units);
  state.elements[XENON_ELEMENT - 1].totalProduced = D(acceleratorRecipes[CAESIUM_ELEMENT].units);
  state.data = D(acceleratorRecipes[CAESIUM_ELEMENT].data);
  let engine = new Engine(state);
  expect(engine.startAcceleratorRun(CAESIUM_ELEMENT)).toBe(true);
  for (const [index, next] of [7, 4, 0].entries()) {
    expect(engine.lockCaesiumSignal()).toBe(false);
    engine.step(.75);
    expect(engine.lockCaesiumSignal()).toBe(true);
    engine = new Engine(deserialize(serialize(engine.state)));
    expect(engine.state.accelerator).toMatchObject({ runRemaining: next, runLocks: index + 1 });
  }
  expect(engine.state.elapsed).toBe(2.25);
  expect(engine.claimAcceleratorRun(CAESIUM_ELEMENT)).toBe(true);
  expect(engine.state.elements[CAESIUM_ELEMENT - 1].inventory.eq(40)).toBe(true);
  expect(engine.state.accelerator.runLocks).toBeUndefined();
});

test('restores a version 6 Cs scan with its capture bonus', () => {
  const state = createState(67);
  state.elements.slice(0, XENON_ELEMENT).forEach(row => { row.discovered = true; });
  state.accelerator = { built: 4, commissioned: true, runRemaining: 7, runLocks: 1 };
  const old = JSON.parse(serialize(state));
  old.saveVersion = 6;
  old.elements = old.elements.slice(0, CAESIUM_ELEMENT);

  const engine = new Engine(deserialize(JSON.stringify(old)));
  expect(engine.state.accelerator).toMatchObject({ runTarget: CAESIUM_ELEMENT, runRemaining: 7, runLocks: 1 });
  expect(engine.state.elements[BARIUM_ELEMENT - 1].discovered).toBe(false);
  engine.step(7);
  expect(engine.claimAcceleratorRun(CAESIUM_ELEMENT)).toBe(true);
  expect(engine.state.elements[CAESIUM_ELEMENT - 1].inventory.toNumber()).toBe(30);
});

test('Ba requires the Cs archive and supports paid, resumable manual or passive scans', () => {
  const state = createState(68);
  state.elements.slice(0, CAESIUM_ELEMENT).forEach(row => { row.discovered = true; });
  state.accelerator = { built: 4, commissioned: true };
  state.reactors[0].active = false;
  const recipe = acceleratorRecipes[BARIUM_ELEMENT];
  const krypton = state.elements[recipe.sample - 1];
  krypton.inventory = krypton.totalProduced = D(recipe.units * 2);
  state.data = D(recipe.data * 2);
  const caesium = state.elements[CAESIUM_ELEMENT - 1];
  caesium.inventory = caesium.totalProduced = D(archiveUnits(CAESIUM_ELEMENT));
  let engine = new Engine(state);
  expect(engine.startAcceleratorRun(BARIUM_ELEMENT)).toBe(false);
  expect(engine.deposit(CAESIUM_ELEMENT)).toBe(archiveUnits(CAESIUM_ELEMENT));
  expect(engine.target(1, BARIUM_ELEMENT)).toBe(false);
  expect(engine.startAcceleratorRun(BARIUM_ELEMENT)).toBe(true);
  expect(engine.startAcceleratorRun(BARIUM_ELEMENT)).toBe(false);
  expect(engine.lockCaesiumSignal()).toBe(false);
  expect(engine.adjustBariumBeam(-1)).toBe(false);
  expect(engine.adjustBariumBeam(1)).toBe('adjusted');
  engine = new Engine(deserialize(serialize(engine.state)));
  expect(bariumBeamOffset(engine.state)).toBe(-1);
  expect(engine.state.accelerator.runRemaining).toBe(10);
  expect(engine.adjustBariumBeam(1)).toBe('focused');
  expect(engine.adjustBariumBeam(-1)).toBe('focused');
  expect(engine.adjustBariumBeam(1)).toBe('adjusted');
  expect(engine.adjustBariumBeam(1)).toBe('focused');
  expect(engine.adjustBariumBeam(1)).toBe(false);
  expect(engine.claimAcceleratorRun(CAESIUM_ELEMENT)).toBe(false);
  expect(engine.claimAcceleratorRun(BARIUM_ELEMENT)).toBe(true);
  expect(engine.claimAcceleratorRun(BARIUM_ELEMENT)).toBe(false);
  const barium = engine.state.elements[BARIUM_ELEMENT - 1];
  expect(barium.inventory.toNumber()).toBe(40);

  expect(engine.startAcceleratorRun(BARIUM_ELEMENT)).toBe(true);
  const nextPattern = bariumBeamOffset(engine.state);
  expect(nextPattern).toBe(2);
  expect(engine.adjustBariumBeam(-1)).toBe('adjusted');
  engine.step(3);
  expect(engine.state.accelerator.runOffset).toBeUndefined();
  expect(bariumBeamOffset(engine.state)).toBe(-1);
  engine.step(7);
  expect(engine.claimAcceleratorRun(BARIUM_ELEMENT)).toBe(true);
  expect(barium.inventory.toNumber()).toBe(65);
  expect(engine.state.data.toNumber()).toBe(0);
  expect(engine.state.elements[recipe.sample - 1].inventory.toNumber()).toBe(0);
});
