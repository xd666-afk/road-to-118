import { ARCHIVE_UNITS, REACTORS } from './config';
import { eventRate } from './economy';
import type { GameState, ReactorState } from './types';

export const DISCOVERY_STAGES = [
  { from: 11, to: 14, reactor: 4, specimen: 10, capacity: 1, tuning: 3 },
  { from: 15, to: 18, reactor: 4, specimen: 14, capacity: 2, tuning: 6 },
  { from: 19, to: 20, reactor: 5, specimen: 18, capacity: 1, tuning: 3 },
  { from: 21, to: 25, reactor: 6, specimen: 20, capacity: 1, tuning: 4 },
  { from: 26, to: 30, reactor: 6, specimen: 25, capacity: 2, tuning: 7 },
  { from: 31, to: 36, reactor: 6, specimen: 30, capacity: 3, tuning: 10 },
  { from: 37, to: 42, reactor: 7, specimen: 36, capacity: 1, tuning: 4 },
  { from: 43, to: 48, reactor: 7, specimen: 42, capacity: 2, tuning: 7 },
  { from: 49, to: 54, reactor: 7, specimen: 48, capacity: 3, tuning: 10 },
] as const;

export type DiscoveryStage = (typeof DISCOVERY_STAGES)[number];

const EARLY_PREPARATION: Readonly<Record<number, number>> = {
  3: 8, 4: 12, 5: 16, 6: 21, 7: 24, 8: 30, 9: 40, 10: 48,
};

export function discoveryPreparation(z: number) {
  return EARLY_PREPARATION[z] ?? 0;
}

export function discoveryStage(z: number) {
  return DISCOVERY_STAGES.find(stage => stage.from <= z && z <= stage.to);
}

export const isCalibrationSpecimen = (z: number) => DISCOVERY_STAGES.some(stage => stage.specimen === z);

export function hasCalibration(state: GameState, z: number) {
  const sample = state.elements[z - 1];
  return !!sample?.discovered && (sample.archived || sample.deposited >= ARCHIVE_UNITS);
}

export function stageReadiness(state: GameState, stage: DiscoveryStage) {
  const reactor = state.reactors[stage.reactor - 1];
  const capacity = reactor.upgrades.capacity;
  const tuning = capacity + reactor.upgrades.yield;
  const calibrated = hasCalibration(state, stage.specimen);
  const tuned = capacity >= stage.capacity && tuning >= stage.tuning;
  return { reactor, capacity, tuning, calibrated, tuned, ready: reactor.built && calibrated && tuned };
}

export function observationProgress(state: GameState, z: number) {
  return state.observation?.z === z ? state.observation.progress : 0;
}

export function observationRate(reactor: ReactorState, stage: DiscoveryStage, z: number, rate = eventRate(reactor)) {
  // Greater throughput helps, with a diminishing return even on old maxed-out devices.
  const speed = rate.div(rate.plus(REACTORS[stage.reactor - 1].cap)).toNumber();
  const workSeconds = (stage.reactor === 4 ? 27 : 20) * (z === stage.to ? 1.2 : 1);
  return speed / workSeconds;
}
