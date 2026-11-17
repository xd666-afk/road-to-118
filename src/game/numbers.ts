import Decimal from 'decimal.js';
Decimal.set({ precision: 48, rounding: Decimal.ROUND_DOWN, toExpNeg: -6, toExpPos: 18, maxE: 9e15, minE: -9e15 });
export { Decimal as Big };
export type Amount = Decimal;
export const D = (value: Decimal.Value = 0) => new Decimal(value);
const units = ['', '万', '亿', '万亿', '京', '垓', '秭', '穰', '沟', '涧', '正', '载'];
export function format(value: Decimal.Value, scientific = false, digits = 4): string {
  let n: Decimal; try { n = D(value); } catch { return '—'; }
  if (!n.isFinite()) return '—';
  if (n.isZero()) return '0';
  if (scientific || n.abs().gte('1e48')) return n.toExponential(digits - 1).replace('e+', 'e');
  // Decimal already stores its decimal exponent. A transcendental logarithm on
  // every HUD value is unnecessary and expensive on mobile devices.
  const index = Math.max(0, Math.min(11, Math.floor(n.e / 4)));
  const scaled = n.div(D(10).pow(index * 4));
  if (index === 0 && n.abs().lt(1000)) return n.toDecimalPlaces(n.abs().lt(10) ? 2 : n.abs().lt(100) ? 1 : 0).toString();
  return scaled.toSignificantDigits(digits).toString() + units[index];
}
export const nonnegative = (n: Decimal) => Decimal.max(0, n);
export const finiteNumber = (n: Decimal, ceiling = 1e12) => n.gte(ceiling) ? ceiling : n.toNumber();
