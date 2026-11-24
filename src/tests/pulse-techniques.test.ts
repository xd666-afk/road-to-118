import { describe, expect, it } from 'vitest';
import { Engine, createState } from '../game/engine';
import { D } from '../game/numbers';
import { deserialize, serialize } from '../game/save';
import { ECHO_HITS, LITHIUM_CHARGE, LITHIUM_SAMPLES, TRIAL_ECHO_DATA, TRIAL_LITHIUM_SAMPLES } from '../game/pulseTechniques';

function discoveredLab() {
  const engine = new Engine(createState(212, 1000));
  for (const sample of engine.state.elements.slice(0, 3)) sample.discovered = true;
  return engine;
}

function archive(engine: Engine, z: number) {
  const sample = engine.state.elements[z - 1];
  sample.inventory = D(100);
  sample.totalProduced = D(100);
  engine.deposit(z);
}

describe('element collision techniques', () => {
  it('gives an echo every third settled pulse only after archiving He', () => {
    const e = discoveredLab();
    for (let i = 0; i < ECHO_HITS; i++) expect(e.manualPulse(1)?.echo).toBe(false);
    archive(e, 2);
    for (let i = 1; i < ECHO_HITS; i++) expect(e.manualPulse(1)?.data.toNumber()).toBe(2);
    const restored = new Engine(deserialize(serialize(e.state, 1000)));
    const pulse = restored.manualPulse(1);
    expect(pulse?.echo).toBe(true);
    expect(pulse?.data.toNumber()).toBe(4);
    expect(restored.state.pulseTech.echoHits).toBe(0);
  });

  it('banks lithium charge through reload and spends it once on a known target', () => {
    const e = discoveredLab();
    expect(e.releaseLithium(1)).toBeUndefined();
    archive(e, 3);
    for (let i = 1; i < LITHIUM_CHARGE; i++) expect(e.manualPulse(1)?.charged).toBe(false);
    expect(e.manualPulse(1)?.charged).toBe(true);
    expect(e.manualPulse(1)?.charged).toBe(false);
    e.target(1, 4, true);
    expect(e.releaseLithium(1)).toBeUndefined();
    expect(e.state.elements[3].discovered).toBe(false);
    expect(e.state.pulseTech.lithium).toBe(LITHIUM_CHARGE);

    const restored = new Engine(deserialize(serialize(e.state, 1000)));
    restored.target(1, 2);
    const prior = restored.state.stats.produced;
    expect(restored.releaseLithium(1)).toEqual({ target: 2, count: LITHIUM_SAMPLES });
    expect(restored.state.elements[1].inventory.toNumber()).toBe(LITHIUM_SAMPLES);
    expect(restored.state.elements[1].totalProduced.toNumber()).toBe(LITHIUM_SAMPLES);
    expect(restored.state.stats.produced.minus(prior).toNumber()).toBe(LITHIUM_SAMPLES);
    expect(restored.releaseLithium(1)).toBeUndefined();
  });

  it('records the real practice rewards once and defaults cleanly for older saves', () => {
    const e = discoveredLab();
    expect(e.completeTechniqueTrial(2, 2)).toBe(false);
    expect(e.completeTechniqueTrial(2, 1)).toBe(true);
    expect(e.state.data.toNumber()).toBe(TRIAL_ECHO_DATA);
    expect(e.completeTechniqueTrial(3, 1)).toBe(true);
    expect(e.state.elements[2].inventory.toNumber()).toBe(TRIAL_LITHIUM_SAMPLES);
    const restored = new Engine(deserialize(serialize(e.state, 1000)));
    expect(restored.completeTechniqueTrial(2, 1)).toBe(false);
    expect(restored.completeTechniqueTrial(3, 1)).toBe(false);
    const legacy = JSON.parse(serialize(e.state, 1000));
    delete legacy.pulseTech;
    delete legacy.settings.collisionSound;
    expect(deserialize(JSON.stringify(legacy)).pulseTech).toEqual({ echoHits: 0, lithium: 0, tried: [] });
    expect(deserialize(JSON.stringify(legacy)).settings.collisionSound).toBe(false);
  });
});
