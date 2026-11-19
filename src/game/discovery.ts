import { REACTORS } from './config';
import { eventRate } from './economy';
import type { GameState, ReactorState } from './types';

const STAGES = [
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

export type DiscoveryStage = (typeof STAGES)[number];

export function discoveryStage(z: number) {
  return STAGES.find(stage => stage.from <= z && z <= stage.to);
}

export function stageReadiness(state: GameState, stage: DiscoveryStage) {
  const reactor = state.reactors[stage.reactor - 1];
  const capacity = reactor.upgrades.capacity;
  const tuning = capacity + reactor.upgrades.yield;
  const archived = state.elements[stage.specimen - 1].archived;
  const tuned = capacity >= stage.capacity && tuning >= stage.tuning;
  return { reactor, capacity, tuning, archived, tuned, ready: reactor.built && archived && tuned };
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
