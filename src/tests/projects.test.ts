import { expect, test } from 'vitest';
import { laboratoryBonuses } from '../game/abilityProgress';
import { acceleratorSegments } from '../game/accelerator';
import { createState, Engine } from '../game/engine';
import { D } from '../game/numbers';
import { projectBonus, projects, separationBonus } from '../game/projects';
import { deserialize, serialize } from '../game/save';

function discoverThrough(engine: Engine, z: number) {
  engine.state.elements.slice(0, z).forEach(row => { row.discovered = true; });
}

test('accelerator stages require Ne, Ar, Kr and Xe, and each stage saves partial research allocations', () => {
  let engine = new Engine(createState(22));
  engine.state.data = D(2_100_000);
  expect(acceleratorSegments.map(stage => stage.z)).toEqual([10, 18, 36, 54]);
  for (const [index, stage] of acceleratorSegments.entries()) {
    discoverThrough(engine, stage.z - 1);
    expect(engine.fundAcceleratorSegment(index)).toBe(0);
    discoverThrough(engine, stage.z);
    expect(engine.fundAcceleratorSegment(index, 100)).toBe(100);
    engine = new Engine(deserialize(serialize(engine.state)));
    expect(engine.state.accelerator).toEqual({ built: index, commissioned: false, funded: 100 });
    expect(engine.fundAcceleratorSegment(index)).toBe(stage.data - 100);
    expect(engine.fundAcceleratorSegment(index)).toBe(0);
  }
  expect(engine.state.data.toNumber()).toBe(92_500);
  expect(engine.commissionAccelerator()).toBe(true);
});

test('a v7 save retains the north section previously paid for at Ca', () => {
  const engine = new Engine(createState(23));
  discoverThrough(engine, 20);
  const legacy = JSON.parse(serialize(engine.state));
  legacy.saveVersion = 7;
  delete legacy.projects;
  delete legacy.projectOperations;
  legacy.accelerator = { built: 2, commissioned: false };
  const state = deserialize(JSON.stringify(legacy));
  expect(state.accelerator).toEqual({ built: 2, commissioned: false });
  expect(state.projects.spectroscopy).toEqual({ built: 0, funded: 0 });
  expect(state.projectOperations).toEqual({ pulseCharge: 0, pulseHits: 0 });
  expect(state.data.isZero()).toBe(true);
});

test('project stages spend only available research and apply their effects only on completion', () => {
  let engine = new Engine(createState(24));
  engine.state.data = D(50.8);
  expect(engine.fundProject('spectroscopy', 0)).toBe(0);
  discoverThrough(engine, 9);
  expect(engine.fundProject('spectroscopy', 0)).toBe(0);
  discoverThrough(engine, 10);
  expect(engine.fundProject('spectroscopy', 0, -5)).toBe(0);
  expect(engine.fundProject('spectroscopy', 1)).toBe(0);
  expect(engine.fundProject('spectroscopy', 0)).toBe(50);
  expect(engine.state.data.eq('0.8')).toBe(true);
  expect(laboratoryBonuses(engine.state).data).toBe(0);
  engine = new Engine(deserialize(serialize(engine.state)));
  expect(engine.state.projects.spectroscopy).toEqual({ built: 0, funded: 50 });
  engine.state.data = engine.state.data.plus(30);
  expect(engine.fundProject('spectroscopy', 0)).toBe(30);
  expect(laboratoryBonuses(engine.state).data).toBe(5);
  expect(engine.fundProject('spectroscopy', 0)).toBe(0);

  discoverThrough(engine, 18);
  const baseline = new Engine(deserialize(serialize(engine.state)));
  engine.state.data = D(200_000);
  expect(engine.fundProject('separation', 0)).toBe(projects.separation.stages[0].data);
  expect(engine.fundProject('pulse', 0)).toBe(projects.pulse.stages[0].data);
  expect(laboratoryBonuses(engine.state).production).toBe(6);
  expect(projectBonus(engine.state, 'pulse')).toBe(12);
  const boosted = engine.manualPulse(1)!;
  const ordinary = baseline.manualPulse(1)!;
  expect(boosted.energy.eq(ordinary.energy.mul(1.12))).toBe(true);
  engine.state.reactors[0].target = baseline.state.reactors[0].target = 1;
  engine.step(200, false);
  baseline.step(200, false);
  expect(engine.state.elements[0].inventory.gt(baseline.state.elements[0].inventory)).toBe(true);
});

