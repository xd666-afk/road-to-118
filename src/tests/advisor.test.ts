import { describe, expect, it } from 'vitest';
import { applyAdvice, openingStep, recommend } from '../game/advisor';
import { createState, Engine } from '../game/engine';
import { D } from '../game/numbers';
import { deserialize, serialize } from '../game/save';
import { CALCIUM_ELEMENT, PLAYABLE_ELEMENTS, XENON_ELEMENT, archiveUnits } from '../game/config';

function advanced() {
  const e = new Engine(createState(123));
  e.state.elements.forEach((x, i) => { x.discovered = i < 20; });
  e.state.reactors.forEach((r, i) => { if (i < 5) { r.built = true; r.target = 2; } });
  e.state.modules.feed = e.state.modules.reaction = e.state.modules.allocation = true;
  return e;
}
function archive(e: Engine, z: number, units = 100) {
  const row = e.state.elements[z - 1]; row.inventory = D(units); row.totalProduced = row.totalProduced.plus(units); e.deposit(z, true);
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
    expect(e.state.reactors.every(r => r.active === r.built)).toBe(true);
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
  it('directs discovered calcium into production, then preserves the 20th milestone without ending the version', () => {
    const e = advanced(); const ca = e.state.elements[CALCIUM_ELEMENT - 1]; ca.deposited = 88; ca.inventory = D(0);
    expect(recommend(e.state).action).toBe('produce');
    applyAdvice(e, recommend(e.state));
    expect(e.state.reactors[4].target).toBe(CALCIUM_ELEMENT);
    expect(e.state.reactors[4].exploring).toBe(false);
    expect(recommend(e.state).enabled).toBe(false);
    ca.inventory = D(20);
    expect(recommend(e.state).action).toBe('calibrate');
    applyAdvice(e, recommend(e.state));
    expect(ca.archived).toBe(false); expect(ca.deposited).toBe(100); expect(ca.inventory.eq(8)).toBe(true);
    expect(e.state.stats.calciumCompletedAt).toBeNull();
    ca.inventory = D(50);
    expect(e.deposit(CALCIUM_ELEMENT)).toBe(50);
    expect(ca.archived).toBe(true);
    expect(e.state.stats.calciumCompletedAt).not.toBeNull();
    expect(e.state.stats.xeCompletedAt).toBeNull(); expect(e.state.stats.completedAt).toBeNull();
  });
  it('produces Ne on the highest suitable built reactor, then archives and explores again', () => {
    const e = advanced(); const ne = e.state.elements[9];
    e.state.elements[19].discovered = false;
    archive(e, 18);
    Object.assign(e.state.reactors[4].upgrades, { capacity: 1, yield: 2 });
    ne.archived = false; ne.deposited = 88; ne.inventory = D(0);
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
    expect(recommend(e.state)).toMatchObject({ id: 'observe-20', action: 'explore', target: 20 });
    applyAdvice(e, recommend(e.state));
    expect(e.state.reactors[4]).toMatchObject({ target: 20, exploring: true, active: true });
  });
  it('rejects an obsolete Ne command and deposits only the remaining units', () => {
    const e = advanced(); const ne = e.state.elements[9];
    e.state.elements[19].discovered = false;
    ne.archived = false; ne.deposited = 95; ne.inventory = D(0);
    const stale = recommend(e.state);
    expect(stale.action).toBe('produce');
    ne.inventory = D(10);
    applyAdvice(e, stale);
    expect(ne.archived).toBe(false);
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
    e.state.elements[9].archived = false; ca.deposited = 88; ca.inventory = D(0);
    expect(recommend(e.state)).toMatchObject({ id: 'calcium', action: 'produce', reactor: 5, target: 20 });
  });
  it('after Ca opens VI, after Kr opens VII, and at Xe recommends the real archive sweep', () => {
    const e = advanced(); archive(e, CALCIUM_ELEMENT);
    const ca = e.state.elements[CALCIUM_ELEMENT - 1]; ca.inventory = D(0);
    e.state.coins = D('1e30'); e.state.data = D('1e30');
    expect(recommend(e.state)).toMatchObject({ id: 'build-6', action: 'build', reactor: 6 });
    applyAdvice(e, recommend(e.state));
    expect(e.state.reactors[5].built).toBe(true);
    expect(recommend(e.state)).toMatchObject({ action: 'upgrade', upgrade: 'capacity', reactor: 6 });
    for (let i = 0; i < 4; i++) applyAdvice(e, recommend(e.state));
    expect(recommend(e.state)).toMatchObject({ action: 'explore', target: 21, reactor: 6 });
    for (let z = 21; z <= 36; z++) e.state.elements[z - 1].discovered = true;
    expect(recommend(e.state)).toMatchObject({ id: 'build-7', action: 'build', reactor: 7 });
    applyAdvice(e, recommend(e.state));
    expect(e.state.reactors[6].built).toBe(true);
    for (let z = 37; z <= XENON_ELEMENT; z++) e.state.elements[z - 1].discovered = true;
    const xe = e.state.elements[XENON_ELEMENT - 1]; xe.archived = false;
    xe.deposited = archiveUnits(XENON_ELEMENT) - 1; xe.inventory = D(1); xe.totalProduced = D(archiveUnits(XENON_ELEMENT));
    expect(recommend(e.state)).toMatchObject({ id: 'xenon', action: 'deposit', target: XENON_ELEMENT });
    applyAdvice(e, recommend(e.state));
    expect(xe.archived).toBe(true); expect(e.state.stats.xeCompletedAt).not.toBeNull();
    expect(recommend(e.state)).toMatchObject({ id: 'archive-sweep', action: 'archive' });
    applyAdvice(e, recommend(e.state));
    expect(e.state.automation.mode).toBe('archive');
  });
  it('recommends a payable upgrade when it brings VI construction forward', () => {
    const e = advanced(); archive(e, CALCIUM_ELEMENT);
    e.state.coins = D(1_000_000_000);
    e.state.data = D(3_000_000);
    const advice = recommend(e.state);
    expect(advice).toMatchObject({ action: 'upgrade', enabled: true });
    const row = e.state.reactors[advice.reactor! - 1];
    const key = advice.upgrade!;
    const before = row.upgrades[key];
    applyAdvice(e, advice);
    expect(row.upgrades[key]).toBe(before + 1);
    expect(e.state.coins.lt(1_000_000_000)).toBe(true);
    expect(e.state.reactors[5].built).toBe(false);
  });
  it('directs the completed H–Xe collection to the accelerator', () => {
    const e = advanced();
    e.state.reactors.forEach(reactor => { reactor.built = true; });
    e.state.elements.slice(0, 54).forEach(row => { row.discovered = true; row.deposited = 100; row.archived = true; row.inventory = D(0); });
    e.state.stats.xeCompletedAt = 1; e.state.stats.completedAt = 2;
    const advice = recommend(e.state);
    expect(advice.action).toBe('accelerator');
    expect(advice.label).toBe('继续建造加速环');
    expect(PLAYABLE_ELEMENTS).toBe(56);
    e.state.accelerator = { built: 4, commissioned: true };
    expect(recommend(e.state).label).toBe('前往大厅研究铯');
    Object.assign(e.state.elements[54], { discovered: true, archived: true, deposited: 100 });
    expect(recommend(e.state).label).toBe('前往大厅研究钡');
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
