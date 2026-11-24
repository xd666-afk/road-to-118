import type { GameState } from './types';

export const ECHO_HITS = 3;
export const ECHO_DATA_LIMIT = 12;
export const LITHIUM_CHARGE = 8;
export const LITHIUM_SAMPLES = 6;
export const TRIAL_LITHIUM_CHARGE = 4;
export const TRIAL_LITHIUM_SAMPLES = 3;
export const TRIAL_ECHO_DATA = 2;

export const techniques = {
  2: {
    name: '氦回波', hint: '回波',
    description: '每第 3 次手动碰撞触发回波，额外获得研究数据。',
    trial: '再点容器 3 次，观察两道回波。试用可额外获得 2 点研究数据。',
  },
  3: {
    name: '锂蓄能', hint: '蓄能',
    description: '手动碰撞 8 次充满电芯。选择已发现的目标后，主动释放并获得 6 份样本。',
    trial: '点击容器 4 次给电芯充电，再释放它，获得 3 份锂样本。',
  },
} as const;

export type TechniqueElement = keyof typeof techniques;

export function isTechniqueElement(z: unknown): z is TechniqueElement {
  return z === 2 || z === 3;
}

export function canTryTechnique(state: GameState, z: TechniqueElement) {
  return state.elements[z - 1].discovered && !state.pulseTech.tried.includes(z);
}
