export const PULSE_BOOST_MS = 60_000;
export const PULSE_DROP_MS = 16_000;
export const PULSE_DROP_WARNING_MS = 6_000;
export const PULSE_DROP_RETRACT_MS = 900;

export const PULSE_BOOSTS = {
  inspiration: { name: '灵感点', description: '手动碰撞的碰撞能和研究数据 ×2', energy: 2, data: 2 },
  energy: { name: '能量碎片', description: '手动碰撞的碰撞能 ×3', energy: 3, data: 1 },
  data: { name: '数据碎片', description: '手动碰撞的研究数据 ×3', energy: 1, data: 3 },
} as const;

export type PulseBoostKind = keyof typeof PULSE_BOOSTS;
export type PulseBoost = { kind: PulseBoostKind; expiresAt: number };
export type PulseDrop = PulseBoost & { id: number; x: number; y: number; practice: boolean };

export function isPulseBoostKind(value: unknown): value is PulseBoostKind {
  return typeof value === 'string' && Object.hasOwn(PULSE_BOOSTS, value);
}
