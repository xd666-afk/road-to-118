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
  it('produces Ne on the highest suitable built reactor, then archives and explores again', () => {
    const e = advanced(); const ne = e.state.elements[9];
    e.state.elements[19].discovered = false;
    ne.archived = false; ne.deposited = 38; ne.inventory = D(0);
    const first = recommend(e.state);
    expect(first).toMatchObject({ id: 'neon', action: 'produce', reactor: 5, target: 10 });
    applyAdvice(e, first);
    expect(ne.inventory.eq(0)).toBe(true); // no free resources
    expect(e.state.reactors[4]).toMatchObject({ target: 10, exploring: false, active: true });
    const before = ne.inventory;
    e.advance(5, true);
    expect(ne.inventory.gt(before)).toBe(true); // genuine engine production
    ne.inventory = D(20);
    expect(recommend(e.state)).toMatchObject({ id: 'neon', action: 'deposit', target: 10, enabled: true });
    applyAdvice(e, recommend(e.state));
    expect(ne.archived).toBe(true); expect(ne.inventory.eq(8)).toBe(true);
    expect(e.state.stats.neonCompletedAt).not.toBeNull();
    expect(recommend(e.state)).toMatchObject({ id: 'explore', action: 'explore', target: 20 });
    applyAdvice(e, recommend(e.state));
    expect(e.state.reactors[4]).toMatchObject({ target: 20, exploring: true, active: true });
  });
  it('rejects an obsolete Ne command and deposits only the remaining units', () => {
    const e = advanced(); const ne = e.state.elements[9];
    e.state.elements[19].discovered = false;
    ne.archived = false; ne.deposited = 45; ne.inventory = D(0);
    const stale = recommend(e.state);
    expect(stale.action).toBe('produce');
    ne.inventory = D(10);
    applyAdvice(e, stale);
    expect(ne.archived).toBe(false); // old production label cannot consume a new inventory state
    expect(recommend(e.state).action).toBe('deposit');
    applyAdvice(e, recommend(e.state));
    expect(ne.archived).toBe(true); expect(ne.inventory.eq(5)).toBe(true);
  });
  it('resumes a paused Ne producer instead of deadlocking the stage', () => {
    const e = advanced(); const ne = e.state.elements[9];
    e.state.elements[19].discovered = false;
    ne.archived = false; ne.deposited = 0; ne.inventory = D(0);
    applyAdvice(e, recommend(e.state));
    e.state.reactors[4].active = false;
    const paused = recommend(e.state);
    expect(paused).toMatchObject({ action: 'produce', enabled: true, reactor: 5, target: 10 });
    applyAdvice(e, paused);
    expect(e.state.reactors[4].active).toBe(true);
  });
  it('builds an affordable higher reactor before Ne, while Ne production continues when that build is unaffordable', () => {
    const e = advanced(); const ne = e.state.elements[9];
    e.state.elements[19].discovered = false;
    ne.archived = false; ne.deposited = 0; ne.inventory = D(0);
    e.state.reactors[3].built = e.state.reactors[4].built = false;
    expect(recommend(e.state)).toMatchObject({ id: 'neon', action: 'produce', reactor: 3, target: 10 });
    e.state.coins = D(1e6); e.state.data = D(1e6);
    expect(recommend(e.state)).toMatchObject({ id: 'build-4', action: 'build', reactor: 4 });
  });
  it('keeps Ca first for a legacy all-20 save even when Ne was never archived', () => {
    const e = advanced(); const ca = e.state.elements[19];
    e.state.elements[9].archived = false; ca.deposited = 38; ca.inventory = D(0);
    expect(recommend(e.state)).toMatchObject({ id: 'calcium', action: 'produce', reactor: 5, target: 20 });
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
