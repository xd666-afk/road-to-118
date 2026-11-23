import { expect, it } from 'vitest';
import { createState, Engine } from '../game/engine';
import { deserialize, serialize } from '../game/save';

function atOxygen() {
  const state = createState(8);
  for (const row of state.elements.slice(0, 8)) row.discovered = true;
  const [support, lead] = state.reactors;
  support.target = 1;
  support.upgrades.atoms = 30;
  lead.built = true;
  lead.target = 9;
  lead.discoveryHazard = 0;
  state.discoveryWait = 40;
  return new Engine(state);
}

it('assigns real instruments, overlaps fluorine preparation and pays an investigation only once', () => {
  const engine = atOxygen();
  expect(engine.startSampleContract('helium', 2)).toBe(false);
  expect(engine.startSampleContract('helium', 1)).toBe(true);
  expect(engine.revealSampleContract(9)).toBe(false);
  engine.step(10);
  expect(engine.state.elements[0].inventory.isZero()).toBe(true);
  expect(engine.state.coins.gt(0)).toBe(true);
  expect(engine.state.discoveryWait).toBe(30);
  const resumed = new Engine(deserialize(serialize(engine.state)));
  expect(resumed.state.sampleContract).toEqual(engine.state.sampleContract);
  resumed.step(20, false);
  expect(resumed.state.sampleContract).toEqual(engine.state.sampleContract);
  resumed.step(24);
  expect(resumed.state.sampleContract).toMatchObject({ supply: 1, scan: 1 });
  expect(resumed.state.elements[8].discovered).toBe(false);
  const before = resumed.state.data;
  expect(resumed.revealSampleContract(9)).toBe(true);
  expect(resumed.state.data.minus(before).toNumber()).toBe(420);
  const restored = new Engine(deserialize(serialize(resumed.state)));
  expect(restored.revealSampleContract(9)).toBe(false);
  expect(restored.startSampleContract('hydrogen', 1)).toBe(false);
  restored.step(7);
  expect(restored.state.elements[8].discovered).toBe(true);
});

it('pauses supply with the assigned instrument and releases the assignment when cancelled', () => {
  const engine = atOxygen();
  engine.startSampleContract('hydrogen', 1);
  engine.toggleReactor(1);
  engine.step(20);
  expect(engine.state.sampleContract).toMatchObject({ supply: 0 });
  expect(engine.cancelSampleContract()).toBe(true);
  engine.toggleReactor(1);
  engine.step(100, false);
  expect(engine.state.elements[0].inventory.gt(0)).toBe(true);
  expect(engine.startSampleContract('hydrogen', 1)).toBe(true);
  engine.step(50);
  const before = engine.state.coins;
  expect(engine.revealSampleContract(7)).toBe(true);
  expect(engine.state.coins.minus(before).toNumber()).toBe(1800);
});
