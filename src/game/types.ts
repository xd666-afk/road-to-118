import type { AcceleratorTarget } from './accelerator';
import type { SAVE_VERSION } from './config';
import type { Amount } from './numbers';
import type { PulseBoost } from './pulseBoosts';
import type { ProjectId, ProjectOperations, ProjectProgress } from './projects';
import type { SampleContract } from './sampleContract';
import type { ExperimentBoard } from './experiments';
import type { TechniqueElement } from './pulseTechniques';
export type Upgrade = 'atoms' | 'speed' | 'yield' | 'capacity';
export type WorkMode = 'explore' | 'produce' | 'archive';
export type ReactorJob = WorkMode | 'manual';
export type FeedScope = 'latest' | 'all';
export type AllocationScope = 'all' | 'calibration';
export type Module = 'feed' | 'reaction' | 'allocation';
export interface ElementState { discovered: boolean; inventory: Amount; deposited: number; archived: boolean; firstDiscoveredAt: number | null; firstDiscoveredReactor: number | null; totalProduced: Amount; }
export interface ReactorState { id: number; built: boolean; active: boolean; target: number; exploring: boolean; job: ReactorJob; upgrades: Record<Upgrade, number>; events: Amount; discoveryHazard: number; productionRemainder: Amount; eventRemainder: Amount; }
export interface Notice { id: number; kind: 'discovery' | 'archive' | 'achievement' | 'milestone' | 'complete' | 'info'; text: string; z?: number; }
export type OpeningStep = 'start' | 'charge' | 'sample' | 'explore';
export type FirstRun = { step: 'welcome' | OpeningStep | 'free' } | { step: 'helium'; remaining: number };
export interface GameState {
  saveVersion: typeof SAVE_VERSION; savedAt: number; elapsed: number; seed: number; rng: number; coins: Amount; data: Amount;
  reactors: ReactorState[]; elements: ElementState[];
  modules: Record<Module, boolean>;
  moduleLevels: Record<Module, number>;
  automation: { feed: boolean; reaction: boolean; allocation: boolean; reserve: Amount; mode: WorkMode | 'custom'; target: number; feedScope: FeedScope; allocationScope: AllocationScope };
  stats: {
    events: Amount; produced: Amount; earned: Amount; peak: Amount; builds: number; purchases: number; lastEvent: string;
    /** Historical checkpoints. Each is null unless its own element was archived. */
    neonCompletedAt: number | null; calciumCompletedAt: number | null; xeCompletedAt: number | null;
    /** Full H–Xe collection, not the calcium milestone and not a claim about 118. */
    completedAt: number | null; milestones: Record<string, number>;
  };
  achievements: string[]; settings: { scientific: boolean; reducedMotion: boolean; collisionSound: boolean; guideDismissed: boolean; handsOnGuide: boolean; mix: number[] };
  notices: Notice[]; noticeSeq: number;
  firstRun?: FirstRun;
  pulseBoost?: PulseBoost;
  pulseTech: { echoHits: number; lithium: number; tried: TechniqueElement[] };
  accelerator: { built: number; commissioned: boolean; funded?: number; runTarget?: AcceleratorTarget; runRemaining?: number; runLocks?: number; runOffset?: number };
  projects: Record<ProjectId, ProjectProgress>;
  projectOperations: ProjectOperations;
  discoveryWait: number;
  sampleContract?: SampleContract;
  experimentBoard?: ExperimentBoard;
  observation?: { z: number; progress: number };
}
