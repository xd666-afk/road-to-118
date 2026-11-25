import { XENON_ELEMENT } from './config';
import { Big } from './numbers';
import type { Amount } from './numbers';
import type { GameState } from './types';

export const PROJECTS_UNLOCK = 10;
const LEGACY_SPECTROSCOPY_UNLOCKS = [2, 4, 10];

export const projects = {
  spectroscopy: {
    name: '光谱观测站', effect: '研究数据',
    stages: [
      { name: '光谱探头', z: PROJECTS_UNLOCK, data: 80, bonus: 5 },
      { name: '分光光路', z: 12, data: 650, bonus: 5 },
      { name: '观测穹顶', z: 18, data: 9_000, bonus: 8 },
    ],
  },
  separation: {
    name: '样本分离厂', effect: '样本产量',
    stages: [
      { name: '进料塔', z: 10, data: 5_000, bonus: 6 },
      { name: '分离塔', z: 18, data: 65_000, bonus: 8 },
      { name: '成品仓', z: 36, data: 360_000, bonus: 10 },
    ],
  },
  pulse: {
    name: '脉冲供能站', effect: '手动碰撞能',
    stages: [
      { name: '储能组', z: 18, data: 110_000, bonus: 12 },
      { name: '增压线圈', z: 36, data: 550_000, bonus: 18 },
      { name: '脉冲汇流塔', z: 54, data: 1_100_000, bonus: 25 },
    ],
  },
} as const;

export type ProjectId = keyof typeof projects;
export type ProjectProgress = { built: number; funded: number };
export const projectIds = Object.keys(projects) as ProjectId[];
export const SPECTRAL_SAMPLES = 8;
export const SPECTRAL_SECONDS = 8;
export const STATION_SURGE = 50;

export type ProjectOperations = {
  scan?: { target: number; level: number; remaining: number };
  separationTarget?: number;
  pulseCharge: number;
  pulseHits: number;
};

export function researchCampusUnlocked(state: GameState) {
  return state.elements[PROJECTS_UNLOCK - 1].discovered;
}

export function knownReactorSample(state: GameState, target: number) {
  return Number.isInteger(target) && target >= 1 && target <= XENON_ELEMENT && state.elements[target - 1].discovered;
}

export function spectrumReward(target: number, level: number) {
  return (20 + target * 4) * level;
}

export function separationCost(target: number) {
  return 50 * target;
}

export function separationBonus(state: GameState, target: number) {
  const { built } = state.projects.separation;
  return built > 0 && state.projectOperations.separationTarget === target ? 5 + built * 10 : 0;
}

export function pulseStationLimits(state: GameState) {
  const { built } = state.projects.pulse;
  return built > 0 ? { charge: 18 - built * 2, hits: 6 + built * 2 } : { charge: 0, hits: 0 };
}

export function researchContribution(balance: Amount, remaining: number, limit = remaining): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || remaining <= 0) return 0;
  return Big.min(balance, remaining, limit).floor().toNumber();
}

export function projectBonus(state: GameState, id: ProjectId): number {
  if (!researchCampusUnlocked(state)) return 0;
  return projects[id].stages.slice(0, state.projects[id].built).reduce((sum, stage) => sum + stage.bonus, 0);
}

export function restoreProjectProgress(state: GameState, raw: unknown): GameState['projects'] {
  const restored = { ...state.projects };
  if (!raw || typeof raw !== 'object') return restored;
  for (const id of projectIds) {
    const progress = (raw as Record<string, unknown>)[id];
    if (!progress || typeof progress !== 'object') continue;
    const stages = projects[id].stages;
    // Preserve installments that were paid before the optical project moved to Ne.
    const unlocks = id === 'spectroscopy' ? LEGACY_SPECTROSCOPY_UNLOCKS : stages.map(stage => stage.z);
    const available = unlocks.filter(z => state.elements[z - 1].discovered).length;
    const built = 'built' in progress ? progress.built : undefined;
    if (typeof built !== 'number' || !Number.isInteger(built) || built < 0 || built > available) continue;
    const funded = 'funded' in progress ? progress.funded : undefined;
    restored[id] = {
      built,
      funded: built < available && typeof funded === 'number' && Number.isInteger(funded) &&
        funded >= 0 && funded < stages[built].data ? funded : 0,
    };
  }
  return restored;
}

export function restoreProjectOperations(state: GameState, raw: unknown): ProjectOperations {
  if (!raw || typeof raw !== 'object') return state.projectOperations;
  const { scan, separationTarget, pulseCharge, pulseHits } = raw as Partial<ProjectOperations>;
  const limits = pulseStationLimits(state);
  const validCounter = (value: number | undefined, max: number) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 ? Math.min(max, value) : 0;
  const hits = validCounter(pulseHits, limits.hits);
  const restored: ProjectOperations = { pulseCharge: hits ? 0 : validCounter(pulseCharge, limits.charge), pulseHits: hits };
  if (scan && knownReactorSample(state, scan.target) && Number.isInteger(scan.level) &&
      scan.level > 0 && scan.level <= state.projects.spectroscopy.built &&
      typeof scan.remaining === 'number' && scan.remaining >= 0 && scan.remaining <= SPECTRAL_SECONDS) {
    restored.scan = { target: scan.target, level: scan.level, remaining: scan.remaining };
  }
  if (state.projects.separation.built > 0 && typeof separationTarget === 'number' && knownReactorSample(state, separationTarget)) {
    restored.separationTarget = separationTarget;
  }
  return restored;
}