test('a paid spectrum scan resumes after reload and can be claimed once', () => {
  let engine = new Engine(createState(25));
  discoverThrough(engine, 10);
  engine.state.reactors[0].active = false;
  engine.state.data = D(80);
  engine.state.elements[1].inventory = engine.state.elements[1].totalProduced = D(10);
  expect(engine.startSpectrumScan(2)).toBe(false);
  expect(engine.fundProject('spectroscopy', 0)).toBe(80);
  expect(engine.startSpectrumScan(3)).toBe(false);
  expect(engine.startSpectrumScan(2)).toBe(true);
  expect(engine.startSpectrumScan(2)).toBe(false);
  expect(engine.state.elements[1].inventory.toNumber()).toBe(2);
  engine.step(3);
  engine = new Engine(deserialize(serialize(engine.state)));
  expect(engine.state.projectOperations.scan).toMatchObject({ target: 2, remaining: 5 });
  engine.step(60, false);
  expect(engine.claimSpectrumScan()).toBe(false);
  engine.step(5);
  expect(engine.claimSpectrumScan()).toBe(true);
  expect(engine.claimSpectrumScan()).toBe(false);
  expect(engine.state.data.toNumber()).toBe(28);
});

test('pre-Ne saves keep old optical construction and pause project operations until Ne', () => {
  const original = new Engine(createState(28));
  discoverThrough(original, 4);
  original.state.reactors[0].active = false;
  original.state.projects.spectroscopy = { built: 1, funded: 120 };
  original.state.projectOperations.scan = { target: 2, level: 1, remaining: 3 };
  const recovered = new Engine(deserialize(serialize(original.state)));
  expect(recovered.state.projects.spectroscopy).toEqual({ built: 1, funded: 120 });
  expect(projectBonus(recovered.state, 'spectroscopy')).toBe(0);
  recovered.step(20);
  expect(recovered.state.projectOperations.scan?.remaining).toBe(3);
  expect(recovered.claimSpectrumScan()).toBe(false);
  discoverThrough(recovered, 10);
  expect(projectBonus(recovered.state, 'spectroscopy')).toBe(5);
  recovered.step(3);
  expect(recovered.claimSpectrumScan()).toBe(true);
  expect(recovered.fundProject('spectroscopy', 1)).toBe(0);
});

test('an assigned line improves only production of its target and persists the paid selection', () => {
  const engine = new Engine(createState(26));
  discoverThrough(engine, 10);
  engine.state.data = D(5_100);
  expect(engine.setSeparationTarget(2)).toBe(false);
  expect(engine.fundProject('separation', 0)).toBe(5000);
  expect(engine.setSeparationTarget(11)).toBe(false);
  expect(engine.setSeparationTarget(4)).toBe(false);
  const baseline = new Engine(deserialize(serialize(engine.state)));
  expect(engine.setSeparationTarget(2)).toBe(true);
  expect(engine.state.data.isZero()).toBe(true);
  expect(engine.setSeparationTarget(2)).toBe(false);
  const boosted = new Engine(deserialize(serialize(engine.state)));
  expect(separationBonus(boosted.state, 1)).toBe(0);
  expect(separationBonus(boosted.state, 2)).toBe(15);
  boosted.step(600, false);
  baseline.step(600, false);
  expect(boosted.state.elements[1].inventory.gt(baseline.state.elements[1].inventory)).toBe(true);
  boosted.target(1, 1);
  baseline.target(1, 1);
  boosted.step(600, false);
  baseline.step(600, false);
  expect(boosted.state.elements[0].inventory.eq(baseline.state.elements[0].inventory)).toBe(true);
});

test('supply station charges only on accepted clicks and saves unused boosts', () => {
  let engine = new Engine(createState(27));
  discoverThrough(engine, 18);
  engine.state.data = D(110_000);
  expect(engine.fundProject('pulse', 0)).toBe(110_000);
  expect(engine.releaseStationPulse()).toBe(false);
  engine.step(60, false);
  expect(engine.state.projectOperations.pulseCharge).toBe(0);
  const normal = engine.manualPulse(1)!.energy;
  expect(engine.manualPulse(2)).toBeNull();
  for (let hit = 1; hit < 15; hit++) engine.manualPulse(1);
  expect(engine.state.projectOperations.pulseCharge).toBe(15);
  expect(engine.manualPulse(1)?.stationCharged).toBe(true);
  expect(engine.releaseStationPulse()).toBe(true);
  expect(engine.releaseStationPulse()).toBe(false);
  expect(engine.manualPulse(1)?.energy.minus(normal).toNumber()).toBe(1);
  engine = new Engine(deserialize(serialize(engine.state)));
  expect(engine.state.projectOperations).toMatchObject({ pulseCharge: 0, pulseHits: 7 });
  for (let hit = 0; hit < 7; hit++) expect(engine.manualPulse(1)?.stationBoosted).toBe(true);
  expect(engine.manualPulse(1)?.stationBoosted).toBe(false);
  expect(engine.state.projectOperations).toMatchObject({ pulseCharge: 1, pulseHits: 0 });
});
