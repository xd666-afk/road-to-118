import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { CircleDashed } from 'lucide-react';
import { Archive, ChevronDown, ClipboardList, Compass, Database, Ellipsis, Grid2X2, SlidersHorizontal, Activity, ArrowDownToLine, ArrowRight, Atom, BookOpen, Check, CirclePause, CirclePlay, Cpu, Download, FlaskConical, Gauge, Layers3, LockKeyhole, Microscope, Plus, RotateCcw, Settings2, ShieldCheck, Sparkles, Trophy, Upload, Zap } from 'lucide-react';
import { Engine, FIRST_HELIUM_SECONDS, archivedCount, discoveredMax, highestReactor } from './game/engine';
import { D, format } from './game/numbers';
import { reactorDisplayPool } from './game/visuals';
import { activeAtoms, capacity, coinPerEvent, eventRate, firstDiscoveryRate, income, maxAffordable, price, probability } from './game/economy';
import { ACHIEVEMENTS, ARCHIVE_UNITS, BARIUM_ELEMENT, CAESIUM_ELEMENT, GAME_VERSION, MODULES, PLAYABLE_ELEMENTS, REACTORS, UPGRADES, XENON_ELEMENT, archiveUnits, productionParallel } from './game/config';
import { deserialize, serialize } from './game/save';
import { createLocalSlot, deleteLocalSlot, loadLocal, saveLocal, switchLocalSlot, SAVE_STORAGE_ERROR, type LocalSave } from './game/localSaves';
import type { GameState, Module, Upgrade } from './game/types';
import { ELEMENTS, KNOWLEDGE, SCIENCE_NOTE, baikeUrl, element } from './data/elements';
import Particles from './components/Particles';
import ManualPulse from './components/ManualPulse';
import ReactorScene from './components/ReactorScene';
import ElementPulseControls, { type TechniqueTrial } from './components/ElementPulseControls';
import { useCollisionSound, type ImpactKind, type ReactorImpact } from './components/collisionEffects';
import Modal from './components/Modal';
import Onboarding from './components/Onboarding';
import OpeningSpotlight from './components/OpeningSpotlight';
import LaunchIntro, { markIntroSeen, shouldPlayIntro } from './components/LaunchIntro';
import { HudRing, LabDrawer } from './components/LabHud';
import { SPOTLIGHT_LENGTH, spotlightStep } from './components/spotlightSteps';
import SavedGames from './components/SavedGames';
import PulseDrops from './components/PulseDrops';
import SampleContract from './components/SampleContract';
import ExperimentBoard from './components/ExperimentBoard';
import ReactorAssignments from './components/ReactorAssignments';
import ResearchProjects from './components/ResearchProjects';
import { experimentProduction } from './game/experiments';
import { acceleratorSegments } from './game/accelerator';
import { assignedToSample } from './game/sampleContract';
import { recommend, applyAdvice, openingStep } from './game/advisor';
import './components/journey.css';
import { AtomicFacts, FurtherScience } from './components/AtomicProfile';
import AtomicSpecimen from './components/AtomicSpecimen';
import { artworkUrl, reactorScene, specimenImageStyle } from './data/artwork';
import ElementAbility from './components/ElementAbility';
import { abilityBonuses, laboratoryBonuses } from './game/abilityProgress';
import AutomationControls, { IndustryModules } from './components/AutomationControls';
import { discoveryPreparation, discoveryStage, isCalibrationSpecimen, observationProgress, observationRate, stageReadiness } from './game/discovery';
import { ATOMIC_PROFILES } from './data/atomic';
import { labGuideStep } from './game/labGuide';
import { projectIds, pulseStationLimits, researchCampusUnlocked, separationBonus, type ProjectId } from './game/projects';
import { canTryTechnique, ECHO_HITS, isTechniqueElement, LITHIUM_CHARGE, techniques, TRIAL_ECHO_DATA, TRIAL_LITHIUM_CHARGE, type TechniqueElement } from './game/pulseTechniques';

const Tutorial = lazy(() => import('./components/Tutorial'));
const Accelerator = lazy(() => import('./components/Accelerator'));
const ProjectCampus = lazy(() => import('./components/ProjectCampus'));

const tabs = [ { id: 'lab', name: '实验室', en: 'LABORATORY', icon: FlaskConical }, { id: 'research', name: '科研', en: 'RESEARCH', icon: Cpu }, { id: 'achievements', name: '成就', en: 'ACHIEVEMENTS', icon: Trophy }, { id: 'stats', name: '统计', en: 'OBSERVATORY', icon: Activity }, { id: 'guide', name: '教程', en: 'HANDBOOK', icon: BookOpen } ];
const TABLE_HASH = '#periodic-table';
const ACCELERATOR_HASH = '#accelerator';
const PROJECTS_HASH = '#projects';
const projectFromHash = (hash: string): ProjectId =>
  projectIds.find(id => hash === `${PROJECTS_HASH}/${id}`) ?? 'spectroscopy';
