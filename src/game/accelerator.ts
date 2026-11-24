import { ARCHIVE_UNITS, CAESIUM_ELEMENT, XENON_ELEMENT } from './config';
import type { GameState } from './types';

export const acceleratorSegments = [
  { name: '东段 · 探测区', z: 10, units: 24, coins: 30_000, data: 7_500, work: '铺设首段束管，安装磁铁和探测舱。' },
  { name: '北段 · 冷却区', z: 20, units: 36, coins: 300_000_000, data: 250_000, work: '接通第二段束管，安装低温冷却站。' },
  { name: '西段 · 注入区', z: 36, units: 48, coins: 8_000_000_000, data: 550_000, work: '连接第三段束管，安装粒子注入线。' },
  { name: '南段 · 加速区', z: 54, units: 64, coins: 30_000_000_000, data: 1_200_000, work: '安装射频加速腔，合拢最后一段束管。' },
] as const;

export function segmentReadiness(state: GameState, index: number) {
  const segment = acceleratorSegments[index];
  if (!segment) return undefined;
  const specimen = state.elements[segment.z - 1];
  const samples = specimen.inventory.gte(segment.units);
  const energy = state.coins.gte(segment.coins);
  const data = state.data.gte(segment.data);
  const discovered = specimen.discovered;
  const ready = index === state.accelerator.built && discovered && samples && energy && data;
  return { segment, specimen, discovered, samples, energy, data, ready };
}

export function restoreAccelerator(state: GameState, raw: unknown): GameState['accelerator'] {
  if (!raw || typeof raw !== 'object' || !('built' in raw) || typeof raw.built !== 'number' ||
      !Number.isInteger(raw.built) || raw.built < 0 || raw.built > acceleratorSegments.length) return state.accelerator;
  const built = acceleratorSegments.slice(0, raw.built).filter(({ z }) => state.elements[z - 1].discovered).length;
  const commissioned = built === acceleratorSegments.length && 'commissioned' in raw && raw.commissioned === true;
  const remaining = 'runRemaining' in raw ? raw.runRemaining : undefined;
  const runRemaining = commissioned && !state.elements[CAESIUM_ELEMENT - 1].archived &&
    typeof remaining === 'number' && remaining >= 0 && remaining <= caesiumRun.seconds ? remaining : undefined;
  return runRemaining === undefined ? { built, commissioned } : { built, commissioned, runRemaining };
}


export const caesiumRun = { seconds: 10, data: 45_000, xenon: 12, output: 25 } as const;

export function caesiumReadiness(state: GameState) {
  const xenon = state.elements[XENON_ELEMENT - 1];
  const specimen = state.elements[CAESIUM_ELEMENT - 1];
  const remaining = state.accelerator.runRemaining;
  const supplied = xenon.inventory.gte(caesiumRun.xenon) && state.data.gte(caesiumRun.data);
  const enoughToArchive = specimen.inventory.gte(ARCHIVE_UNITS - specimen.deposited);
  return { xenon, specimen, remaining, enoughToArchive, ready: state.accelerator.commissioned &&
    xenon.discovered && remaining === undefined && supplied && !specimen.archived && !enoughToArchive };
}
