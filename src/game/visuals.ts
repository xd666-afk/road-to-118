import { REACTORS } from './config';
import type { GameState, ReactorState } from './types';

/** Representative display only: never consumes inventory or affects the economy. */
export function reactorDisplayPool(state: GameState, reactor: ReactorState): number[] {
  const known = state.elements.map((e, i) => e.discovered ? i + 1 : 0).filter(Boolean);
  if (reactor.id === 1) {
    const selected = state.settings.mix.filter(z => known.includes(z));
    return selected.length ? selected : [1];
  }
  const config = REACTORS[reactor.id - 1];
  const pool = known.filter(z => z >= config.anchor && z <= config.softMax);
  if (known.includes(reactor.target) && !pool.includes(reactor.target)) pool.push(reactor.target);
  return pool.length ? pool : known.slice(-4);
}

// A modest visual cue for progression, not a model of actual atomic radii.
export const particleScale = (z: number) => .88 + .03 * (Math.max(1, Math.min(10, z)) - 1);
