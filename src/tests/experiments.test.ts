import { expect, it } from 'vitest';
import { createState, Engine } from '../game/engine';
import { EXPERIMENT_SECONDS, industryUpgradePrice, NEXT_EXPERIMENT_SECONDS } from '../game/experiments';
import { D } from '../game/numbers';
import { deserialize, serialize } from '../game/save';

function withBoard() {
  const s = createState(233);
  for (const row of s.elements.slice(0, 7)) row.discovered = true;
  s.reactors[0].target = 1;
  s.reactors[0].upgrades.atoms = 20;
  s.reactors[1].built = true;
  s.reactors[1].target = 2;
  s.coins = D(10_000);
  s.data = D(10_000);
  const e = new Engine(s);
  e.research('feed');
  e.state.automation.feed = false;
  e.step(.25);
  return e;
}

it('counts only accepted objectives, preserves progress, and rotates after one claim', () => {
  const e = withBoard(), s = e.state, board = s.experimentBoard!;
  const goal = board.offers[0].goal;
  e.manualPulse(1);
  expect(e.startExperiment(0)).toBe(true);
  expect(e.startExperiment(1)).toBe(false);
  e.manualPulse(1);
  e.step(10, false);
  expect(s.experimentBoard?.active).toMatchObject({ progress: 1, remaining: EXPERIMENT_SECONDS });
  const resumed = new Engine(deserialize(serialize(s)));
  for (let n = 1; n < goal; n++) resumed.manualPulse(1);
  resumed.step(EXPERIMENT_SECONDS + 1);
  const before = resumed.state.coins;
  expect(resumed.claimExperiment()).toBe(true);
  expect(resumed.state.coins.minus(before).eq(board.offers[0].reward.amount)).toBe(true);
  expect(resumed.claimExperiment()).toBe(false);
  expect(resumed.startExperiment(1)).toBe(false);
  resumed.step(NEXT_EXPERIMENT_SECONDS);
  expect(resumed.state.experimentBoard?.round).toBe(2);
});

it('tracks production on the specified instrument and lets an incomplete assignment expire', () => {
  const e = withBoard();
  expect(e.startExperiment(1)).toBe(true);
  expect(e.prepareExperimentProduction()).toBe(true);
  const offer = e.state.experimentBoard!.offers[1];
  if (offer.kind !== 'production') throw new Error('Missing production offer');
  expect(e.state.reactors[offer.reactor - 1].target).toBe(offer.z);
  e.step(30, false);
  expect(e.state.experimentBoard?.active?.progress).toBeGreaterThan(0);
  expect(e.state.experimentBoard?.active?.remaining).toBe(EXPERIMENT_SECONDS);
  e.step(90);
  expect(e.state.experimentBoard?.active?.progress).toBe(offer.goal);
  expect(e.claimExperiment()).toBe(true);
  e.step(NEXT_EXPERIMENT_SECONDS);
  expect(e.startExperiment(0)).toBe(true);
  e.step(EXPERIMENT_SECONDS);
  expect(e.state.experimentBoard?.result).toBe('expired');
  expect(e.claimExperiment()).toBe(false);
});

it('uses a claimed archive coupon for exactly one affordable industry upgrade', () => {
  const e = withBoard(), s = e.state, offer = s.experimentBoard!.offers[2];
  if (offer.kind !== 'archive') throw new Error('Missing archive offer');
  const row = s.elements[offer.z - 1];
  expect(e.startExperiment(2)).toBe(true);
  row.inventory = row.inventory.plus(offer.goal);
  row.totalProduced = row.totalProduced.plus(offer.goal);
  e.deposit(offer.z);
  expect(e.claimExperiment()).toBe(true);
  expect(s.experimentBoard?.coupon).toBe(true);
  const resumed = new Engine(deserialize(serialize(s)));
  const price = industryUpgradePrice(resumed.state, 'feed')!;
  const coins = resumed.state.coins;
  expect(resumed.upgradeModule('feed')).toBe(true);
  expect(coins.minus(resumed.state.coins).eq(price.coins)).toBe(true);
  expect(resumed.state.experimentBoard?.coupon).toBe(false);
});
