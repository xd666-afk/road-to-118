import { BARIUM_ELEMENT, CAESIUM_ELEMENT, XENON_ELEMENT, archiveUnits } from './config';
import { finiteNumber } from './numbers';
import type { GameState } from './types';

export const acceleratorSegments = [
  { name: '东段 · 探测区', z: 10, data: 7_500, work: '铺设首段束管，安装磁铁和探测舱。' },
  { name: '北段 · 冷却区', z: 18, data: 250_000, work: '接通第二段束管，安装低温冷却站。' },
  { name: '西段 · 注入区', z: 36, data: 550_000, work: '连接第三段束管，安装粒子注入线。' },
  { name: '南段 · 加速区', z: 54, data: 1_200_000, work: '安装射频加速腔，合拢最后一段束管。' },
] as const;

export function segmentReadiness(state: GameState, index: number) {
  const segment = acceleratorSegments[index];
  if (!segment) return undefined;
  const discovered = state.elements[segment.z - 1].discovered;
  const funded = index === state.accelerator.built ? state.accelerator.funded ?? 0 : 0;
  const available = index === state.accelerator.built && discovered;
  return { segment, discovered, funded, available };
}

export function restoreAccelerator(state: GameState, raw: unknown): GameState['accelerator'] {
  if (!raw || typeof raw !== 'object' || !('built' in raw) || typeof raw.built !== 'number' ||
      !Number.isInteger(raw.built) || raw.built < 0 || raw.built > acceleratorSegments.length) return state.accelerator;
  const built = acceleratorSegments.slice(0, raw.built).filter(({ z }) => state.elements[z - 1].discovered).length;
  const commissioned = built === acceleratorSegments.length && 'commissioned' in raw && raw.commissioned === true;
  const runTarget = 'runTarget' in raw ? raw.runTarget : CAESIUM_ELEMENT;
  const runRemaining = 'runRemaining' in raw ? raw.runRemaining : undefined;
  if (!commissioned || (runTarget !== CAESIUM_ELEMENT && runTarget !== BARIUM_ELEMENT) ||
      !researchUnlocked(state, runTarget) || state.elements[runTarget - 1].archived ||
      typeof runRemaining !== 'number' || !(runRemaining >= 0 && runRemaining <= acceleratorSweeps[0])) {
    const work = acceleratorSegments[built];
    const funded = 'funded' in raw ? raw.funded : undefined;
    if (work && state.elements[work.z - 1].discovered && typeof funded === 'number' &&
        Number.isInteger(funded) && funded > 0 && funded < work.data) return { built, commissioned, funded };
    return { built, commissioned };
  }
  const locks = 'runLocks' in raw ? raw.runLocks : undefined;
  const maxLocks = acceleratorSweep(runRemaining).phase;
  const runLocks = typeof locks === 'number' && Number.isInteger(locks) && locks > 0 && locks <= maxLocks
    ? locks : undefined;
  const offset = 'runOffset' in raw ? raw.runOffset : undefined;
  const runOffset = runTarget === BARIUM_ELEMENT && runRemaining > 0 &&
    typeof offset === 'number' && Number.isInteger(offset) && offset !== 0 && Math.abs(offset) <= 2 ? offset : undefined;
  return { built, commissioned, runTarget, runRemaining, runLocks, runOffset };
}

export const acceleratorRecipes = {
  [CAESIUM_ELEMENT]: { sample: XENON_ELEMENT, units: 12, data: 45_000 },
  [BARIUM_ELEMENT]: { sample: 36, units: 18, data: 75_000 },
} as const;
export type AcceleratorTarget = keyof typeof acceleratorRecipes;
export const acceleratorSweeps = [10, 7, 4, 0] as const;
export const acceleratorBatch = { seconds: acceleratorSweeps[0], output: 25, bonus: 5 } as const;
const bariumOffsets = [
  [-2, 1, -2],
  [1, -2, 2],
  [2, -1, 2],
] as const;

export function acceleratorSweep(remaining: number) {
  const phase = acceleratorSweeps.filter(boundary => boundary >= remaining).length - 1;
  const next = acceleratorSweeps[phase + 1];
  const ready = remaining > 0 && acceleratorSweeps[phase] - remaining >= .75;
  return { phase, next, ready };
}

export function bariumBeamOffset(state: GameState) {
  const { runOffset, runRemaining } = state.accelerator;
  if (runOffset !== undefined) return runOffset;
  const total = finiteNumber(state.elements[BARIUM_ELEMENT - 1].totalProduced, Number.MAX_SAFE_INTEGER);
  const pattern = Math.floor(total / acceleratorBatch.bonus) % bariumOffsets.length;
  return bariumOffsets[pattern][acceleratorSweep(runRemaining ?? 0).phase] ?? 0;
}

export function activeAcceleratorTarget(run: GameState['accelerator']) {
  return run.runRemaining === undefined ? undefined : run.runTarget ?? CAESIUM_ELEMENT;
}

function researchUnlocked(state: GameState, target: AcceleratorTarget) {
  return target === CAESIUM_ELEMENT || state.elements[CAESIUM_ELEMENT - 1].archived;
}

export function acceleratorReadiness(state: GameState, target: AcceleratorTarget) {
  const recipe = acceleratorRecipes[target];
  const supply = state.elements[recipe.sample - 1];
  const specimen = state.elements[target - 1];
  const active = activeAcceleratorTarget(state.accelerator);
  const remaining = active === target ? state.accelerator.runRemaining : undefined;
  const unlocked = researchUnlocked(state, target);
  const supplied = supply.inventory.gte(recipe.units) && state.data.gte(recipe.data);
  const enoughToArchive = specimen.inventory.gte(archiveUnits(target) - specimen.deposited);
  const output = acceleratorBatch.output + acceleratorBatch.bonus * (state.accelerator.runLocks ?? 0);
  return { recipe, supply, specimen, remaining, enoughToArchive, output, ready: state.accelerator.commissioned &&
    unlocked && supply.discovered && active === undefined && supplied && !specimen.archived && !enoughToArchive };
}
