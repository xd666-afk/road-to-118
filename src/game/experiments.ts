import { ARCHIVE_UNITS, MODULE_UPGRADES, productionParallel, REACTORS } from './config';
import { eventRate, probability } from './economy';
import { abilityBonuses } from './abilityProgress';
import { assignedToSample } from './sampleContract';
import type { GameState, Module, ReactorState } from './types';

export const EXPERIMENT_SECONDS = 120;
export const NEXT_EXPERIMENT_SECONDS = 15;
export const INDUSTRY_DISCOUNT = 25;
type Reward = { kind: 'energy' | 'data' | 'discount'; amount: number };
export type ExperimentOffer = { kind: 'pulse'; goal: number; reward: Reward } |
  { kind: 'archive'; z: number; goal: number; reward: Reward } |
  { kind: 'production'; z: number; reactor: number; goal: number; reward: Reward };
type Delivery = { reactor: number; z: number; count: number };
export type ExperimentBoard = {
  round: number;
  offers: ExperimentOffer[];
  cooldown: number;
  coupon: boolean;
  active?: { index: number; progress: number; remaining: number; reactor?: number; fraction?: number };
  delivery?: Delivery;
  result?: 'claimed' | 'expired' | 'cancelled';
};

export function productionPlans(state: GameState, offer: Extract<ExperimentOffer, { kind: 'production' }>) {
  const lead = state.reactors.filter(r => r.built).at(-1)!;
  const support = state.reactors[offer.reactor - 1];
  const productionBoost = 1 + abilityBonuses(state).production / 100;
  return ([{ kind: 'lead', reactor: lead }, { kind: 'support', reactor: support }] as const)
    .filter(plan => plan.kind === 'lead' || plan.reactor.id !== lead.id)
    .map(({ kind, reactor }) => {
      const enabled = reactor.active && !assignedToSample(state, reactor);
      const parallel = state.modules.reaction && state.automation.reaction ? productionParallel(reactor.id, state.moduleLevels.reaction) : 1;
      const rate = eventRate(reactor).toNumber() * probability(offer.z, reactor.id) * parallel * productionBoost;
      return { kind, reactor, enabled, seconds: enabled && rate > 0 ? Math.max(1, Math.ceil(offer.goal / rate)) : undefined };
    });
}

export function experimentProduction(state: GameState, reactor: ReactorState) {
  const board = state.experimentBoard, active = board?.active;
  if (!board || !active || active.reactor !== reactor.id || active.remaining <= 0) return;
  const offer = board.offers[active.index];
  if (offer.kind === 'production' && active.progress < offer.goal) return { offer, active };
}

export function availableIndustryUpgrade(state: GameState) {
  return (Object.keys(MODULE_UPGRADES) as Module[]).some(key => state.modules[key] && MODULE_UPGRADES[key][state.moduleLevels[key] - 1]);
}

export function industryUpgradePrice(state: GameState, key: Module) {
  const cost = MODULE_UPGRADES[key]?.[state.moduleLevels[key] - 1];
  if (!cost || !state.experimentBoard?.coupon) return cost;
  const rate = (100 - INDUSTRY_DISCOUNT) / 100;
  return { coins: Math.ceil(cost.coins * rate), data: Math.ceil(cost.data * rate) };
}

