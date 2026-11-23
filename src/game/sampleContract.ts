import { eventRate } from './economy';
import type { GameState, ReactorState } from './types';

export const SAMPLE_ROUTES = {
  hydrogen: { name: '氢供料', symbol: 'H', reward: 1800, resource: '碰撞能', supplySeconds: 12 },
  helium: { name: '氦供料', symbol: 'He', reward: 320, resource: '研究数据', supplySeconds: 17 },
} as const;

export const SAMPLE_CLUES = {
  7: '它属于第二周期，最外层电子比氧少 1 个。',
  8: '它属于第二周期，最外层有 6 个电子。',
  9: '它属于第二周期，最外层电子比氖少 1 个。',
} as const;

export type SampleRoute = keyof typeof SAMPLE_ROUTES;
export type SampleAnswer = keyof typeof SAMPLE_CLUES;
export type SampleContract =
  | { route: SampleRoute; lead: number; support: number; supply: number; scan: number }
  | { route: SampleRoute; answer: SampleAnswer; guess: SampleAnswer };

export const SAMPLE_GUESS_BONUS = 100;
export const sampleReady = (contract: SampleContract) => 'answer' in contract || (contract.supply >= 1 && contract.scan >= 1);
export const assignedToSample = (state: GameState, reactor: ReactorState) => {
  const contract = state.sampleContract;
  return !!contract && !('answer' in contract) && !sampleReady(contract) &&
    (contract.lead === reactor.id || contract.support === reactor.id);
};

export function sampleAnswer(seed: number): SampleAnswer {
  return ([7, 8, 9] as const)[(seed >>> 0) % 3];
}

export function advanceSampleContract(state: GameState, seconds: number) {
  const contract = state.sampleContract;
  if (!contract || 'answer' in contract || sampleReady(contract)) return;
  const lead = state.reactors[contract.lead - 1], support = state.reactors[contract.support - 1];
  const route = SAMPLE_ROUTES[contract.route];
  const workRate = (r: ReactorState) => {
    const speed = eventRate(r);
    return speed.div(speed.plus(8)).toNumber();
  };
  // The instruments work in parallel. The analyzer can finish once the
  // support instrument has delivered the calibration sample.
  const supplyRate = workRate(support) / route.supplySeconds;
  const scanRate = workRate(lead) / 18;
  const waiting = contract.supply >= 1 ? 0 :
    supplyRate > 0 ? Math.min(seconds, (1 - contract.supply) / supplyRate) : seconds;
  if (waiting > 0) contract.scan = Math.min(.8, contract.scan + waiting * scanRate);
  contract.supply = Math.min(1, contract.supply + seconds * supplyRate);
  contract.scan = Math.min(1, contract.scan + (seconds - waiting) * scanRate);
}

export function isSampleRoute(value: unknown): value is SampleRoute {
  return typeof value === 'string' && Object.hasOwn(SAMPLE_ROUTES, value);
}
export function isSampleAnswer(value: unknown): value is SampleAnswer {
  return value === 7 || value === 8 || value === 9;
}

export function restoreSampleContract(value: unknown, state: GameState): SampleContract | undefined {
  if (!state.elements[7].discovered || !value || typeof value !== 'object') return;
  const { route, lead, support, supply, scan, answer, guess } = value as Record<string, unknown>;
  if (!isSampleRoute(route)) return;
  if (isSampleAnswer(answer) && isSampleAnswer(guess)) {
    return { route, answer: sampleAnswer(state.seed), guess };
  }
  const device = (id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && state.reactors[id - 1]?.built === true;
  const progress = (n: unknown): n is number => typeof n === 'number' && n >= 0 && n <= 1;
  if (device(lead) && device(support) && support < lead && progress(supply) && progress(scan)) {
    return { route, lead, support, supply, scan };
  }
}