function tabFromHash(hash: string, state: GameState) {
  if (hash.startsWith('#guide')) return 'guide';
  if (hash === TABLE_HASH) return 'table';
  if (researchCampusUnlocked(state)) {
    if (hash === ACCELERATOR_HASH) return 'accelerator';
    if (hash === PROJECTS_HASH || hash.startsWith(PROJECTS_HASH + '/')) return 'projects';
  }
  return 'lab';
}
const drawerTitles = { upgrades: '实验控制', tasks: '试验委托', archive: '元素周期表', instrument: '仪器控制', next: '下一步', more: '更多', projects: '科研工程' };
type Drawer = keyof typeof drawerTitles;
const clock = (seconds: number) => { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor(s / 60 % 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; };
const intervalLabel = (seconds: number) => !Number.isFinite(seconds) || seconds > 86400 * 365 ? '超过 1 年 / 次' : seconds < 60 ? `约 ${Math.max(1, Math.round(seconds))} 秒 / 次` : seconds < 3600 ? `约 ${(seconds / 60).toFixed(1)} 分钟 / 次` : `约 ${(seconds / 3600).toFixed(1)} 小时 / 次`;
type Dialog = { kind: 'element'; z: number; discovery?: boolean } | { kind: 'settings' | 'complete' } | null;
interface Toast { id: number; text: string; time: number; kind: string; }

function initialReactor(state: GameState) {
  return state.settings.handsOnGuide && !state.settings.guideDismissed && !state.firstRun ? highestReactor(state).id : 1;
}

export default function App() {
  const [boot] = useState(() => {
    const loaded = loadLocal(), engine = new Engine(loaded.state);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) engine.state.settings.reducedMotion = true;
    const offline = loaded.error ? null : engine.offline();
    return { ...loaded, engine, offline };
  });
  const [intro, setIntro] = useState(shouldPlayIntro);
  const finishIntro = useCallback(() => {
    markIntroSeen();
    setIntro(false);
  }, []);
  const engineRef = useRef(boot.engine), [, rerender] = useState(0);
  const activeSlot = useRef(boot.slot);
  const slotId = activeSlot.current.id;
  const [slots, setSlots] = useState(boot.slots);
  const [rawSave, setRawSave] = useState(boot.raw);
  const [slotError, setSlotError] = useState('');
  const [destination, setDestination] = useState(() => tabFromHash(location.hash, boot.engine.state));
  const [campusProject, setCampusProject] = useState(() => projectFromHash(location.hash));
  const [drawer, setDrawer] = useState<Drawer>();
  const tab = destination === 'table' ? 'lab' : destination;
  const [focus, setFocus] = useState(() => initialReactor(boot.engine.state)), [bulk, setBulk] = useState<number | 'max'>(1);
  const [dialog, setDialog] = useState<Dialog>(null), [queue, setQueue] = useState<number[]>([]), [endPending, setEndPending] = useState(false);
  const [trial, setTrial] = useState<TechniqueTrial>();
  const [impact, setImpact] = useState<ReactorImpact>();
  const holdDiscoveries = useRef(false);
  const [toasts, setToasts] = useState<Toast[]>([]), [saveStatus, setSaveStatus] = useState(boot.error ? '存档需处理' : '本地存档'), [saveBlocked, setSaveBlocked] = useState(!!boot.error);
  const [message, setMessage] = useState(boot.error || ''), [flash, setFlash] = useState(0), [debug, setDebug] = useState(false);
  const [offline, setOffline] = useState(boot.offline && boot.offline.seconds > 30 ? boot.offline : null);
  const tableScroll = useRef<HTMLDivElement>(null), importInput = useRef<HTMLInputElement>(null);
  const engine = engineRef.current, s = engine.state, r = s.reactors[focus - 1], c = REACTORS[focus - 1];
  const opening = s.firstRun?.step;
  const visualPool = reactorDisplayPool(s, r);
  const max = discoveredMax(s), archived = archivedCount(s), scientific = s.settings.scientific;
  const engineeringOpen = researchCampusUnlocked(s);
  const playCollision = useCollisionSound(s.settings.collisionSound);
  holdDiscoveries.current = !!dialog || !!trial || queue.length > 0 || tab === 'guide';
  const handsOn = s.settings.handsOnGuide && !s.settings.guideDismissed && !s.firstRun && max >= 2 ? labGuideStep(s) : undefined;
  const dropsVisible = tab !== 'guide' && tab !== 'accelerator' && tab !== 'projects' && !dialog && !s.firstRun && max >= 2;
  const canSpawnRandomDrops = useRef(false);
  canSpawnRandomDrops.current = !intro && dropsVisible && !handsOn && !trial;
  const boost = engine.activePulseBoost();
  const fmt = (v: Parameters<typeof format>[0]) => format(v, scientific);
  const bonuses = laboratoryBonuses(s);
  const energyMultiplier = D(100 + bonuses.energy).div(100);
  const dataMultiplier = D(100 + bonuses.data).div(100);
  const totalIncome = s.reactors.reduce((sum, reactor) => sum.plus(income(reactor)), D(0)).mul(energyMultiplier);
  const totalRate = s.reactors.reduce((sum, reactor) => sum.plus(eventRate(reactor)), D(0));
  const targetKnown = s.elements[r.target - 1].discovered;
  const parallel = targetKnown && s.modules.reaction && s.automation.reaction ? productionParallel(focus, s.moduleLevels.reaction) : 1;
  const runningReactor = r.active ? r : { ...r, active: true };
  const targetSpeed = eventRate(runningReactor);
  const productionChance = probability(r.target, focus);
  const targetStage = !targetKnown ? discoveryStage(r.target) : undefined;
  const nextStage = discoveryStage(max + 1);
  const readiness = nextStage && stageReadiness(s, nextStage);
  const canExplore = !readiness || (focus === readiness.reactor.id && readiness.ready);
  const requirements: string[] = [];
  if (nextStage && readiness && !canExplore) {
    const device = REACTORS[nextStage.reactor - 1];
    const name = `${device.roman} 级${device.name}`;
    if (!readiness.reactor.built) requirements.push(`建造 ${name}`);
    else if (focus !== device.id) requirements.push(`切换到 ${name}`);
    if (readiness.capacity < nextStage.capacity) {
      requirements.push(`设备扩容 ${readiness.capacity}/${nextStage.capacity} 级`);
    }
    if (readiness.tuning < nextStage.tuning) {
      requirements.push(`扩容＋单次收益合计 ${readiness.tuning}/${nextStage.tuning} 级`);
    }
    if (!readiness.calibrated) {
      const sample = element(nextStage.specimen);
      const submitted = s.elements[sample.z - 1].deposited;
      requirements.push(`${sample.name}样本校准（已提交 ${submitted}/${ARCHIVE_UNITS} 份）`);
    }
  }
  const observed = observationProgress(s, r.target);
  const discoveryRate = targetKnown || targetStage ? D(0) : firstDiscoveryRate(runningReactor, targetSpeed);
  const targetRate = targetKnown ? targetSpeed.mul(productionChance * parallel * (1 + (bonuses.production + separationBonus(s, r.target)) / 100)) : discoveryRate;
  const targetChance = targetKnown ? productionChance : -Math.expm1(-discoveryRate.div(targetSpeed).toNumber());
  const commission = experimentProduction(s, r);
  const targetNote = !r.active ? '已暂停' : assignedToSample(s, r) ? '正在执行异常样本委托' :
    commission ? `正在为委托生产${element(commission.offer.z).name}` : !targetKnown && s.discoveryWait > 0
    ? `正在准备样本 · 还需 ${Math.ceil(s.discoveryWait)} 秒` : targetStage
    ? canExplore
      ? `观测 ${Math.floor(observed * 100)}% · 约 ${Math.ceil((1 - observed) / observationRate(r, targetStage, r.target, targetSpeed))} 秒完成`
      : undefined
    : r.target === 2 && s.firstRun?.step === 'helium'
      ? `首次合成 · 约 ${Math.ceil(s.firstRun.remaining)} 秒`
      : `平均等待${intervalLabel(1 / targetRate.toNumber()).replace(' / 次', '')} · 随机触发`;
  const shortfall = (coins: number, data: number) => [s.coins.lt(coins) ? `${fmt(D(coins).minus(s.coins))} 碰撞能` : '', s.data.lt(data) ? `${fmt(D(data).minus(s.data))} 点数据` : ''].filter(Boolean).join('、');
  const practiceDrop = !!engine.pulseDrop?.practice;
  const spotlight = tab === 'guide' || tab === 'projects' || tab === 'accelerator' || trial ? undefined :
    spotlightStep(s, handsOn, tab, focus, practiceDrop, boost?.kind === 'inspiration', shortfall);

  const guidedDrawer = spotlight?.id === 'sample' ? 'upgrades' : spotlight?.id === 'archive' ? 'archive' : undefined;
  const activeDrawer = guidedDrawer ?? (destination === 'table' ? 'archive' : drawer);

  function goToTab(next: string, project = campusProject) {
    if ((next === 'projects' || next === 'accelerator') && !engineeringOpen) return;
    if (next !== 'lab' && next !== 'table') setTrial(undefined);
    setDestination(next);
    setDrawer(undefined);
    if (next === 'projects') setCampusProject(project);
    const hash = next === 'guide' ? '#guide' : next === 'table' ? TABLE_HASH : next === 'accelerator' ? ACCELERATOR_HASH :
      next === 'projects' ? PROJECTS_HASH + '/' + project : '';
    history.replaceState(null, '', location.pathname + location.search + hash);
    window.scrollTo({ top: 0 });
  }

  function toggleDrawer(next: Drawer) {
    if (next === 'archive') goToTab(activeDrawer === 'archive' ? 'lab' : 'table');
    else {
      if (destination === 'table') goToTab('lab');
      setDrawer(activeDrawer === next ? undefined : next);
    }
  }

  function closeDrawer() {
    if (destination === 'table') goToTab('lab');
    else setDrawer(undefined);
  }

  useEffect(() => {
    const followHash = () => {
      setDrawer(undefined);
      const next = tabFromHash(location.hash, engineRef.current.state);
      if (next !== 'lab' && next !== 'table') setTrial(undefined);
      if (next === 'projects') setCampusProject(projectFromHash(location.hash));
      setDestination(next);
    };
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, []);

  useEffect(() => {
    if (!activeDrawer || tab !== 'lab' || spotlight || dialog) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (destination === 'table') {
        history.replaceState(null, '', location.pathname + location.search);
        setDestination('lab');
      }
      setDrawer(undefined);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [activeDrawer, destination, tab, spotlight?.id, dialog]);

  function collect() {
    const notices = engineRef.current.state.notices.splice(0);
    if (notices.length) {
      const discoveries = notices.filter(n => n.kind === 'discovery').map(n => n.z!);
      if (discoveries.length) {
        holdDiscoveries.current = true;
        setQueue(old => [...old, ...discoveries]);
        setFlash(v => v + 1);
        const z = discoveries[0];
        const at = Date.now();
        setImpact(previous => ({ serial: (previous?.serial ?? 0) + 1, kind: 'discovery', at, symbol: element(z).symbol }));
      }
      if (notices.some(n => n.kind === 'complete')) setEndPending(true);
      setToasts(old => [...old, ...notices.filter(n => n.kind !== 'discovery').map(n => ({ ...n, time: Date.now() }))].slice(-4));
    }
    rerender(v => v + 1);
  }
  function act<T>(fn: (e: Engine) => T): T {
    const e = engineRef.current;
    const priorStep = e.state.firstRun?.step;
    const priorBoost = e.state.pulseBoost;
    const priorContract = e.state.sampleContract;
    const priorExperiments = e.state.experimentBoard;
    const priorAccelerator = e.state.accelerator;
    const priorProjects = e.state.projects;
    const priorProjectOperations = e.state.projectOperations;
    const priorBoostedPulse = e.state.stats.milestones.boostedPulse;
    const priorCharge = e.state.pulseTech.lithium;
    const priorTrials = e.state.pulseTech.tried.length;
    const checkpoint = handsOn && labGuideStep(e.state).id;
    const priorTarget = handsOn && e.state.reactors[0].target;
    const priorExploring = handsOn && e.state.reactors[0].exploring;
    const output = fn(e);
    if ((priorStep !== e.state.firstRun?.step || priorBoost !== e.state.pulseBoost || priorContract !== e.state.sampleContract ||
      priorExperiments !== e.state.experimentBoard || priorAccelerator !== e.state.accelerator || priorProjects !== e.state.projects ||
      priorProjectOperations !== e.state.projectOperations ||
      priorBoostedPulse !== e.state.stats.milestones.boostedPulse ||
      priorTrials !== e.state.pulseTech.tried.length ||
      (priorCharge !== e.state.pulseTech.lithium && (priorCharge === LITHIUM_CHARGE || e.state.pulseTech.lithium === LITHIUM_CHARGE)) ||
      (checkpoint && (checkpoint !== labGuideStep(e.state).id || priorTarget !== e.state.reactors[0].target ||
        priorExploring !== e.state.reactors[0].exploring))) && !saveBlocked) {
      const result = saveLocal(activeSlot.current.id, e.state);
      if (!result.ok) setMessage(result.message);
    }
    collect();
    return output;
  }
  const persistent = useRef({ saveBlocked }); persistent.current = { saveBlocked };
  useEffect(() => {
    let last = Date.now(), lastSave = last;
    const tick = () => {
      const now = Date.now(), seconds = Math.max(0, (now - last) / 1000); last = now;
      if (document.hidden) return;
      const e = engineRef.current;
      e.advance(seconds, seconds < 5, !holdDiscoveries.current); e.state.savedAt = now;
      const guidedDiscovery = e.state.settings.handsOnGuide && !e.state.settings.guideDismissed &&
        e.state.notices.some(n => n.kind === 'discovery');
      e.updatePulseDrop(now, canSpawnRandomDrops.current); collect();
      if ((guidedDiscovery || now - lastSave >= 12000) && !persistent.current.saveBlocked) { const result = saveLocal(activeSlot.current.id, e.state); setSaveStatus(result.ok ? '已自动保存' : '存储不可用'); if (!result.ok) setMessage(result.message); lastSave = now; }
    };
    const timer = window.setInterval(tick, 250);
    let hiddenAt: number | null = document.hidden ? last : null;
    const visibility = () => {
      const now = Date.now();
      if (document.hidden) { hiddenAt = now; engineRef.current.updatePulseDrop(now, false); engineRef.current.state.savedAt = now; if (!persistent.current.saveBlocked) saveLocal(activeSlot.current.id, engineRef.current.state); }
      else { if (hiddenAt !== null) { engineRef.current.state.savedAt = hiddenAt; const summary = engineRef.current.offline(now); if (summary.seconds > 3) setOffline(summary); hiddenAt = null; } last = now; collect(); }
    };
    const leaving = () => { if (!persistent.current.saveBlocked) saveLocal(activeSlot.current.id, engineRef.current.state); };
    document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', leaving);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', leaving); };
  }, [slotId]);
  useEffect(() => {
    if (intro || dialog || trial || tab === 'guide') return;
    if (queue.length) {
      const reveal = () => {
        setDialog({ kind: 'element', z: queue[0], discovery: true });
        setQueue(q => q.slice(1));
      };
      if (tab === 'lab' && isTechniqueElement(queue[0])) {
        const delay = window.setTimeout(reveal, 550);
        return () => window.clearTimeout(delay);
      }
      reveal();
    } else if (endPending) { setDialog({ kind: 'complete' }); setEndPending(false); }
  }, [intro, dialog, queue, endPending, tab, trial]);

  function exportSave() {
    const blob = new Blob([serialize(engineRef.current.state)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `Road-to-118-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url); setMessage('存档已导出。请妥善保留这个文件。');
  }
  function exportRawSave() {
    if (rawSave === undefined) return;
    const blob = new Blob([rawSave], { type: 'text/plain;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `Road-to-118-original-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); URL.revokeObjectURL(url);
  }
  function saveCurrent() {
    if (saveBlocked && rawSave !== undefined) {
      try { localStorage.setItem(`road-to-118.recovery.${Date.now()}`, rawSave); }
      catch { setMessage('原始旧档备份失败，旧档仍保留。请先导出原始旧档和当前进度。'); return; }
    }
    const result = saveLocal(slotId, engineRef.current.state);
    if (result.ok) { setSaveBlocked(false); setRawSave(undefined); }
    setSlotError(result.ok ? '' : result.message);
    setSaveStatus(result.ok ? '已手动保存' : '存储不可用'); setMessage(result.message);
  }
  async function importSave(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('存档文件过大。');
      const imported = deserialize(await file.text());
      if (activeSlot.current.id !== slotId) throw new Error('已切换存档，请重新选择要导入的文件。');
      if (saveBlocked && rawSave !== undefined) localStorage.setItem(`road-to-118.recovery.${Date.now()}`, rawSave);
      activateSave({ state: imported, slot: activeSlot.current }, '存档导入成功，继续你的实验。', true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败，当前进度已保留。';
      setSlotError(message);
      setMessage(message);
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  }

  function openSaves() {
    setSlotError('');
    setDialog({ kind: 'settings' });
  }

  function activateSave(save: LocalSave, message = '', persistBeforeSwitch = false) {
    const next = new Engine(save.state);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) next.state.settings.reducedMotion = true;
    const summary = save.error ? null : next.offline();
    if (persistBeforeSwitch) {
      const result = saveLocal(save.slot.id, next.state);
      if (!result.ok) { setDialog(null); setMessage(result.message); return; }
    }
    activeSlot.current = save.slot;
    engineRef.current = next;
    persistent.current.saveBlocked = !!save.error;
    setSaveBlocked(!!save.error);
    setRawSave(save.raw);
    setSaveStatus(save.error ? '存档需处理' : '本地存档');
    setMessage(save.error ?? message);
    setQueue([]);
    setTrial(undefined);
    setImpact(undefined);
    setEndPending(false);
    setToasts([]);
    setFocus(initialReactor(next.state));
    setBulk(1);
    setFlash(0);
    setDialog(null);
    setOffline(summary && summary.seconds > 3 ? summary : null);
    goToTab('lab');
    rerender(v => v + 1);
  }

  function changeSave(operation: 'create' | 'switch' | 'delete', id = slotId): boolean {
    setSlotError('');
    try {
      if (operation !== 'delete' && !saveBlocked) {
        const result = saveLocal(slotId, engineRef.current.state);
        if (!result.ok) throw new Error(result.message);
      }
      const change = operation === 'create' ? createLocalSlot()
        : operation === 'switch' ? switchLocalSlot(id) : deleteLocalSlot(id, slotId);
      setSlots(change.slots);
      if (change.save) activateSave(change.save);
      return true;
    } catch (error) {
      setSlotError(error instanceof Error && !(error instanceof DOMException) ? error.message : SAVE_STORAGE_ERROR);
      return false;
    }
  }
  function openElement(z: number) { setDialog({ kind: 'element', z }); }
  const advice = recommend(s), lesson = openingStep(s);
  const goal = { ...advice, run: (e: Engine) => {
    if (advice.action === 'table') goToTab('table');
    else if (advice.action === 'accelerator') goToTab('accelerator');
    else { applyAdvice(e, advice); if (advice.reactor && e.state.reactors[advice.reactor - 1].built && ['build', 'explore', 'produce', 'upgrade'].includes(advice.action)) setFocus(advice.reactor); }
  } };
  function dismissGuide() {
    act(e => { e.state.settings.guideDismissed = true; if (e.pulseDrop?.practice) delete e.pulseDrop; });
    if (!saveBlocked) { const result = saveLocal(activeSlot.current.id, engineRef.current.state); if (!result.ok) setMessage(result.message); }
  }
  function skipSpotlight() {
    engineRef.current.skipOpening();
    dismissGuide();
  }
  const canResumeGuide = s.settings.handsOnGuide && !s.settings.guideDismissed;
  function replayTutorial() {
    if (canResumeGuide) goToTab('lab');
    else if (!changeSave('create')) setDialog({ kind: 'settings' });
  }
  const lessonTitles = ['从第一份样本开始', '发现第二种元素', '让样本自动补充', '建造第二代仪器', '开启批量生产', '点亮第一格档案'];
  const showCoach = !s.settings.handsOnGuide && !s.firstRun && !s.settings.guideDismissed && lesson < lessonTitles.length;
  const coach = () => <Onboarding step={lesson} total={lessonTitles.length}
    title={lesson >= lessonTitles.length ? '你已掌握实验室的基本操作' : lessonTitles[lesson]}
    detail={lesson >= lessonTitles.length ? '接下来可以继续探索和收录新元素。' : goal.detail}
    actionLabel={lesson >= lessonTitles.length ? '完成引导' : goal.label}
    canAct={lesson >= lessonTitles.length || goal.enabled}
    onAction={lesson >= lessonTitles.length ? dismissGuide : () => act(goal.run)}
    onDismiss={dismissGuide} onGuide={() => goToTab('guide')}/>;
  const openingMilestones = [
    { name: '发现 He', done: max >= 2 },
    { name: '新容器', done: s.reactors[1].built },
    { name: '自动反应', done: s.modules.reaction },
    { name: '点亮一格', done: archived > 0 },
  ];
  function upgradeCard(key: Upgrade) {
    const u = UPGRADES[key];
    const levels = bulk === 'max' ? maxAffordable(r, key, s.coins) : bulk;
    const cost = price(r, key, levels);
    const affordable = levels > 0 && s.coins.gte(cost);
    const running = { ...r, active: true };
    const clone = { ...running, upgrades: { ...r.upgrades, [key]: r.upgrades[key] + levels } };
    const cappedSpeed = key === 'speed' && eventRate(running).gte(capacity(running));
    const effect = key === 'atoms' ? `样本 +${levels} · 氢库存 +${levels}` : key === 'yield' ? `每次 ${fmt(coinPerEvent(running).mul(energyMultiplier))} → ${fmt(coinPerEvent(clone).mul(energyMultiplier))} 碰撞能` : key === 'capacity' ? `上限 ${fmt(capacity(running))} → ${fmt(capacity(clone))} 次/秒` : `${fmt(eventRate(running))} → ${fmt(eventRate(clone))} 次/秒`;
    const Icon = key === 'atoms' ? Atom : key === 'speed' ? Gauge : key === 'yield' ? Zap : Layers3;
    return <div className="upgrade" key={key}>
      <div className="upgrade-icon"><Icon size={20}/></div>
      <div className="upgrade-copy">
        <div className="upgrade-title">{u.name}<small>等级 {r.upgrades[key]}</small></div>
        <p className="upgrade-effect">{effect}</p>
      </div>
      <button className="buy-button" data-opening-target={focus === 1 && key === 'atoms' ? 'sample' : undefined} disabled={cappedSpeed || !affordable} onClick={() => act(e => { e.buy(focus, key, levels); })} aria-label={`购买${u.name}`}>
        <span><Plus size={12}/>{bulk === 'max' ? `MAX ${levels}` : `×${levels}`}</span>
        <strong>{cappedSpeed ? '满负荷' : levels === 0 ? '余额不足' : fmt(cost)}</strong>
        {!cappedSpeed && levels > 0 && <small>{affordable ? '碰撞能' : '碰撞能不足'}</small>}
      </button>
    </div>;
  }
  function showImpact(kind: ImpactKind, bearing?: number) {
    const at = Date.now();
    setImpact(previous => ({ serial: (previous?.serial ?? 0) + 1, kind, at, reactor: focus, bearing }));
    playCollision(kind);
  }

  function beginTrial(z: TechniqueElement) {
    if (!canTryTechnique(s, z)) return;
    const available = s.reactors.find(reactor => engine.canManualPulse(reactor.id));
    if (!engine.canManualPulse(focus) && available) setFocus(available.id);
    setTrial({ z, taps: 0, complete: false });
    setDialog(null);
    goToTab('lab');
  }

  function collide(bearing: number) {
    const practicing = trial && !trial.complete ? trial : undefined;
    const taps = practicing ? Math.min(practicing.taps + 1, practicing.z === 2 ? ECHO_HITS : TRIAL_LITHIUM_CHARGE) : 0;
    const reward = act(e => {
      const pulse = e.manualPulse(focus);
      if (!pulse) return;
      const triedEcho = practicing?.z === 2 && taps === ECHO_HITS && e.completeTechniqueTrial(2, focus);
      return { ...pulse, triedEcho };
    });
    if (!reward) return null;
    if (practicing) setTrial({ ...practicing, taps, complete: !!reward.triedEcho });
    const echo = reward.echo || reward.triedEcho;
    const charged = reward.charged || (practicing?.z === 3 && taps === TRIAL_LITHIUM_CHARGE && taps !== practicing.taps);
    showImpact(echo ? 'echo' : reward.stationBoosted ? 'release' : charged || reward.stationCharged ? 'charged' : 'pulse', bearing);
    return {
      energy: fmt(reward.energy),
      data: fmt(reward.triedEcho ? reward.data.plus(TRIAL_ECHO_DATA) : reward.data),
      technique: echo ? '氦回波' : reward.stationBoosted ? '供能站增压' : charged ? '锂蓄能就绪' :
        reward.stationCharged ? '供能站蓄满' : undefined,
    };
  }

  const canRelease = trial ? trial.z === 3 && !trial.complete && trial.taps === TRIAL_LITHIUM_CHARGE && engine.canManualPulse(focus)
    : engine.canReleaseLithium(focus);
  function discharge() {
    if (!canRelease) return;
    if (trial) {
      if (!act(e => e.completeTechniqueTrial(3, focus))) return;
      setTrial({ ...trial, complete: true });
      showImpact('release');
      return;
    }
    if (act(e => {
      const reward = e.releaseLithium(focus);
      if (reward) e.notify('info', `锂蓄能 · +${reward.count} 份${element(reward.target).name}`, reward.target);
      return reward;
    })) showImpact('release');
  }

  const collisionControl = <ManualPulse key={focus} enabled={(!!trial || queue.length === 0) && engine.canManualPulse(focus)} reducedMotion={s.settings.reducedMotion}
    tutorialTarget label={r.active ? '点击触发碰撞' : '仪器已暂停'} onPulse={collide}/>;
  const targetInfo = element(r.target);
  const nextInfo = max < XENON_ELEMENT ? element(max + 1) : undefined;
  const tracking = r.active && r.exploring && r.target === nextInfo?.z;
  const heliumTimer = r.target === 2 && s.firstRun?.step === 'helium' ? s.firstRun.remaining : 0;
  const preparation = r.target === nextInfo?.z ? s.discoveryWait : 0;
  const remainingPreparation = heliumTimer || preparation;
  const preparationLength = heliumTimer ? FIRST_HELIUM_SECONDS : discoveryPreparation(r.target);
  const observing = !targetKnown && targetStage && canExplore;
  const targetProgress = targetKnown ? 1 : remainingPreparation && preparationLength
    ? 1 - remainingPreparation / preparationLength : observed;
  const targetLabel = observing ? '首次观测进度' : remainingPreparation ? '样本准备进度' : undefined;
  const targetStatus = targetKnown ? '生产' : observing ? `${Math.floor(observed * 100)}%`
    : remainingPreparation ? `${Math.ceil(remainingPreparation)} 秒` : '探索';
  const researchAvailable = (max >= MODULES.feed.unlock && !s.modules.feed) ||
    REACTORS.some(t => max >= t.unlock && !s.reactors[t.id - 1].built);
  const drawerButton = (id: Drawer, label: string, Icon: typeof Atom) =>
    <button type="button" aria-expanded={activeDrawer === id} aria-controls="experiment-drawer" onClick={() => toggleDrawer(id)}>
      <Icon size={20} aria-hidden="true"/><span>{label}</span>
    </button>;

  const instrumentPanel = () => <>
        <div className="reactor-switch"><label htmlFor="reactor-selector">仪器</label><select id="reactor-selector" aria-label="切换反应容器" value={focus} onChange={e => setFocus(+e.target.value)}>{REACTORS.filter(t => s.reactors[t.id - 1].built).map(t => <option key={t.id} value={t.id}>{t.roman} 级 · {t.name}{!s.reactors[t.id - 1].active && ' · 已暂停'}</option>)}</select><button className="text-button" onClick={() => goToTab('research')}>研发仪器<ArrowRight size={13}/></button></div>
        <div className="target-control"><div className="target-element" style={{ '--element': element(r.target).color } as CSSProperties}><small>{r.target}</small><strong>{element(r.target).symbol}</strong></div><div className="target-copy"><span className="eyebrow">{targetKnown ? '重复生产' : '正在探索'}</span><h3>{element(r.target).name}<span>{element(r.target).english}</span></h3>{targetNote && <p>{targetNote}</p>}</div><div className="target-actions"><label className="sr-only" htmlFor="target">选择实验目标</label><select id="target" value={r.target} onChange={e => act(engine => { engine.target(focus, +e.target.value); })}>{ELEMENTS.slice(0, Math.min(XENON_ELEMENT, max + 1)).map(e => <option key={e.z} value={e.z} disabled={e.z > max && !canExplore}>{e.symbol} · {e.name}{e.z > max ? ' · 下一发现' : ''}</option>)}</select></div></div>
        {!!requirements.length && <p id="exploration-requirements" className="exploration-requirements">
          <strong>探索{element(max + 1).name}前还需</strong>
          <span>{requirements.join(' · ')}</span>
        </p>}
        <div className="chamber-footer">{!commission && !targetStage && (targetKnown || s.discoveryWait === 0) && <span>{targetKnown ? '单次成功率' : '单次发现率'} {(targetChance * 100).toPrecision(3)}%</span>}<span>{!commission && parallel > 1 ? `批量生产 ×${parallel}` : ''}</span></div>
        <div className="mix-control">
          <span><Atom size={14}/>展示元素</span>
          {focus === 1 ? ELEMENTS.slice(0, max).map(({ z, symbol }) => (
            <button key={z} className={s.settings.mix.includes(z) ? 'selected' : ''}
              aria-pressed={s.settings.mix.includes(z)} onClick={() => act(() => {
                const mix = s.settings.mix;
                if (!mix.includes(z)) s.settings.mix = [...mix, z];
                else if (mix.length > 1) s.settings.mix = mix.filter(value => value !== z);
              })}>{symbol}</button>
          )) : visualPool.map(z => <span className="element-sample-chip" key={z}>{element(z).symbol}</span>)}
        </div>
  </>;
  const upgradesPanel = () => <section className="panel upgrades-panel"><div className="bulk-control"><span title="仅影响升级购买数量，不影响探索次数、实验样本或成功率">升级数量</span><div role="group" aria-label="升级数量（仅影响升级，不影响探索次数与实验样本）">{([1, 10, 100, 'max'] as const).map(n => <button className={bulk === n ? 'selected' : ''} onClick={() => setBulk(n)} key={n}>{n === 'max' ? 'MAX' : `×${n}`}</button>)}</div></div>{(['atoms', 'speed', 'yield'] as Upgrade[]).map(upgradeCard)}{focus > 1 && upgradeCard('capacity')}<div className="reactor-output" aria-label="本机产出">
        <div><span>本机碰撞能</span><strong data-testid="reactor-energy-rate">{fmt(income(r).mul(energyMultiplier))}<small> /秒</small></strong></div>
        <div><span>本机研究数据</span><strong data-testid="reactor-data-rate">{fmt(eventRate(r).mul(dataMultiplier))}<small> 点/秒</small></strong></div>
      </div></section>;
  const tasksPanel = () => <div className="lab-operations">
    <ReactorAssignments state={s}/>
    <ExperimentBoard key={`experiments-${slotId}`} state={s} act={act} openElement={openElement}/>
    {max >= 8 && <SampleContract key={slotId} state={s} act={act}/>}
  </div>;
  const nextPanel = () => (
    <div className="lab-guidance">
      {showCoach ? coach() : <section className="mission-card" aria-label="下一步">
        <div>
          <div className="eyebrow"><span className="tiny-orbit" aria-hidden="true"/>下一步</div>
          {openingMilestones.some(item => !item.done) && <div className="opening-milestones" role="list" aria-label="开局检查清单">
            {openingMilestones.map(item => <span key={item.name} role="listitem" aria-label={`${item.name}：${item.done ? '已完成' : '待完成'}`} className={item.done ? 'done' : ''}>{item.done ? <Check size={11}/> : <i/>}{item.name}</span>)}
          </div>}
          <p className="goal-detail">{goal.detail}</p>
        </div>
        <button className="secondary-button goal-action" disabled={!goal.enabled} onClick={() => act(goal.run)}>{goal.label}<ArrowRight size={15}/></button>
      </section>}
    </div>
  );
  const drawerContent = () => {
    switch (activeDrawer) {
      case 'upgrades': return upgradesPanel();
      case 'tasks': return tasksPanel();
      case 'archive': return periodic();
      case 'instrument': return instrumentPanel();
      case 'next': return nextPanel();
      case 'projects': return <ResearchProjects state={s} initialProject={campusProject} onInvest={(id, stage, limit) =>
        act(e => e.fundProject(id, stage, limit))} onAccelerator={() => goToTab('accelerator')} onOperate={id => goToTab('projects', id)}/>;
      case 'more': return <div className="scene-more">{tabs.slice(2).map(t => <button type="button" key={t.id} onClick={() => goToTab(t.id)}><t.icon size={19}/>{t.name}<ArrowRight size={15}/></button>)}</div>;
    }
  };

  const sceneHud = () => <div className="scene-hud">
      {brand()}
      <section className="scene-resources" aria-label="实验室资源">
        <div className="scene-stat scene-energy" title={`碰撞能，+ ${fmt(totalIncome)} /秒`}><Zap size={19} aria-hidden="true"/><span className="sr-only">碰撞能</span><strong data-testid="coins">{fmt(s.coins)}</strong></div>
        <div className="scene-stat scene-data" title="研究数据"><Database size={16} aria-hidden="true"/><span className="sr-only">研究数据</span><strong>{fmt(s.data)}</strong></div>
        <div className="scene-stat scene-speed" title="总实验速度"><Activity size={17} aria-hidden="true"/><span className="sr-only">总实验速度</span><strong>{fmt(totalRate)}</strong><small>/秒</small></div>
      </section>
      <button type="button" className="scene-icon-button" aria-label="存档与设置" title={saveStatus} onClick={openSaves}><Settings2 size={20}/></button>
    </div>;

  const station = pulseStationLimits(s);
  const stationActive = s.projectOperations.pulseHits > 0;
  const stationReady = station.charge > 0 && s.projectOperations.pulseCharge === station.charge;
  const lab = () => <section className="lab-scene" aria-label="实验室" data-guiding={!!spotlight}>
    <ReactorScene key={focus} id={focus} impact={impact} reduced={s.settings.reducedMotion}>
      <Particles count={Math.min(60, activeAtoms(r).toNumber())} mix={visualPool}
        speed={r.upgrades.speed} reduced={s.settings.reducedMotion} active={r.active} flash={flash}/>
    </ReactorScene>
    <div className="device lab-playfield" inert={!!activeDrawer}>{collisionControl}</div>
    {sceneHud()}
    <div className="scene-notices" inert={!!activeDrawer}>{notices()}</div>
    <div className="scene-instrument" inert={!!activeDrawer}>
      <button type="button" className="scene-device-select" aria-label="仪器设置" aria-expanded={activeDrawer === 'instrument'} aria-controls="experiment-drawer" onClick={() => toggleDrawer('instrument')}>
        <span className="scene-tier">{c.roman}</span><span>{c.name}</span><ChevronDown size={14}/>
      </button>
      <button type="button" className={`status-pill ${r.active ? '' : 'paused'}`} data-opening-target={focus === 1 ? 'start' : undefined} data-guide-target="reactor-status"
        aria-label={r.active ? '运行中' : opening === 'start' ? '开始实验' : '已暂停'} title={r.active ? '暂停仪器' : '启动仪器'} onClick={() => act(e => e.toggleReactor(focus))}>
        {r.active ? <CirclePause size={20}/> : <CirclePlay size={20}/>}
        {opening === 'start' ? <span>开始实验</span> : <span className="sr-only">{r.active ? '运行中' : '已暂停'}</span>}
      </button>
      <div className="scene-local" title="本机实验速度"><Gauge size={15}/><span data-testid="current-rate">{fmt(eventRate(r))}<small> 次/秒</small></span></div>
    </div>
    <aside className="scene-tools" inert={!!activeDrawer}>
      <div className="progress-resource scene-collection">
        <button type="button" aria-label="打开元素收集" title={`已收录 ${archived} / ${PLAYABLE_ELEMENTS}`} aria-expanded={activeDrawer === 'archive'} aria-controls="experiment-drawer" onClick={() => toggleDrawer('archive')}>
          <HudRing label="元素收集进度" value={archived} max={PLAYABLE_ELEMENTS}><Archive size={20}/></HudRing>
          <strong>{archived}/{PLAYABLE_ELEMENTS}<span className="sr-only"> 收录 · {max}/{PLAYABLE_ELEMENTS} 发现</span></strong>
        </button>
      </div>
      {engineeringOpen && <div className="scene-collection scene-accelerator">
        <button type="button" aria-label="加速环工程" title="加速环工程" onClick={() => goToTab('accelerator')}>
          <HudRing value={s.accelerator.built} max={acceleratorSegments.length}><CircleDashed size={20}/></HudRing>
          <span className="scene-tool-label">加速环</span>
          <strong>{s.accelerator.built}/{acceleratorSegments.length}</strong>
        </button>
      </div>}
      {engineeringOpen && <div className="scene-collection scene-accelerator"><button type="button" aria-label="科研工程"
        title="科研工程" aria-expanded={activeDrawer === 'projects'} aria-controls="experiment-drawer"
        onClick={() => toggleDrawer('projects')}><Layers3 size={20}/><span className="scene-tool-label">工程</span></button></div>}
      {!opening && station.charge > 0 && <div className="scene-collection scene-accelerator scene-station">
        <button type="button" aria-label={stationReady ? '释放供能站增压' : '查看供能站'}
          data-active={stationActive || stationReady} onClick={() => stationReady ? act(e => e.releaseStationPulse()) : goToTab('projects', 'pulse')}>
          <HudRing value={stationActive ? s.projectOperations.pulseHits : s.projectOperations.pulseCharge} max={stationActive ? station.hits : station.charge}>
            <Zap size={18}/>
          </HudRing>
          <span className="scene-tool-label">{stationActive ? `余 ${s.projectOperations.pulseHits} 次` : stationReady ? '增压就绪' : `${s.projectOperations.pulseCharge}/${station.charge}`}</span>
        </button>
      </div>}
      <button type="button" className="scene-icon-button" aria-label="下一步" title="下一步" aria-expanded={activeDrawer === 'next'} aria-controls="experiment-drawer" onClick={() => toggleDrawer('next')}><Compass size={22}/></button>
    </aside>
    {!spotlight && <div inert={!!activeDrawer}>
      <ElementPulseControls trial={trial} echo={s.elements[1].archived ? s.pulseTech.echoHits : undefined}
        lithium={s.elements[2].archived ? s.pulseTech.lithium : undefined} canRelease={canRelease}
        releaseHint={!targetKnown ? '切换至已发现的实验目标即可释放。' : !r.active ? '启动容器后即可释放。' : techniques[3].description}
        onRelease={discharge} onChooseTarget={!targetKnown && s.pulseTech.lithium === LITHIUM_CHARGE ? () => toggleDrawer('instrument') : undefined}
        onCloseTrial={() => setTrial(undefined)}/>
    </div>}
    <div className="scene-actions" inert={!!activeDrawer}>
      {handsOn && (handsOn.id === 'pickup' || handsOn.id === 'pulse') && <button type="button" className="scene-action" data-guide-target="release-drop"
        disabled={practiceDrop || !!boost} onClick={() => act(e => e.showPracticeDrop())}>放出练习灵感点</button>}
      {handsOn?.id === 'archive' && <button type="button" className="scene-action" data-guide-target="produce-h" onClick={() => act(e => {
        if (e.target(1, 1)) e.state.reactors[0].active = true;
        setFocus(1);
      })}>让 I 级生产氢</button>}
      <button type="button" className="scene-target" aria-label={`实验目标 ${targetInfo.name}`} aria-expanded={activeDrawer === 'instrument'} aria-controls="experiment-drawer" onClick={() => toggleDrawer('instrument')} title={targetNote ?? requirements.join(' · ')}>
        <HudRing label={targetLabel} value={targetProgress} max={1}><strong>{targetInfo.symbol}</strong></HudRing>
        <span><strong>{targetInfo.name}</strong><small>{!targetKnown && !remainingPreparation && isTechniqueElement(r.target) ? techniques[r.target].hint : targetStatus}</small></span>
      </button>
      {nextInfo && !tracking && <button type="button" className="scene-action scene-explore" disabled={!canExplore} data-guide-target="explore" onClick={() => act(e => { e.target(focus, nextInfo.z, true); })}
        title={!canExplore ? requirements.join(' · ') : undefined}>
        {canExplore ? <ArrowRight size={16}/> : <LockKeyhole size={15}/>}探索 {nextInfo.symbol}
        {isTechniqueElement(nextInfo.z) && <small aria-hidden="true">· {techniques[nextInfo.z].hint}</small>}
      </button>}
    </div>
    {activeDrawer && <div className="scene-shade" aria-hidden="true" onClick={closeDrawer}/>}
    <nav className="scene-dock" aria-label="主导航">
      {drawerButton('upgrades', '升级', SlidersHorizontal)}
      <button type="button" data-guide-target="research" onClick={() => goToTab('research')}><Cpu size={20}/><span>科研</span>{researchAvailable && <i aria-hidden="true"/>}</button>
      {drawerButton('tasks', '委托', ClipboardList)}
      {drawerButton('archive', '周期表', Grid2X2)}
      {drawerButton('more', '更多', Ellipsis)}
    </nav>
    {activeDrawer && <LabDrawer key={activeDrawer} title={drawerTitles[activeDrawer]} onClose={closeDrawer}>{drawerContent()}</LabDrawer>}
  </section>;

  const abilitySummary = () => {
    if (archived === 0) return null;
    const bonuses = abilityBonuses(s);
    return <section className="ability-summary" aria-label="实验室能力增益">
      <div><h2>元素能力</h2><small>已生效 {archived} 项</small></div>
      <dl><div><dt>碰撞能</dt><dd>+{bonuses.energy}%</dd></div><div><dt>研究数据</dt><dd>+{bonuses.data}%</dd></div><div><dt>元素产出</dt><dd>+{bonuses.production}%</dd></div></dl>
    </section>;
  };
  const periodic = () => (
    <section className="lab-archive" id="periodic-table" aria-labelledby="periodic-table-title">
      <header className="archive-heading">
        <h2 id="periodic-table-title">元素周期表</h2>
      </header>
      {abilitySummary()}
      <div className="archive-toolbar">
        <div className="table-key" aria-label="周期表图例">
          <span><i className="key-locked"/>待发现</span>
          <span><i className="key-discovered"/>已发现</span>
          <span><i className="key-archived"/>已收录</span>
          <span><LockKeyhole size={10}/>版本锁定</span>
        </div>
        <button className="text-button" onClick={() => {
          const scroller = tableScroll.current;
          const cell = scroller?.querySelector<HTMLButtonElement>(`[data-z="${max}"]`);
          if (scroller && cell) {
            const offset = cell.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
            scroller.scrollLeft += offset - (scroller.clientWidth - cell.offsetWidth) / 2;
          }
          openElement(max);
        }}>定位最新发现 · {element(max).symbol}<ArrowRight size={14}/></button>
      </div>
      <div className="panel table-panel">
        <p className="table-caption">点击元素查看收录目标和能力<span>横向滑动查看完整周期表</span></p>
        <div className="table-scroll" ref={tableScroll} tabIndex={0} role="region" aria-label="118 格元素周期表">
          <div className="periodic-table">
            {[6, 7].map(row => <div className="f-placeholder" key={row} style={{ gridColumn: 3, gridRow: row }}>
              <small>{row === 6 ? '57–71' : '89–103'}</small><span>{row === 6 ? '镧系' : '锕系'}</span>
            </div>)}
            {ELEMENTS.map(info => {
              const state = s.elements[info.z - 1];
              const locked = info.z > PLAYABLE_ELEMENTS;
              const status = state?.archived ? 'archived' : state?.discovered ? 'discovered' : locked ? 'version-locked' : info.z === max + 1 ? 'next' : 'locked';
              const label = { archived: '已收录', discovered: '已发现', 'version-locked': '版本锁定', next: '下一发现', locked: '待发现' }[status];
              return <button className={`periodic-cell ${status}`} key={info.z} data-z={info.z} data-guide-target={info.z === 1 ? "archive" : undefined}
                style={{ gridColumn: info.col, gridRow: info.row, '--element': info.color } as CSSProperties}
                onClick={() => openElement(info.z)} aria-label={`${info.z}号 ${info.name} ${info.symbol} ${label}${state?.discovered && !state.archived ? `，已提交 ${state.deposited}/${archiveUnits(info.z)}` : ''}`}>
                <span>{info.z}{state?.archived ? <Check size={10}/> : locked ? <LockKeyhole size={9}/> : null}</span>
                <strong>{info.symbol}</strong>
                <small>{info.name}</small>
                {!locked && <i>{status === 'discovered' ? `${state.deposited}/${archiveUnits(info.z)}` : label}</i>}
              </button>;
            })}
          </div>
        </div>
      </div>
    </section>
  );

  const research = () => <><div className="section-heading"><div><h1>科研</h1>{engineeringOpen && <><button type="button" className="secondary-button" onClick={() => { goToTab('lab'); setDrawer('projects'); }}><Layers3 size={16}/>打开科研工程</button><button type="button" className="secondary-button" onClick={() => goToTab('accelerator')}><CircleDashed size={16}/>加速环工程 · {s.accelerator.built}/{acceleratorSegments.length}</button></>}</div><div className="research-budget"><span>可用研究数据</span><strong>{fmt(s.data)}<small> 点</small></strong></div></div><div className="research-grid">{REACTORS.map(t => { const state = s.reactors[t.id - 1], unlocked = max >= t.unlock, afford = s.coins.gte(t.buildCoins) && s.data.gte(t.buildData); return <section id={`research-reactor-${t.id}`} className={`panel research-device ${!unlocked ? 'is-locked' : ''}`} key={t.id}><div className="research-device-art research-series"><img src={artworkUrl(reactorScene(t.id).file)} alt="" loading="lazy" decoding="async"/></div><div className="research-device-copy"><div className="eyebrow">{t.roman} 级 / {t.range}</div><h2>{t.name}</h2><div className="spec-line"><span>速度上限</span><strong>{t.cap} 次/秒</strong></div><div className="spec-line"><span>开放条件</span><strong>{t.id === 1 ? '开局可用' : `首次发现 ${element(t.unlock).name}`}</strong></div>{state.built ? <button className="secondary-button full" onClick={() => { setFocus(t.id); goToTab('lab'); }}><Check size={15}/>已建成 · 进入控制台<ArrowRight size={15}/></button> : <><div className="construction-cost"><span className={s.coins.gte(t.buildCoins) ? '' : 'insufficient'}>{fmt(t.buildCoins)} 碰撞能</span><span className={s.data.gte(t.buildData) ? '' : 'insufficient'}>{fmt(t.buildData)} 数据</span></div><button className="primary-button full" data-guide-target={t.id === 2 ? "build" : undefined} disabled={!unlocked || !afford} onClick={() => act(e => { if (e.build(t.id)) { setFocus(t.id); goToTab('lab'); } })}>{!unlocked ? <><LockKeyhole size={15}/>发现 {element(t.unlock).symbol} 后开放</> : <>研发并建造<ArrowRight size={15}/></>}</button>{unlocked && !afford && <p className="cost-shortfall">还差 {shortfall(t.buildCoins, t.buildData)}</p>}</>}</div></section>; })}</div><section id="industry-panel" className="panel industry-panel"><div className="panel-heading"><div><span className="eyebrow">INDUSTRIAL PIPELINE</span><h2>工业自动化</h2></div><span className="tiny-label">{Object.values(s.modules).filter(Boolean).length} / 3 模块</span></div><IndustryModules state={s} max={max} act={act}/><AutomationControls state={s} max={max} act={act}/></section></>;

  const achievements = () => <><div className="section-heading"><div><div className="eyebrow">MILESTONES & IMPOSSIBILITIES</div><h1>记录突破，<span>也记录那些意外。</span></h1></div><span className="count-badge">{s.achievements.length}<small> / {ACHIEVEMENTS.length}</small></span></div><div className="achievement-grid">{ACHIEVEMENTS.map(a => { const earned = s.achievements.includes(a.id), hidden = a.hidden && !earned; return <section className={`panel achievement ${earned ? 'earned' : ''} ${hidden ? 'secret' : ''}`} key={a.id}><div className="achievement-medal">{hidden ? <LockKeyhole size={23}/> : a.hidden ? <Sparkles size={25}/> : <Trophy size={25}/>}</div><div><span className="eyebrow">{a.hidden ? 'HIDDEN DISCOVERY' : 'LAB MILESTONE'}{earned ? ' / 已达成' : ''}</span><h3>{hidden ? '？？？' : a.name}</h3><p>{hidden ? '在实验室的边界之外，还有意想不到的可能。' : a.description}</p></div>{earned && <Check className="earned-check" size={18}/>}</section>; })}</div><p className="page-note">隐藏成就只记录在线的成功合成；已发现元素的重复生产也可达成。徽章不会改变生产倍率。</p></>;

  const stats = () => <><div className="section-heading"><div><div className="eyebrow">LABORATORY OBSERVATORY</div><h1>每一个数字，<span>都来自你的实验。</span></h1></div><button className="secondary-button" onClick={exportSave}><Download size={16}/>导出实验存档</button></div><div className="stats-grid">{[{ label: '累计实验次数', value: fmt(s.stats.events), unit: '次实验', icon: Activity }, { label: '历史碰撞能总收益', value: fmt(s.stats.earned), unit: '碰撞能', icon: Zap }, { label: '累计获得元素', value: fmt(s.stats.produced), unit: '元素单位', icon: Atom }, { label: '历史余额峰值', value: fmt(s.stats.peak), unit: '碰撞能', icon: Gauge }, { label: '实验室运行时间', value: clock(s.elapsed), unit: '含已结算的离线时间', icon: RotateCcw }, { label: `v${GAME_VERSION} 收录进度`, value: `${archived} / ${PLAYABLE_ELEMENTS}`, unit: `发现 ${max}/${PLAYABLE_ELEMENTS} · 长期发现 ${max}/118`, icon: BookOpen }].map(item => <div className="panel stat-card" key={item.label}><item.icon size={18}/><span>{item.label}</span><strong>{item.value}</strong><small>{item.unit}</small></div>)}</div><section className="panel log-panel"><div className="panel-heading"><div><span className="eyebrow">MILESTONE LOG</span><h2>实验里程碑</h2></div><span className="tiny-label">SEED {s.seed}</span></div><div className="milestone-log"><div><time>00:00:00</time><i/><span>实验室启动 · 两颗氢原子</span></div>{Object.entries(s.stats.milestones).sort((a, b) => a[1] - b[1]).map(([key, time]) => <div key={key}><time>{clock(time)}</time><i/><span>{key.startsWith('element') ? `首次发现 ${element(+key.replace('element', '')).name}` : key.startsWith('reactor') ? `${REACTORS[+key.replace('reactor', '') - 1].name}投入运行` : key === 'firstUpgrade' ? '首次升级' : key === 'firstArchive' ? '第一种元素正式收录' : key === 'neonArchive' ? '收录氖 · 第一阶段' : key === 'complete' ? '收录钙 · 第二十号里程碑' : key === 'xeArchive' ? '收录氙 · 第五十四号里程碑' : key === 'stage54' ? 'H–Xe 全部五十四格收录完成' : key.startsWith('module_') ? `${MODULES[key.replace('module_', '') as Module].name}模块上线` : '阶段记录'}</span></div>)}</div><p className="last-event">最近事件：{s.stats.lastEvent}</p></section>{import.meta.env.DEV && <section className="debug-section"><button className="text-button" onClick={() => setDebug(!debug)}><Gauge size={15}/>开发仪表 {debug ? '收起' : '展开'}</button>{debug && <pre>{JSON.stringify({ time: s.elapsed, eventsPerSecond: totalRate.toString(), coinsPerSecond: totalIncome.toString(), discovered: max, archived, lastEvent: s.stats.lastEvent, reactors: s.reactors.map(r => ({ id: r.id, built: r.built, target: r.target, probability: probability(r.target, r.id), rate: eventRate(r).toString() })) }, null, 2)}</pre>}</section>}</>;

  function elementDialog(z: number, discovery = false) {
    const info = element(z), state = s.elements[z - 1], known = !!state?.discovered, knowledge = KNOWLEDGE[z];
    const trialOffer = isTechniqueElement(z) && canTryTechnique(s, z) && <div className="guided-dialog-note">
      <p>{techniques[z].description}</p>
      <button type="button" className="secondary-button" onClick={() => beginTrial(z)}>试用{techniques[z].name}<ArrowRight size={15}/></button>
    </div>;
    const guidedArchive = !discovery && z === 1 && handsOn?.id === 'archive';
    const pendingDiscoveries = discovery && queue.length > 0 ? queue.length : 0;
    const archiveGoal = state?.archived ? state.deposited : archiveUnits(z);
    const splitCalibration = archiveGoal > ARCHIVE_UNITS && isCalibrationSpecimen(z);
    const calibrating = known && splitCalibration && !state.archived && state.deposited < ARCHIVE_UNITS;
    const stepGoal = calibrating ? ARCHIVE_UNITS : archiveGoal;
    const remaining = known ? stepGoal - state.deposited : 0;
    const filing = known ? (state.inventory.gte(remaining) ? remaining : state.inventory.toNumber()) : 0;
    const inventory = known && knowledge ? <div className="inventory-block" role="region" aria-label="元素收录操作">
      <div><span>可提交库存</span><strong>{fmt(state.inventory)}<small> 单位</small></strong></div>
      <div><span>档案累计提交</span><strong>{state.deposited}<small> / {archiveGoal}</small></strong></div>
      <div className="progress"><i style={{ width: `${state.deposited / archiveGoal * 100}%` }}/></div>
      {splitCalibration && <div><span>探索校准</span><strong>{calibrating ? `${state.deposited} / ${ARCHIVE_UNITS}` : '已完成'}</strong></div>}
      <button className="primary-button full" data-guide-dialog-action={guidedArchive ? '' : undefined}
        disabled={state.archived || state.inventory.lt(1)} onClick={() => act(e => {
          const submitted = e.deposit(z, false, calibrating ? 'calibration' : 'archive');
          if (submitted > 0 && !saveBlocked) {
            const result = saveLocal(activeSlot.current.id, e.state);
            if (!result.ok) setMessage(result.message);
          }
          if (guidedArchive && state.archived) setDialog(null);
        })}>
        {state.archived ? <><Check size={16}/>周期表已永久点亮</> : <><ArrowDownToLine size={16}/>提交 {filing} 单位至{calibrating ? '校准' : '档案'}</>}
      </button>
      <p>{state.archived ? '元素能力已生效。' :
        `${calibrating ? '校准样本计入档案。' : ''}累计提交 ${archiveGoal} 份，自动激活元素能力。`}</p>
    </div> : null;
    const specimen = known ? specimenImageStyle(z) : undefined;
    if (discovery && handsOn) return <Modal title={`新元素发现 · ${info.name}`} guided onClose={() => setDialog(null)}>
      <p className="guided-dialog-note">{z === 2
        ? '你合成了第一份氦（He）。周期表已经记录这次发现。点击「继续引导」，试试实验室的限时增益。'
        : `你发现了${info.name}（${info.symbol}）。点击「继续引导」，返回实验室。`}</p>
      {trialOffer}
      <button className="primary-button full" data-guide-dialog-action onClick={() => setDialog(null)}>继续引导<ArrowRight size={16}/></button>
    </Modal>;
    if (guidedArchive) return <Modal title="收录氢（H）" guided onClose={() => setDialog(null)}>
      <p className="guided-dialog-note">点击高亮的提交按钮。累计提交 {ARCHIVE_UNITS} 份氢，就会点亮周期表里的 H，并自动激活它的能力。</p>
      {inventory}
    </Modal>;
    return <Modal title={discovery ? `新元素发现 · ${info.name}` : `${info.name} · ${info.english}`} onClose={() => setDialog(null)}><div className="element-card-hero"><div className={`large-element ${state?.archived ? 'archived' : ''}`} style={{ '--element': info.color } as CSSProperties}><span>{z}</span><strong>{info.symbol}</strong><small>{info.english}</small><i>{info.mass || '—'}</i></div>{specimen ? <div className="specimen" role="img" style={specimen} aria-label={info.specimenDescription}/> : known && z > XENON_ELEMENT ? <AtomicSpecimen info={info}/> : <div className="locked-specimen"><LockKeyhole size={32}/><p>{z > PLAYABLE_ELEMENTS ? '未来研究目标' : '等待首次发现'}</p></div>}</div><div className="knowledge-status"><span className={state?.archived ? 'accent' : ''}>{state?.archived ? '✓ 已正式收录' : known ? '已发现 · 尚未收录' : z > PLAYABLE_ELEMENTS ? `v${GAME_VERSION} 版本锁定` : '未发现'}</span><span>第 {z} 号元素</span></div>{discovery && pendingDiscoveries === 0 && <div className="discovery-queue"><span>查看档案期间，已知元素和资源继续产出。</span><button className="secondary-button" onClick={() => setDialog(null)}>知道了，继续探索</button></div>}{trialOffer}{inventory}{pendingDiscoveries > 0 && <div className="discovery-queue" role="status"><span>还有 {pendingDiscoveries} 项新发现待查看</span><button className="secondary-button" onClick={() => setDialog(null)}>查看下一个发现</button></div>}{known && <ElementAbility z={z} archived={state.archived}/>}<AtomicFacts info={info} known={known}/>{known && knowledge ? <><div className="knowledge-body"><h3>{knowledge.title}</h3><p>{knowledge.fact}</p><h4>电子与性质</h4><p>{ATOMIC_PROFILES[z]?.chemistry}</p><h4>主要用途</h4><p>{knowledge.application}</p><FurtherScience info={info}/><h4>实验进展</h4><p>{knowledge.unlock}</p></div><dl className="element-history"><div><dt>首次发现</dt><dd>{clock(state.firstDiscoveredAt || 0)} · {state.firstDiscoveredReactor ? `${REACTORS[state.firstDiscoveredReactor - 1].roman} 级` : z > XENON_ELEMENT ? '加速环探测舱' : '初始样本'}</dd></div><div><dt>累计获得</dt><dd>{fmt(state.totalProduced)} 单位</dd></div></dl><p className="specimen-caption">{info.specimenDescription}{z === 10 && '（图为放电发光示意，常温常压下氖气无色。）'}{z >= 21 && z <= XENON_ELEMENT && '（图为样本外观示意。）'}</p><p className="science-note">{SCIENCE_NOTE} <a href={baikeUrl(info.name)} target="_blank" rel="noreferrer">百度百科 ↗</a></p></> : <div className="locked-copy"><p>{z > PLAYABLE_ELEMENTS ? z === 118 ? '鿫是《通往118》的长期终点。未来版本中，“100 个 Og”将代表 100 次成功合成且确认的事件记录，并非长期储存的普通气体。' : `它属于未来的旅程。v${GAME_VERSION} 已开放 1—56 号元素（H–Ba）；57–118 号为后续研究目标。` : z === CAESIUM_ELEMENT ? '完成加速环全环试束后，在大厅进行铯研究。' : z === BARIUM_ELEMENT ? '收录铯后，在加速大厅用氪样本研究钡。' : `依次发现元素后，你将有机会与${info.name}相遇。当前下一个新元素是 ${element(Math.min(PLAYABLE_ELEMENTS, max + 1)).symbol}。`}</p><button className="secondary-button full" onClick={() => setDialog(null)}>返回实验室</button></div>}</Modal>;
  }

  const brand = () => <a className="brand" href="#" onClick={e => { e.preventDefault(); goToTab('lab'); }}><span className="brand-mark"><Atom size={30} strokeWidth={1.2}/></span><span><strong>通往<span>118</span></strong><small>ROAD TO 118</small></span><i>v{GAME_VERSION}</i></a>;
  const notices = () => <>{saveBlocked && <div className="message-banner recovery-warning" role="alert"><span>当前进度尚未保存。请先处理旧存档，刷新会丢失本次进度。</span><button className="secondary-button" onClick={openSaves}>处理存档</button></div>}{message && <div className="message-banner" role="status"><span>{message}</span><button className="text-button" onClick={() => setMessage('')}>关闭</button></div>}{offline && tab !== 'guide' && <div className="offline-banner"><span><RotateCcw size={18}/><strong>欢迎回来。</strong>已结算 {clock(offline.seconds)} 离线实验：+{fmt(offline.coins)} 碰撞能，+{fmt(offline.produced)} 单位已发现元素。最多结算 4 小时。</span><button className="text-button" onClick={() => setOffline(null)}>继续实验<ArrowRight size={14}/></button></div>}</>;

  const inLab = tab === 'lab' || tab === 'accelerator' || tab === 'projects';
  return <>
  <div className={`app-shell${inLab ? ' scene-shell' : ''}`} inert={intro || undefined}>
    {inLab ? <main className="scene-main">
      {tab === 'accelerator' ? <Suspense fallback={<div className="lab-scene">{sceneHud()}</div>}>
        <Accelerator key={slotId} state={s} hud={sceneHud()} notices={notices()} onExit={() => goToTab('lab')}
          onInvest={(index, limit) => act(e => e.fundAcceleratorSegment(index, limit))}
          onCommission={() => act(e => e.commissionAccelerator())}
          onResearch={target => act(e => e.startAcceleratorRun(target))}
          onLock={() => act(e => e.lockCaesiumSignal())}
          onAdjust={direction => act(e => e.adjustBariumBeam(direction)) === 'focused'}
          onRead={target => act(e => e.claimAcceleratorRun(target))}
          onArchive={openElement}/>
      </Suspense> : tab === 'projects' ? <Suspense fallback={<div className="lab-scene">{sceneHud()}</div>}>
        <ProjectCampus key={slotId} state={s} id={campusProject} hud={sceneHud()} notices={notices()}
          onChange={id => goToTab('projects', id)} onExit={() => goToTab('lab')}
          onConstruction={() => { goToTab('lab'); setDrawer('projects'); }}
          onStart={z => act(e => e.startSpectrumScan(z))} onClaim={() => act(e => e.claimSpectrumScan())}
          onAssign={z => act(e => e.setSeparationTarget(z))}
          onRelease={() => { if (act(e => e.releaseStationPulse())) goToTab('lab'); }}/>
      </Suspense> : lab()}
    </main> : <><header className="site-header">{brand()}<nav className="main-nav" aria-label="主导航">{tabs.map(t => <button key={t.id} data-guide-target={t.id} className={tab === t.id ? 'active' : ''} onClick={() => goToTab(t.id)}><t.icon size={17}/><span>{t.name}</span><small>{t.en}</small>{t.id === 'research' && ((max >= MODULES.feed.unlock && !s.modules.feed) || REACTORS.some(t => max >= t.unlock && !s.reactors[t.id - 1].built)) && <i className="nav-dot"/>}</button>)}</nav><div className="header-right"><span className="save-label"><ShieldCheck size={14}/>{saveStatus}</span><button className="icon-button" aria-label="存档与设置" onClick={openSaves}><Settings2 size={19}/></button></div></header><main>{tab !== 'guide' && <section className="resource-bar" aria-label="实验室资源"><div className="main-resource"><span className="resource-label"><Zap size={14}/>碰撞能</span><div className="coin-value" data-testid="coins">{fmt(s.coins)}</div><p className="resource-income">收入 <strong>+{fmt(totalIncome)}</strong><small> /秒</small></p></div><div className="resource-item"><span>总实验速度</span><strong>{fmt(totalRate)}<small>次/秒</small></strong></div><div className="resource-item"><span>研究数据</span><strong>{fmt(s.data)}<small>点</small></strong></div><div className="resource-item progress-resource"><span>收集进度</span><strong>{archived}<small>/{PLAYABLE_ELEMENTS} 收录</small><em>{max}/{PLAYABLE_ELEMENTS} 发现</em></strong><progress className="collection-progress" aria-label="元素收集进度" max={PLAYABLE_ELEMENTS} value={archived}/></div></section>}{notices()}<div className="tab-content" key={tab}>{tab === 'research' ? research() : tab === 'achievements' ? achievements() : tab === 'guide' ? <><div className="guide-replay"><button className="secondary-button" onClick={replayTutorial}><RotateCcw size={15}/>{canResumeGuide ? '继续新手引导' : '新建存档体验引导'}</button></div><Suspense fallback={<p role="status">正在打开教程…</p>}><Tutorial onPlay={() => goToTab('lab')}/></Suspense></> : stats()}</div><footer><span><Atom size={15}/>ROAD TO 118<span className="footer-divider"/>从两颗氢原子开始的旅程</span><button className="text-button" onClick={() => goToTab('guide')}>教程<ArrowRight size={13}/></button></footer></main></>}
    <div className="toast-stack" aria-live="polite">{toasts.filter(t => tab !== 'guide' && Date.now() - t.time < 6500).slice(-3).map(t => <div className={`toast ${t.kind}`} key={t.id}>{t.kind === 'achievement' ? <Trophy size={17}/> : t.kind === 'archive' ? <BookOpen size={17}/> : <Sparkles size={17}/>}<span>{t.text}</span></div>)}</div><input ref={importInput} type="file" accept=".json,application/json" className="sr-only" aria-label="导入游戏存档" onChange={e => { void importSave(e.target.files?.[0]); }}/>
    {!intro && !dialog && queue.length === 0 && <OpeningSpotlight key={slotId} step={spotlight} total={SPOTLIGHT_LENGTH}
      reduced={s.settings.reducedMotion} onBegin={() => {
        if (destination === 'table') goToTab('lab');
        act(e => e.beginOpening());
      }}
      onSkip={skipSpotlight} onManageSaves={openSaves} onFinish={dismissGuide}/>}
    {dropsVisible && <PulseDrops drop={engine.pulseDrop} boost={boost} reduced={s.settings.reducedMotion}
      onCollect={id => act(e => e.collectPulseDrop(id))}/>}
    {dialog?.kind === 'element' && elementDialog(dialog.z, dialog.discovery)}
    {dialog?.kind === 'settings' && <Modal title="存档与实验室设置" onClose={() => setDialog(null)}>
      <SavedGames slots={slots} activeId={slotId} error={slotError} onCreate={() => changeSave('create')} onSwitch={id => changeSave('switch', id)} onDelete={id => changeSave('delete', id)}/>
      <div className="settings-list"><label><span><strong>碰撞音效</strong><small>播放碰撞、回波与释放电芯的声音</small></span><input type="checkbox" checked={s.settings.collisionSound} onChange={e => act(() => { s.settings.collisionSound = e.target.checked; })}/></label><label><span><strong>科学记数法</strong><small>关闭时显示中文大数单位，超过载后自动使用科学记数法</small></span><input type="checkbox" checked={s.settings.scientific} onChange={e => act(() => { s.settings.scientific = e.target.checked; })}/></label><label><span><strong>减少动态效果</strong><small>降低粒子运动，保留全部游戏功能</small></span><input type="checkbox" checked={s.settings.reducedMotion} onChange={e => act(() => { s.settings.reducedMotion = e.target.checked; })}/></label></div>{saveBlocked && rawSave !== undefined && <button className="secondary-button full" onClick={exportRawSave}><Download size={17}/>导出原始旧档</button>}<div className="save-actions"><button className="secondary-button" onClick={exportSave}><Download size={17}/>导出存档</button><button className="secondary-button" onClick={() => importInput.current?.click()}><Upload size={17}/>导入存档</button></div><button className="primary-button full" onClick={saveCurrent}>{saveBlocked ? '备份旧档并保存当前进度' : '立即保存'}</button><p className="science-note">进度保存在当前浏览器，每 12 秒自动保存。导入会替换正在使用的档位。</p></Modal>}
    {dialog?.kind === 'complete' && <Modal title="H–Xe 全收集完成。" onClose={() => setDialog(null)}><div className="completion-emblem"><span>54</span><strong>Xe</strong><small>XENON / 氙</small><i><Check size={17}/>{XENON_ELEMENT} / {XENON_ELEMENT} 已收录</i></div><p className="completion-text">从两颗氢原子，到 H–Xe 五十四格完整档案。<br/>下一站是加速大厅的铯研究。</p><div className="end-stats"><div><span>全收集时间</span><strong>{clock(s.stats.completedAt || 0)}</strong></div><div><span>氙收录时间</span><strong>{s.stats.xeCompletedAt === null ? '—' : clock(s.stats.xeCompletedAt)}</strong></div><div><span>已点亮元素</span><strong>{XENON_ELEMENT} / {XENON_ELEMENT}</strong></div></div><p className="science-note">全环试束完成后即可研究第 55 号元素铯。</p><button className="primary-button full" onClick={() => setDialog(null)}>继续我的实验室<ArrowRight size={16}/></button></Modal>}
  </div>
  {intro && <LaunchIntro reduced={s.settings.reducedMotion} onFinish={finishIntro}/>}
  </>;
}
