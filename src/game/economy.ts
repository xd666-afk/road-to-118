import { D, Big } from './numbers';
import type { Amount } from './numbers';
import { REACTORS, UPGRADES } from './config';
import type { ReactorState, Upgrade } from './types';
export function activeAtoms(r: ReactorState): Amount { return D(REACTORS[r.id - 1].samples).plus(r.upgrades.atoms); }
export function capacity(r: ReactorState): Amount { return D(REACTORS[r.id - 1].cap).mul(r.id === 1 ? 1 : D(1.18).pow(r.upgrades.capacity)); }
export function eventRate(r: ReactorState): Amount {
  if (!r.built || !r.active) return D(0);
  const n = activeAtoms(r), ns = D(28).mul(D(1.08).pow(r.upgrades.capacity));
  const raw = n.mul(n.minus(1)).div(D(1).plus(n.div(ns))).mul(REACTORS[r.id - 1].k).mul(D(1).plus(D(r.upgrades.speed).mul(.22)));
  return Big.min(raw, capacity(r));
}
export function coinPerEvent(r: ReactorState): Amount { return D(REACTORS[r.id - 1].gain).mul(D(1.35).pow(r.upgrades.yield)); }
export function income(r: ReactorState): Amount { return eventRate(r).mul(coinPerEvent(r)); }
export function price(r: ReactorState, key: Upgrade, count = 1): Amount {
  if (count <= 0) return D(0);
  const u = UPGRADES[key], factor = key === 'atoms' ? r.id : r.id * r.id;
  return D(u.base * factor).mul(D(u.ratio).pow(r.upgrades[key])).mul(D(u.ratio).pow(count).minus(1)).div(D(u.ratio).minus(1));
}
export function maxAffordable(r: ReactorState, key: Upgrade, coins: Amount): number {
  if (coins.lt(price(r, key))) return 0;
  const ratio = D(UPGRADES[key].ratio), first = price(r, key);
  const scaled = coins.mul(ratio.minus(1)).div(first).plus(1);
  const mantissa = scaled.div(D(10).pow(scaled.e)).toNumber();
  const logarithm = (scaled.e * Math.LN10 + Math.log(mantissa)) / Math.log(UPGRADES[key].ratio);
  let count = Math.min(1e7 - r.upgrades[key], Math.max(0, Math.floor(logarithm)));
  // Correct logarithmic rounding at exact geometric-series boundaries without linear purchasing.
  for (let i = 0; i < 4 && count > 0 && price(r, key, count).gt(coins); i++) count--;
  for (let i = 0; i < 4 && count < 1e7 - r.upgrades[key] && price(r, key, count + 1).lte(coins); i++) count++;
  return count;
}
export function usefulAtomPurchase(r: ReactorState, coins: Amount): number {
  const current = eventRate(r), cap = capacity(r);
  if (current.lte(0) || current.gte(cap)) return 0;
  const affordable = maxAffordable(r, 'atoms', coins);
  if (!affordable) return 0;
  const rateAt = (count: number) => eventRate({ ...r, upgrades: { ...r.upgrades, atoms: r.upgrades.atoms + count } });
  if (rateAt(affordable).lt(cap)) return affordable;
  let lo = 1, hi = affordable;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (rateAt(mid).gte(cap)) hi = mid; else lo = mid + 1; }
  return lo;
}
export function probability(z: number, reactorId: number): number {
  if (z < 1 || z > 10 || reactorId < 1 || reactorId > 3) return 0;
  const t = REACTORS[reactorId - 1];
  return Math.min(.3, t.p * t.q ** (z - t.anchor) * t.h ** Math.max(0, z - t.softMax));
}
