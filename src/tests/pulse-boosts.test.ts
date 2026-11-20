import { expect, it, vi } from 'vitest';
import { createFirstRun, createState, Engine } from '../game/engine';
import { PULSE_BOOST_MS, PULSE_DROP_MS } from '../game/pulseBoosts';
import { deserialize, serialize } from '../game/save';

it('applies inspiration only to manual clicks for precisely one minute, including after reload', () => {
  const now = 100_000;
  const state = createFirstRun(19, now);
  delete state.firstRun;
  state.reactors[0].active = true;
  state.elements[1].discovered = true;
  const e = new Engine(state);
  expect(e.showPracticeDrop(now)).toBe(true);
  expect(e.collectPulseDrop(e.pulseDrop!.id, now + PULSE_DROP_MS)).toBe(false);
  expect(e.showPracticeDrop(now + PULSE_DROP_MS)).toBe(true);
  const picked = now + PULSE_DROP_MS + 200;
  const id = e.pulseDrop!.id;
  expect(e.collectPulseDrop(id, picked)).toBe(true);
  expect(e.collectPulseDrop(id, picked)).toBe(false);
  expect(e.activePulseBoost(picked)?.kind).toBe('inspiration');

  const revived = new Engine(deserialize(serialize(state, picked + 1000)));
  const baseline = new Engine(deserialize(serialize(state, picked + 1000)));
  delete baseline.state.pulseBoost;
  revived.step(10, false);
  baseline.step(10, false);
  expect(revived.state.coins.eq(baseline.state.coins)).toBe(true);
  const normal = baseline.manualPulse(1, picked + 1000)!;
  const boosted = revived.manualPulse(1, picked + 1000)!;
  expect(boosted.energy.eq(normal.energy.mul(2))).toBe(true);
  expect(boosted.data.eq(normal.data.mul(2))).toBe(true);
  expect(revived.state.stats.milestones.boostedPulse).toBeDefined();
  expect(revived.manualPulse(1, picked + PULSE_BOOST_MS)!.energy.eq(normal.energy)).toBe(true);
});

it.each([
  [.05, 'inspiration', 2, 2],
  [.5, 'energy', 3, 1],
  [.95, 'data', 1, 3],
] as const)('schedules a distinct random effect without consuming discovery RNG (%s)', (fraction, kind, energy, data) => {
  const e = new Engine(createState(87));
  const rng = e.state.rng;
  const random = vi.spyOn(Math, 'random').mockReturnValue(fraction);
  try {
    e.updatePulseDrop(0, false);
    e.updatePulseDrop(1, true);
    e.updatePulseDrop(44_999, true);
    expect(e.pulseDrop).toBeUndefined();
    e.updatePulseDrop(91_000, true);
    expect(e.pulseDrop?.kind).toBe(kind);
    expect(e.collectPulseDrop(e.pulseDrop!.id, 91_000)).toBe(true);
    const pulse = e.manualPulse(1, 91_000)!;
    expect(pulse.energy.eq(2 * energy)).toBe(true);
    expect(pulse.data.eq(2 * data)).toBe(true);
    e.updatePulseDrop(92_000, true);
    expect(e.pulseDrop).toBeUndefined();
    expect(e.state.rng).toBe(rng);
  } finally { random.mockRestore(); }
});
