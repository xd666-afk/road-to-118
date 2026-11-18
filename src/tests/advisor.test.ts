import { describe, expect, it } from 'vitest';
import { applyAdvice, openingStep, recommend } from '../game/advisor';
import { createState, Engine } from '../game/engine';
import { D } from '../game/numbers';
import { deserialize, serialize } from '../game/save';

function advanced() {
  const e = new Engine(createState(123));
  e.state.elements.forEach(x => { x.discovered = true; });
  e.state.reactors.forEach(r => { r.built = true; r.target = 2; });
  e.state.modules.feed = e.state.modules.reaction = true;
  return e;
}

describe('progress recommendations', () => {
  it('never buys without funds and uses real first-purchase cost', () => {
    const e = new Engine(createState(9));
    applyAdvice(e, recommend(e.state));
    expect(e.state.stats.purchases).toBe(0);
    e.state.coins = D(5);
    applyAdvice(e, recommend(e.state));
    expect(e.state.stats.purchases).toBe(1);
    expect(e.state.coins.eq(0)).toBe(true);
    expect(openingStep(e.state)).toBe(1);
  });
  it('restores paused instruments before recommending work', () => {
    const e = advanced(); e.state.reactors.forEach(r => { r.active = false; });
    expect(recommend(e.state).action).toBe('resume');
    applyAdvice(e, recommend(e.state));
    expect(e.state.reactors.every(r => r.active)).toBe(true);
  });
  it('starts and continues genuine exploration after the first purchase', () => {
    const e = new Engine(createState(9)); e.state.coins = D(5);
    applyAdvice(e, recommend(e.state)); applyAdvice(e, recommend(e.state));
    expect(e.state.reactors[0].exploring).toBe(true);
    expect(e.state.reactors[0].target).toBe(2);
    e.state.reactors[0].discoveryHazard = 0; e.step(.25);
    expect(e.state.elements[1].discovered).toBe(true);
    expect(e.state.reactors[0].target).toBe(3);
    expect(recommend(e.state).id).toBe('research-feed');
  });
  it('directs discovered calcium into production, then submits only the remaining units', () => {
    const e = advanced(); const ca = e.state.elements[19]; ca.deposited = 38; ca.inventory = D(0);
    expect(recommend(e.state).action).toBe('produce');
    applyAdvice(e, recommend(e.state));
    expect(e.state.reactors[4].target).toBe(20);
    expect(e.state.reactors[4].exploring).toBe(false);
    expect(recommend(e.state).enabled).toBe(false);
    ca.inventory = D(20);
    applyAdvice(e, recommend(e.state));
    expect(ca.archived).toBe(true); expect(ca.inventory.eq(8)).toBe(true);
    expect(e.state.stats.completedAt).not.toBeNull();
  });
  it('refuses an obsolete command and retains dismissed guide and resources through save/load', () => {
    const e = new Engine(createState(9)); e.state.coins = D(10);
    const old = recommend(e.state); e.state.stats.purchases = 1;
    applyAdvice(e, old); expect(e.state.coins.eq(10)).toBe(true);
    e.state.settings.guideDismissed = true;
    const loaded = deserialize(serialize(e.state));
    expect(loaded.settings.guideDismissed).toBe(true); expect(loaded.coins.eq(10)).toBe(true);
  });
});
