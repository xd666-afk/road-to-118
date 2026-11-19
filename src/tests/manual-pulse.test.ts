import { describe, expect, it } from 'vitest';
import { Engine, createFirstRun, createState } from '../game/engine';
import { Big, D } from '../game/numbers';
import { coinPerEvent, eventRate } from '../game/economy';
import { deserialize, serialize } from '../game/save';

const pulseEvents = (e: Engine, id: number) =>
  Big.max(D(2), eventRate(e.state.reactors[id - 1]).mul(D('0.055')).floor());

describe('manual pulse settlement', () => {
  it('settles the exact experiment count, collision energy, data and statistics', () => {
    const e = new Engine(createState(41, 5000));
    e.state.coins = D('1e9');
    e.state.data = D('1e9');
    for (let z = 1; z <= 4; z++) e.state.elements[z - 1].discovered = true;
    expect(e.build(2)).toBe(true);

    const r = e.state.reactors[1];
    r.upgrades = { atoms: 500, speed: 10, yield: 2, capacity: 6 };
    const events = pulseEvents(e, 2);
    expect(events.gt(2)).toBe(true);
    const expectedEnergy = events.mul(coinPerEvent(r));
    const before = {
      coins: e.state.coins, data: e.state.data, earned: e.state.stats.earned, events: e.state.stats.events,
      reactorEvents: r.events, elapsed: e.state.elapsed, rng: e.state.rng, inventory: e.state.elements[0].inventory,
    };

    const result = e.manualPulse(2);

    expect(result).not.toBeNull();
    expect(result!.energy.eq(expectedEnergy)).toBe(true);
    expect(result!.data.eq(events)).toBe(true);
    expect(e.state.coins.minus(before.coins).eq(expectedEnergy)).toBe(true);
    expect(e.state.data.minus(before.data).eq(events)).toBe(true);
    expect(e.state.stats.earned.minus(before.earned).eq(expectedEnergy)).toBe(true);
    expect(e.state.stats.events.minus(before.events).eq(events)).toBe(true);
    expect(r.events.minus(before.reactorEvents).eq(events)).toBe(true);
    expect(e.state.stats.peak.eq(e.state.coins)).toBe(true);
    expect(e.state.achievements).toContain('collision');
    expect(e.state.elapsed).toBe(before.elapsed);
    expect(e.state.rng).toBe(before.rng);
    expect(e.state.elements[0].inventory.eq(before.inventory)).toBe(true);
    expect(e.state.elements[4].discovered).toBe(false);
    expect(e.state.elements[4].inventory.eq(0)).toBe(true);
  });

  it('always credits at least two experiments per pulse', () => {
    const e = new Engine(createState(42));
    const r = e.state.reactors[0];
    expect(eventRate(r).mul(D('0.055')).floor().lt(2)).toBe(true);

    const result = e.manualPulse(1);

    expect(result).not.toBeNull();
    expect(result!.data.eq(2)).toBe(true);
    expect(result!.energy.eq(D(2).mul(coinPerEvent(r)))).toBe(true);
    expect(r.events.eq(2)).toBe(true);
    expect(e.state.stats.events.eq(2)).toBe(true);
  });

  it('applies active energy and data abilities but not production abilities', () => {
    const e = new Engine(createState(43));
    for (const z of [1, 2, 4, 5, 7, 8]) {
      const row = e.state.elements[z - 1];
      row.discovered = true;
      row.inventory = D(100);
      row.totalProduced = D(100);
      e.deposit(z);
    }
    const r = e.state.reactors[0];
    const events = pulseEvents(e, 1);

    const result = e.manualPulse(1);

    expect(result).not.toBeNull();
    // H + He + O = +10% energy; Be + N = +5% data; B's production bonus is irrelevant here.
    expect(result!.energy.eq(events.mul(coinPerEvent(r)).mul(D('1.10')))).toBe(true);
    expect(result!.data.eq(events.mul(D('1.05')))).toBe(true);
  });

  it('accepts rapid consecutive pulses without a cap, delay, randomness or side production', () => {
    const e = new Engine(createState(44, 9000));
    const r = e.state.reactors[0];
    const events = pulseEvents(e, 1);
    const energy = events.mul(coinPerEvent(r));
    const before = {
      coins: e.state.coins, data: e.state.data, events: e.state.stats.events,
      elapsed: e.state.elapsed, rng: e.state.rng, inventory: e.state.elements[0].inventory,
    };

    for (let i = 0; i < 300; i++) {
      const result = e.manualPulse(1);
      expect(result).not.toBeNull();
      expect(result!.energy.eq(energy)).toBe(true);
      expect(result!.data.eq(events)).toBe(true);
    }

    expect(e.state.coins.eq(before.coins.plus(energy.mul(300)))).toBe(true);
    expect(e.state.data.eq(before.data.plus(events.mul(300)))).toBe(true);
    expect(e.state.stats.events.eq(before.events.plus(events.mul(300)))).toBe(true);
    expect(e.state.stats.earned.eq(energy.mul(300))).toBe(true);
    expect(e.state.stats.peak.eq(e.state.coins)).toBe(true);
    expect(r.events.eq(events.mul(300))).toBe(true);
    expect(e.state.elapsed).toBe(before.elapsed);
    expect(e.state.rng).toBe(before.rng);
    expect(e.state.elements[0].inventory.eq(before.inventory)).toBe(true);
    expect(e.state.stats.produced.eq(0)).toBe(true);
  });

  it('rejects invalid, paused and unbuilt reactors plus non-playable opening steps without settling', () => {
    const e = new Engine(createState(45, 1000));
    const before = {
      coins: e.state.coins, data: e.state.data, earned: e.state.stats.earned, events: e.state.stats.events,
      peak: e.state.stats.peak, elapsed: e.state.elapsed, rng: e.state.rng, reactorEvents: e.state.reactors[0].events,
    };

    for (const id of [0, -1, 1.5, 2, 99, Number.NaN]) expect(e.manualPulse(id)).toBeNull();

    e.toggleReactor(1);
    expect(e.state.reactors[0].active).toBe(false);
    expect(e.manualPulse(1)).toBeNull();
    e.toggleReactor(1);

    for (const step of ['welcome', 'start', 'sample', 'explore'] as const) {
      e.state.firstRun = { step };
      expect(e.manualPulse(1)).toBeNull();
    }
    e.state.firstRun = { step: 'helium', remaining: 4 };
    expect(e.manualPulse(1)).toBeNull();

    expect(e.state.coins.eq(before.coins)).toBe(true);
    expect(e.state.data.eq(before.data)).toBe(true);
    expect(e.state.stats.earned.eq(before.earned)).toBe(true);
    expect(e.state.stats.events.eq(before.events)).toBe(true);
    expect(e.state.stats.peak.eq(before.peak)).toBe(true);
    expect(e.state.elapsed).toBe(before.elapsed);
    expect(e.state.rng).toBe(before.rng);
    expect(e.state.reactors[0].events.eq(before.reactorEvents)).toBe(true);
    expect(e.state.achievements).not.toContain('collision');

    for (const step of ['free', 'charge'] as const) {
      e.state.firstRun = { step };
      expect(e.manualPulse(1)).not.toBeNull();
    }
    expect(e.state.achievements).toContain('collision');
  });

  it('keeps pulsed totals and the charging tutorial step across save/load refresh', () => {
    const e = new Engine(createFirstRun(77, 1000));
    e.beginOpening();
    e.toggleReactor(1);
    expect(e.state.firstRun?.step).toBe('charge');
    const events = pulseEvents(e, 1);

    const first = e.manualPulse(1);
    expect(first).not.toBeNull();
    expect(first!.data.eq(events)).toBe(true);
    const saved = {
      coins: e.state.coins, data: e.state.data, earned: e.state.stats.earned,
      events: e.state.stats.events, peak: e.state.stats.peak,
    };

    const loaded = new Engine(deserialize(serialize(e.state, 5000)));
    expect(loaded.state.firstRun?.step).toBe('charge');
    expect(loaded.state.coins.eq(saved.coins)).toBe(true);
    expect(loaded.state.data.eq(saved.data)).toBe(true);
    expect(loaded.state.stats.earned.eq(saved.earned)).toBe(true);
    expect(loaded.state.stats.events.eq(saved.events)).toBe(true);
    expect(loaded.state.stats.peak.eq(saved.peak)).toBe(true);
    expect(loaded.state.achievements).toContain('collision');

    const again = loaded.manualPulse(1);
    expect(again).not.toBeNull();
    expect(again!.data.eq(events)).toBe(true);
    expect(loaded.state.stats.events.eq(saved.events.plus(events))).toBe(true);
    expect(loaded.state.coins.eq(saved.coins.plus(again!.energy))).toBe(true);
    expect(loaded.state.data.eq(saved.data.plus(events))).toBe(true);
    expect(loaded.state.stats.peak.eq(loaded.state.coins)).toBe(true);
    expect(loaded.state.firstRun?.step).toBe('charge');
    expect(loaded.buy(1, 'atoms', 1)).toBe(0);
    expect(loaded.manualPulse(1)).not.toBeNull();
    expect(loaded.state.firstRun?.step).toBe('sample');
    expect(loaded.manualPulse(1)).toBeNull();
  });
});
