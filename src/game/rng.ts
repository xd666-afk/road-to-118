// Serializable Mulberry32. All economic randomness uses this injected state.
export function random(s: { rng: number }): number {
  s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  let t = s.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const waitingHazard = (s: { rng: number }) => -Math.log(Math.max(Number.MIN_VALUE, 1 - random(s)));
export function poisson(s: { rng: number }, lambda: number): number {
  if (!(lambda > 0)) return 0;
  if (lambda < 30) { const limit = Math.exp(-lambda); let k = 0, product = 1; do { k++; product *= random(s); } while (product > limit); return k - 1; }
  const normal = Math.sqrt(-2 * Math.log(Math.max(1e-15, random(s)))) * Math.cos(2 * Math.PI * random(s));
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal));
}