export function nextExperimentRound(state: GameState, round: number, coupon: boolean): ExperimentBoard {
  const mixer = (salt: number) => (Math.imul((state.seed ^ Math.imul(round, 0x9e3779b9)) + salt, 0x85ebca6b) >>> 0);
  const built = state.reactors.filter(r => r.built);
  const support = built[mixer(5) % (built.length - 1)], current = REACTORS[built.at(-1)!.id - 1];
  const speed = eventRate({ ...support, active: true }).toNumber();
  const products = state.elements.flatMap((row, i) => row.discovered && speed * probability(i + 1, support.id) >= .2 ? [i + 1] : []);
  const target = products[mixer(9) % products.length] ?? 1;
  const energy = Math.max(120, Math.round(current.gain * current.cap * 8));
  const data = Math.max(40, Math.round(current.cap * 8));
  const offers: ExperimentOffer[] = [
    { kind: 'pulse', goal: 7 + mixer(3) % 6, reward: { kind: 'energy', amount: energy } },
    { kind: 'production', reactor: support.id, z: target, goal: 8 + mixer(6) % 9, reward: { kind: 'data', amount: data } },
  ];
  const archives = state.elements.flatMap((row, i) => row.discovered && !row.archived ? [i + 1] : []);
  // Early known samples are the most accessible commissioning targets.
  if (archives.length) {
    const z = archives[mixer(11) % Math.min(archives.length, 4)];
    const goal = Math.min(ARCHIVE_UNITS - state.elements[z - 1].deposited, 12 + mixer(17) % 9);
    const reward: Reward = !coupon && availableIndustryUpgrade(state)
      ? { kind: 'discount', amount: data } : { kind: 'energy', amount: energy * 2 };
    offers.push({ kind: 'archive', z, goal, reward });
  }
  return { round, offers, cooldown: 0, coupon };
}

export function isOfferAvailable(state: GameState, offer: ExperimentOffer) {
  return offer.kind !== 'archive' || ARCHIVE_UNITS - state.elements[offer.z - 1].deposited >= offer.goal && !state.elements[offer.z - 1].archived;
}

export function restoreExperimentBoard(value: unknown, state: GameState): ExperimentBoard | undefined {
  if (!state.reactors[1].built || !value || typeof value !== 'object') return;
  const raw = value as Record<string, unknown>;
  const bounded = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && x >= min && x <= max;
  if (!bounded(raw.round, 1, Number.MAX_SAFE_INTEGER) || !Number.isInteger(raw.round) ||
    !bounded(raw.cooldown, 0, NEXT_EXPERIMENT_SECONDS) || !Array.isArray(raw.offers) || typeof raw.coupon !== 'boolean') return;
  const offers = raw.offers.filter((o): o is ExperimentOffer => {
    if (!bounded(o?.goal, 1, ARCHIVE_UNITS) || !Number.isInteger(o.goal) ||
      !['energy', 'data', 'discount'].includes(o.reward?.kind) || !bounded(o.reward.amount, 1, 1e12)) return false;
    if (o.kind === 'pulse') return true;
    if (!Number.isInteger(o.z) || !state.elements[o.z - 1]?.discovered) return false;
    return o.kind === 'archive' || o.kind === 'production' && Number.isInteger(o.reactor) && state.reactors[o.reactor - 1]?.built;
  });
  if (offers.length !== raw.offers.length || offers.length < 2 || offers.length > 3) return;
  const board: ExperimentBoard = { round: raw.round, offers, cooldown: raw.cooldown, coupon: raw.coupon };
  const builtReactor = (id: unknown): id is number => bounded(id, 1, state.reactors.length) && Number.isInteger(id) && state.reactors[id - 1]?.built;
  const active = raw.active as Record<string, unknown> | undefined;
  if (active && board.cooldown === 0 && bounded(active.index, 0, offers.length - 1) && Number.isInteger(active.index) &&
    bounded(active.progress, 0, offers[active.index].goal) && bounded(active.remaining, 0, EXPERIMENT_SECONDS)) {
    const offer = offers[active.index];
    board.active = { index: active.index, progress: active.progress, remaining: active.remaining };
    if (offer.kind === 'production') {
      board.active.reactor = builtReactor(active.reactor) ? active.reactor : offer.reactor;
      board.active.fraction = bounded(active.fraction, 0, 1) && active.fraction < 1 ? active.fraction : 0;
    }
  }
  const delivery = raw.delivery as Record<string, unknown> | undefined;
  if (delivery && builtReactor(delivery.reactor) && bounded(delivery.z, 1, state.elements.length) &&
    Number.isInteger(delivery.z) && state.elements[delivery.z - 1].discovered &&
    bounded(delivery.count, 1, ARCHIVE_UNITS) && Number.isInteger(delivery.count)) {
    board.delivery = { reactor: delivery.reactor, z: delivery.z, count: delivery.count };
  }
  if (raw.result === 'claimed' || raw.result === 'expired' || raw.result === 'cancelled') board.result = raw.result;
  return board;
}
