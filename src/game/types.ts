import type { Amount } from './numbers';
export type Upgrade = 'atoms' | 'speed' | 'yield' | 'capacity';
export type WorkMode = 'explore' | 'produce' | 'archive';
export type Module = 'feed' | 'reaction' | 'allocation';
export interface ElementState { discovered: boolean; inventory: Amount; deposited: number; archived: boolean; firstDiscoveredAt: number | null; firstDiscoveredReactor: number | null; totalProduced: Amount; }
export interface ReactorState { id: number; built: boolean; active: boolean; target: number; exploring: boolean; upgrades: Record<Upgrade, number>; events: Amount; discoveryHazard: number; productionRemainder: Amount; eventRemainder: Amount; }
export interface Notice { id: number; kind: 'discovery' | 'archive' | 'achievement' | 'milestone' | 'complete' | 'info'; text: string; z?: number; }
export interface GameState {
  saveVersion: 2; savedAt: number; elapsed: number; seed: number; rng: number; coins: Amount; data: Amount;
  reactors: ReactorState[]; elements: ElementState[];
  modules: Record<Module, boolean>; automation: { feed: boolean; reaction: boolean; allocation: boolean; reserve: Amount; mode: WorkMode; target: number };
  stats: { events: Amount; produced: Amount; earned: Amount; peak: Amount; builds: number; purchases: number; lastEvent: string; neonCompletedAt: number | null; completedAt: number | null; milestones: Record<string, number>; };
  achievements: string[]; settings: { scientific: boolean; reducedMotion: boolean; guideDismissed: boolean; mix: number[] };
  notices: Notice[]; noticeSeq: number;
}
