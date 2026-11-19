import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, Atom, BookOpen, Check, ChevronRight, CirclePause, CirclePlay, Cpu, Download, FlaskConical, Gauge, Layers3, LockKeyhole, Microscope, Plus, RotateCcw, Settings2, ShieldCheck, Sparkles, Trophy, Upload, Zap } from 'lucide-react';
import { Engine, archivedCount, discoveredMax } from './game/engine';
import { D, format } from './game/numbers';
import { reactorDisplayPool } from './game/visuals';
import { activeAtoms, capacity, coinPerEvent, eventRate, firstDiscoveryRate, income, maxAffordable, price, probability } from './game/economy';
import { ACHIEVEMENTS, CALCIUM_ELEMENT, GAME_VERSION, MODULES, PLAYABLE_ELEMENTS, REACTORS, UPGRADES, XENON_ELEMENT, productionParallel } from './game/config';
import { deserialize, loadLocal, saveLocal, serialize } from './game/save';
import type { GameState, Module, Upgrade, WorkMode } from './game/types';
import { ELEMENTS, KNOWLEDGE, SCIENCE_NOTE, baikeUrl, element } from './data/elements';
import Particles from './components/Particles';
import Modal from './components/Modal';
import Tutorial from './components/Tutorial';
import Onboarding from './components/Onboarding';
import OpeningSpotlight from './components/OpeningSpotlight';
import { recommend, applyAdvice, openingStep } from './game/advisor';
import './components/journey.css';
import { AtomicFacts, FurtherScience } from './components/AtomicProfile';
import AtomicSpecimen from './components/AtomicSpecimen';
import ElementAbility from './components/ElementAbility';
import { abilityBonuses, activateElementAbility, availableAbilities } from './game/abilityProgress';
import { ATOMIC_PROFILES } from './data/atomic';

const tabs = [ { id: 'lab', name: '实验室', en: 'LABORATORY', icon: FlaskConical }, { id: 'research', name: '科研', en: 'RESEARCH', icon: Cpu }, { id: 'achievements', name: '成就', en: 'ACHIEVEMENTS', icon: Trophy }, { id: 'stats', name: '统计', en: 'OBSERVATORY', icon: Activity }, { id: 'guide', name: '教程', en: 'HANDBOOK', icon: BookOpen } ];
const TABLE_HASH = '#periodic-table';
const clock = (seconds: number) => { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor(s / 60 % 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; };
const intervalLabel = (seconds: number) => !Number.isFinite(seconds) || seconds > 86400 * 365 ? '超过 1 年 / 次' : seconds < 60 ? `约 ${Math.max(1, Math.round(seconds))} 秒 / 次` : seconds < 3600 ? `约 ${(seconds / 60).toFixed(1)} 分钟 / 次` : `约 ${(seconds / 3600).toFixed(1)} 小时 / 次`;
type Dialog = { kind: 'element'; z: number; discovery?: boolean } | { kind: 'settings' | 'complete' } | null;
interface Toast { id: number; text: string; time: number; kind: string; }

export default function App() {
  const [boot] = useState(() => { const loaded = loadLocal(), engine = new Engine(loaded.state); if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) engine.state.settings.reducedMotion = true; const offline = loaded.error ? null : engine.offline(); return { engine, error: loaded.error, raw: loaded.raw, offline }; });
  const engineRef = useRef(boot.engine), [, rerender] = useState(0);
  const [destination, setDestination] = useState(() => location.hash.startsWith('#guide') ? 'guide' : location.hash === TABLE_HASH ? 'table' : 'lab');
  const tab = destination === 'table' ? 'lab' : destination;
  const [focus, setFocus] = useState(1), [bulk, setBulk] = useState<number | 'max'>(1);
  const [dialog, setDialog] = useState<Dialog>(null), [queue, setQueue] = useState<number[]>([]), [endPending, setEndPending] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]), [saveStatus, setSaveStatus] = useState(boot.error ? '存档需处理' : '本地存档'), [saveBlocked, setSaveBlocked] = useState(!!boot.error);
  const [message, setMessage] = useState(boot.error || ''), [flash, setFlash] = useState(0), [debug, setDebug] = useState(false);
  const [replayGuide, setReplayGuide] = useState(false);
  const [offline, setOffline] = useState(boot.offline && boot.offline.seconds > 30 ? boot.offline : null);
  const archiveSection = useRef<HTMLElement>(null), tableScroll = useRef<HTMLDivElement>(null), importInput = useRef<HTMLInputElement>(null);
  const engine = engineRef.current, s = engine.state, r = s.reactors[focus - 1], c = REACTORS[focus - 1];
  const opening = s.firstRun?.step;
  const spotlight = opening === 'welcome' || opening === 'start' || opening === 'sample' || opening === 'explore';
  const visualPool = reactorDisplayPool(s, r);
  const max = discoveredMax(s), archived = archivedCount(s), scientific = s.settings.scientific;
  const fmt = (v: Parameters<typeof format>[0]) => format(v, scientific);
  const bonuses = abilityBonuses(s);
  const energyMultiplier = D(100 + bonuses.energy).div(100);
  const totalIncome = s.reactors.reduce((sum, reactor) => sum.plus(income(reactor)), D(0)).mul(energyMultiplier);
  function activateAbilities(elements: readonly number[]) {
    act(e => {
      let changed = false;
      for (const z of elements) if (activateElementAbility(e.state, z)) changed = true;
      if (!changed || saveBlocked) return;
      const result = saveLocal(e.state);
      setSaveStatus(result.ok ? '已保存元素能力' : '存储不可用');
      if (!result.ok) setMessage(result.message);
    });
  }
  const totalRate = s.reactors.reduce((sum, reactor) => sum.plus(eventRate(reactor)), D(0));
  const targetKnown = s.elements[r.target - 1].discovered;
  const parallel = targetKnown && s.modules.reaction && s.automation.reaction ? productionParallel(focus) : 1;
  const runningReactor = r.active ? r : { ...r, active: true };
  const targetSpeed = eventRate(runningReactor);
  const productionChance = probability(r.target, focus);
  const discoveryRate = targetKnown ? D(0) : firstDiscoveryRate(runningReactor, s.reactors, targetSpeed);
  const targetRate = targetKnown ? targetSpeed.mul(productionChance * parallel * (1 + bonuses.production / 100)) : discoveryRate;
  const targetChance = targetKnown ? productionChance : -Math.expm1(-discoveryRate.div(targetSpeed).toNumber());
  const shortfall = (coins: number, data: number) => [s.coins.lt(coins) ? `${fmt(D(coins).minus(s.coins))} 碰撞能` : '', s.data.lt(data) ? `${fmt(D(data).minus(s.data))} 点数据` : ''].filter(Boolean).join('、');

  function goToTab(next: string) {
    setDestination(next);
    const hash = next === 'guide' ? '#guide' : next === 'table' ? TABLE_HASH : '';
    history.replaceState(null, '', location.pathname + location.search + hash);
    if (next !== 'table') window.scrollTo({ top: 0 });
    else if (destination === 'table') archiveSection.current?.scrollIntoView({ block: 'start' });
  }

  useEffect(() => {
    const followHash = () => {
      if (location.hash.startsWith('#guide')) setDestination('guide');
      else if (location.hash === TABLE_HASH) setDestination('table');
      else if (!location.hash) setDestination('lab');
    };
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, []);

  const openingInProgress = spotlight || opening === 'helium';
  useEffect(() => {
    if (destination === 'table' && !openingInProgress) archiveSection.current?.scrollIntoView({ block: 'start' });
  }, [destination, openingInProgress]);

  function collect() {
    const notices = engineRef.current.state.notices.splice(0);
    if (notices.length) {
      const discoveries = notices.filter(n => n.kind === 'discovery').map(n => n.z!);
      if (discoveries.length) { setQueue(old => [...old, ...discoveries]); setFlash(v => v + 1); }
      if (notices.some(n => n.kind === 'complete')) setEndPending(true);
      setToasts(old => [...old, ...notices.filter(n => n.kind !== 'discovery').map(n => ({ ...n, time: Date.now() }))].slice(-4));
    }
    rerender(v => v + 1);
  }
  function act(fn: (e: Engine) => void) {
    const e = engineRef.current;
    const priorStep = e.state.firstRun?.step;
    fn(e);
    if (priorStep !== e.state.firstRun?.step && !saveBlocked) {
      const result = saveLocal(e.state);
      if (!result.ok) setMessage(result.message);
    }
    collect();
  }
  const skipOpening = useCallback(() => {
    const e = engineRef.current;
    e.skipOpening();
    if (!saveBlocked) {
      const result = saveLocal(e.state);
      if (!result.ok) setMessage(result.message);
    }
    rerender(v => v + 1);
  }, [saveBlocked]);
  const persistent = useRef({ saveBlocked }); persistent.current = { saveBlocked };
  useEffect(() => {
    let last = Date.now(), lastSave = last;
    const tick = () => {
      const now = Date.now(), seconds = Math.max(0, (now - last) / 1000); last = now;
      if (document.hidden) return;
      engineRef.current.advance(seconds, seconds < 5); engineRef.current.state.savedAt = now; collect();
      if (now - lastSave >= 12000 && !persistent.current.saveBlocked) { const result = saveLocal(engineRef.current.state); setSaveStatus(result.ok ? '已自动保存' : '存储不可用'); if (!result.ok) setMessage(result.message); lastSave = now; }
    };
    const timer = window.setInterval(tick, 250);
    let hiddenAt: number | null = document.hidden ? last : null;
    const visibility = () => {
      const now = Date.now();
      if (document.hidden) { hiddenAt = now; engineRef.current.state.savedAt = now; if (!persistent.current.saveBlocked) saveLocal(engineRef.current.state); }
      else { if (hiddenAt !== null) { engineRef.current.state.savedAt = hiddenAt; const summary = engineRef.current.offline(now); if (summary.seconds > 3) setOffline(summary); hiddenAt = null; } last = now; collect(); }
    };
    const leaving = () => { if (!persistent.current.saveBlocked) saveLocal(engineRef.current.state); };
    document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', leaving);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', leaving); };
  }, []);
  useEffect(() => {
    if (dialog || tab === 'guide') return;
    if (queue.length) { setDialog({ kind: 'element', z: queue[0], discovery: true }); setQueue(q => q.slice(1)); }
    else if (endPending) { setDialog({ kind: 'complete' }); setEndPending(false); }
  }, [dialog, queue, endPending, tab]);

  function exportSave() {
    const blob = new Blob([serialize(engineRef.current.state)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `Road-to-118-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url); setMessage('存档已导出。请妥善保留这个文件。');
  }
  function exportRawSave() {
    if (boot.raw === undefined) return;
    const blob = new Blob([boot.raw], { type: 'text/plain;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `Road-to-118-original-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); URL.revokeObjectURL(url);
  }
  function saveCurrent() {
    if (saveBlocked && boot.raw !== undefined) {
      try { localStorage.setItem(`road-to-118.recovery.${Date.now()}`, boot.raw); }
      catch { setMessage('原始旧档备份失败，旧档仍保留。请先导出原始旧档和当前进度。'); return; }
    }
    const result = saveLocal(engineRef.current.state);
    if (result.ok) setSaveBlocked(false);
    setSaveStatus(result.ok ? '已手动保存' : '存储不可用'); setMessage(result.message);
  }
  async function importSave(file?: File) {
    if (!file) return;
    try { if (file.size > 2_000_000) throw new Error('存档文件过大。'); const imported = deserialize(await file.text()), next = new Engine(imported); if (saveBlocked && boot.raw !== undefined) localStorage.setItem(`road-to-118.recovery.${Date.now()}`, boot.raw); const summary = next.offline(); engineRef.current = next; setFocus(1); setOffline(summary.seconds > 3 ? summary : null); setDialog(null); setQueue([]); const result = saveLocal(next.state); setSaveBlocked(!result.ok); setMessage(result.ok ? '存档导入成功，继续你的实验。' : result.message); setSaveStatus(result.ok ? '已保存导入进度' : '存储不可用'); collect(); }
    catch (e) { setMessage(e instanceof Error ? e.message : '导入失败，当前进度已保留。'); }
    if (importInput.current) importInput.current.value = '';
  }
  function openElement(z: number) { setDialog({ kind: 'element', z }); }
  const advice = recommend(s), lesson = openingStep(s);
  const goal = { ...advice, run: (e: Engine) => {
    if (advice.action === 'table') goToTab('table');
    else { applyAdvice(e, advice); if (advice.reactor && e.state.reactors[advice.reactor - 1].built && ['build', 'explore', 'produce', 'upgrade'].includes(advice.action)) setFocus(advice.reactor); }
  } };
  function dismissGuide() {
    setReplayGuide(false);
    act(e => { e.state.settings.guideDismissed = true; });
    if (!saveBlocked) { const result = saveLocal(engineRef.current.state); if (!result.ok) setMessage(result.message); }
  }
  function replayTutorial() {
    if (!engineRef.current.state.firstRun) {
      act(e => { e.state.settings.guideDismissed = false; });
      setReplayGuide(true);
    }
    goToTab('lab');
  }
  const lessonTitles = ['从第一份样本开始', '发现第二种元素', '让样本自动补充', '建造第二代仪器', '开启批量生产', '点亮第一格档案'];
  const showCoach = !s.firstRun && ((!s.settings.guideDismissed && lesson < lessonTitles.length) || replayGuide);
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
  const lab = () => <>
    <OpeningSpotlight step={spotlight ? opening : undefined} onBegin={() => act(e => e.beginOpening())} onSkip={skipOpening}/>
    <div className="section-heading"><div><div className="eyebrow">LABORATORY / 实验日志 {clock(s.elapsed)}</div><h1>每一次碰撞，<span>离未知更近一步。</span></h1></div></div>
    {!spotlight && opening !== 'helium' && <div className="lab-guidance">
      {showCoach ? <Onboarding
        step={lesson}
        total={lessonTitles.length}
        title={lesson >= lessonTitles.length ? '你已掌握实验室的基本操作' : lessonTitles[lesson]}
        detail={lesson >= lessonTitles.length ? '接下来可以继续探索和收录新元素。' : goal.detail}
        actionLabel={lesson >= lessonTitles.length ? '完成引导' : goal.label}
        canAct={lesson >= lessonTitles.length || goal.enabled}
        onAction={lesson >= lessonTitles.length ? dismissGuide : () => act(goal.run)}
        onDismiss={dismissGuide}
        onGuide={() => goToTab('guide')}
      /> : <section className="mission-card" aria-label="下一步">
        <div>
          <div className="eyebrow"><span className="tiny-orbit" aria-hidden="true"/>下一步</div>
          {openingMilestones.some(item => !item.done) && <div className="opening-milestones" role="list" aria-label="开局检查清单">
            {openingMilestones.map(item => <span key={item.name} role="listitem" aria-label={`${item.name}：${item.done ? '已完成' : '待完成'}`} className={item.done ? 'done' : ''}>{item.done ? <Check size={11}/> : <i/>}{item.name}</span>)}
          </div>}
          <p className="goal-detail">{goal.detail}</p>
        </div>
        <button className="secondary-button goal-action" disabled={!goal.enabled} onClick={() => act(goal.run)}>{goal.label}<ArrowRight size={15}/></button>
      </section>}
    </div>}
    <div className="journey-stages" aria-label="阶段目标">{[{ name: '氖档案', symbol: 'Ne', done: s.elements[9].archived, progress: `已提交 ${s.elements[9].deposited}/50 份` }, { name: '钙档案 · 第20号', symbol: 'Ca', done: s.elements[CALCIUM_ELEMENT - 1].archived, progress: `已提交 ${s.elements[CALCIUM_ELEMENT - 1].deposited}/50 份` }, { name: '氙档案 · 第54号', symbol: 'Xe', done: s.elements[XENON_ELEMENT - 1].archived, progress: `已提交 ${s.elements[XENON_ELEMENT - 1].deposited}/50 份` }, { name: 'H–Xe 全收集', symbol: '54', done: s.stats.completedAt !== null, progress: `已收录 ${archived}/${PLAYABLE_ELEMENTS} 种` }].map((stage, i) => <button key={stage.name} className={`journey-stage ${stage.done ? 'done' : ''}`} onClick={() => openElement([10, CALCIUM_ELEMENT, XENON_ELEMENT, max][i])}><span className="journey-index">{stage.done ? <Check size={16}/> : `0${i + 1}`}</span><span><strong>{stage.name}</strong><small>{stage.done ? '已完成' : stage.progress}</small></span><span className="journey-symbol">{stage.symbol}</span></button>)}</div>
    <div className="lab-grid">
      <section className="panel reactor-panel"><div className="panel-heading"><div><span className="eyebrow">REACTION CHAMBER</span><h2>{c.name}<span className="tiny-label">{c.roman} 级</span></h2></div><button className={`status-pill ${r.active ? '' : 'paused'}`} data-opening-target={focus === 1 ? "start" : undefined} onClick={() => act(e => e.toggleReactor(focus))}>{r.active ? <><i/>运行中 <CirclePause size={13}/></> : <><CirclePlay size={13}/>{opening === "start" ? "开始实验" : "已暂停"}</>}</button></div>
        <div className="reactor-switch"><label htmlFor="reactor-selector">仪器</label><select id="reactor-selector" aria-label="切换反应容器" value={focus} onChange={e => setFocus(+e.target.value)}>{REACTORS.filter(t => s.reactors[t.id - 1].built).map(t => <option key={t.id} value={t.id}>{t.roman} 级 · {t.name}{!s.reactors[t.id - 1].active && ' · 已暂停'}</option>)}</select><button className="text-button" onClick={() => goToTab('research')}>研发仪器<ArrowRight size={13}/></button></div>
        <div className={`device device-${focus} ${focus > 5 ? 'device-schematic' : ''}`}><div className="device-photo" style={focus <= 5 ? { backgroundPosition: `${focus <= 3 ? (focus - 1) * 50 : (focus - 4) * 100}% center` } : undefined}/><div className="device-readout readout-left"><span>CHAMBER {c.roman}</span><strong>{fmt(activeAtoms(r))}</strong><small>样本</small></div><div className="device-readout readout-right"><span>THROUGHPUT</span><strong>{fmt(eventRate(r))}<small>次/秒</small></strong><small>实验速度</small></div><div className="viewport"><Particles count={Math.min(60, activeAtoms(r).toNumber())} mix={visualPool} speed={r.upgrades.speed} reduced={s.settings.reducedMotion} active={r.active} flash={flash}/></div><span className="visual-note">粒子示意</span><span className="device-id">R118 — {String(focus).padStart(3, '0')}</span></div>
        <div className="target-control"><div className="target-element" style={{ '--element': element(r.target).color } as CSSProperties}><small>{r.target}</small><strong>{element(r.target).symbol}</strong></div><div className="target-copy"><span className="eyebrow">{targetKnown ? '重复生产' : '正在探索'}</span><h3>{element(r.target).name}<span>{element(r.target).english}</span></h3><p>{r.active && r.target === 2 && s.firstRun?.step === "helium" ? `首次合成 · 约 ${Math.ceil(s.firstRun.remaining)} 秒` : r.active ? `平均等待${intervalLabel(1 / targetRate.toNumber()).replace(' / 次', '')} · 随机触发` : '已暂停'}</p></div><div className="target-actions"><label className="sr-only" htmlFor="target">选择实验目标</label><select id="target" value={r.target} onChange={e => act(engine => { engine.target(focus, +e.target.value); })}>{ELEMENTS.slice(0, Math.min(PLAYABLE_ELEMENTS, max + 1)).map(e => <option key={e.z} value={e.z}>{e.symbol} · {e.name}{e.z > max ? ' · 下一发现' : ''}</option>)}</select>{max < PLAYABLE_ELEMENTS && <button className="text-button accent" data-opening-target={focus === 1 && max === 1 ? "explore" : undefined} onClick={() => act(e => { e.target(focus, max + 1, true); })}>探索 {element(max + 1).symbol}<ArrowRight size={14}/></button>}</div></div>
        <div className="chamber-footer"><span>{targetKnown ? '单次成功率' : '单次发现率'} {(targetChance * 100).toPrecision(3)}%</span><span>{parallel > 1 ? `批量生产 ×${parallel}` : ''}</span></div>
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
      </section>
      <aside className="control-column"><section className="panel upgrades-panel"><div className="panel-heading"><div><span className="eyebrow">EXPERIMENT CONTROL</span><h2>实验控制</h2></div><Settings2 size={18} className="muted"/></div><div className="bulk-control"><span title="仅影响升级购买数量，不影响探索次数、实验样本或成功率">升级数量</span><div role="group" aria-label="升级数量（仅影响升级，不影响探索次数与实验样本）">{([1, 10, 100, 'max'] as const).map(n => <button className={bulk === n ? 'selected' : ''} onClick={() => setBulk(n)} key={n}>{n === 'max' ? 'MAX' : `×${n}`}</button>)}</div></div>{(['atoms', 'speed', 'yield'] as Upgrade[]).map(upgradeCard)}{focus > 1 && upgradeCard('capacity')}<div className="capacity-meter"><div className="capacity-values"><div><span>本机速度</span><strong data-testid="current-rate">{fmt(eventRate(r))}<small> 次/秒</small></strong></div><div><span>速度上限</span><strong>{fmt(capacity(r))}<small> 次/秒</small></strong></div></div><div className="progress" role="progressbar" aria-label="当前速度占上限" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(eventRate(r).div(capacity(r)).mul(100).toNumber()))}><i style={{ width: `${Math.min(100, eventRate(r).div(capacity(r)).mul(100).toNumber())}%` }}/></div>{(!r.active || eventRate(r).gte(capacity(r).mul(.99))) && <p>{r.active ? '满负荷' : '已暂停'}</p>}</div></section>
      </aside>
    </div>
    {periodic()}
  </>;

  const abilitySummary = () => {
    if (archived === 0) return null;
    const ready = availableAbilities(s);
    return <section className="ability-summary" aria-label="实验室能力增益">
      <div><h2>元素能力</h2><small>已激活 {s.activeAbilities?.length ?? 0}/{archived} 项</small></div>
      <dl><div><dt>碰撞能</dt><dd>+{bonuses.energy}%</dd></div><div><dt>研究数据</dt><dd>+{bonuses.data}%</dd></div><div><dt>元素产出</dt><dd>+{bonuses.production}%</dd></div></dl>
      {ready.length > 0 && <button className="secondary-button" onClick={() => activateAbilities(ready)}>激活已收录能力 <span>{ready.length}</span></button>}
    </section>;
  };
  const periodic = () => (
    <section className="lab-archive" id="periodic-table" ref={archiveSection} aria-labelledby="periodic-table-title">
      <header className="archive-heading">
        <h2 id="periodic-table-title">元素周期表</h2>
        <p>已收录 <strong>{archived}/{PLAYABLE_ELEMENTS}</strong> 种</p>
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
        <p className="table-caption">点击元素查看档案 · 累计提交 50 单位点亮<span>横向滑动查看完整周期表</span></p>
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
              return <button className={`periodic-cell ${status}`} key={info.z} data-z={info.z}
                style={{ gridColumn: info.col, gridRow: info.row, '--element': info.color } as CSSProperties}
                onClick={() => openElement(info.z)} aria-label={`${info.z}号 ${info.name} ${info.symbol} ${label}${state?.discovered && !state.archived ? `，已提交 ${state.deposited}/50` : ''}`}>
                <span>{info.z}{state?.archived ? <Check size={10}/> : locked ? <LockKeyhole size={9}/> : null}</span>
                <strong>{info.symbol}</strong>
                <small>{info.name}</small>
                {!locked && <i>{status === 'discovered' ? `${state.deposited}/50` : label}</i>}
              </button>;
            })}
          </div>
        </div>
      </div>
    </section>
  );

  const research = () => <><div className="section-heading"><div><div className="eyebrow">RESEARCH & INDUSTRY</div><h1>把偶然的发现，<span>变成持续的能力。</span></h1></div><div className="research-budget"><span>可用研究数据</span><strong>{fmt(s.data)}<small> 点</small></strong></div></div><div className="research-grid">{REACTORS.map(t => { const state = s.reactors[t.id - 1], unlocked = max >= t.unlock, afford = s.coins.gte(t.buildCoins) && s.data.gte(t.buildData); return <section className={`panel research-device ${!unlocked ? 'is-locked' : ''}`} key={t.id}><div className={`research-device-art ${t.id > 3 && t.id <= 5 ? 'expansion-art' : ''} ${t.id > 5 ? 'schematic-art' : ''}`} style={t.id <= 5 ? { backgroundPosition: `${t.id <= 3 ? (t.id - 1) * 50 : (t.id - 4) * 100}% center` } : undefined}/><div className="research-device-copy"><div className="eyebrow">{t.roman} 级 / {t.range}</div><h2>{t.name}</h2><div className="spec-line"><span>速度上限</span><strong>{t.cap} 次/秒</strong></div><div className="spec-line"><span>开放条件</span><strong>{t.id === 1 ? '开局可用' : `首次发现 ${element(t.unlock).name}`}</strong></div>{state.built ? <button className="secondary-button full" onClick={() => { setFocus(t.id); goToTab('lab'); }}><Check size={15}/>已建成 · 进入控制台<ArrowRight size={15}/></button> : <><div className="construction-cost"><span className={s.coins.gte(t.buildCoins) ? '' : 'insufficient'}>{fmt(t.buildCoins)} 碰撞能</span><span className={s.data.gte(t.buildData) ? '' : 'insufficient'}>{fmt(t.buildData)} 数据</span></div><button className="primary-button full" disabled={!unlocked || !afford} onClick={() => act(e => { if (e.build(t.id)) { setFocus(t.id); goToTab('lab'); } })}>{!unlocked ? <><LockKeyhole size={15}/>发现 {element(t.unlock).symbol} 后开放</> : <>研发并建造<ArrowRight size={15}/></>}</button>{unlocked && !afford && <p className="cost-shortfall">还差 {shortfall(t.buildCoins, t.buildData)}</p>}</>}</div></section>; })}</div><section className="panel industry-panel"><div className="panel-heading"><div><span className="eyebrow">INDUSTRIAL PIPELINE</span><h2>让实验室，自己运转。</h2></div><span className="tiny-label">{Object.values(s.modules).filter(Boolean).length} / 3 模块</span></div><div className="module-grid">{(['feed', 'reaction', 'allocation'] as Module[]).map((key, i) => { const m = MODULES[key], built = s.modules[key], prior = i === 0 || s.modules[(['feed', 'reaction', 'allocation'] as Module[])[i - 1]], can = max >= m.unlock && prior, afford = s.coins.gte(m.coins) && s.data.gte(m.data); return <div className="module" key={key}><div className="module-top"><span className="module-number">0{i + 1}</span>{i === 0 ? <Layers3 size={23}/> : i === 1 ? <Atom size={23}/> : <ArrowDownToLine size={23}/>}</div><h3>{m.name}</h3><p>{m.description}</p>{built ? <button className={`toggle-button ${s.automation[key] ? 'on' : ''}`} aria-pressed={s.automation[key]} onClick={() => act(() => { s.automation[key] = !s.automation[key]; })}><span/>{s.automation[key] ? '模块已启用' : '模块已暂停'}</button> : <><div className="module-cost">{fmt(m.coins)} 碰撞能 + {fmt(m.data)} 数据</div><button className="secondary-button full" disabled={!can || !afford} onClick={() => act(e => { e.research(key); })}>{!prior ? '先研发上一模块' : max < m.unlock ? `发现 ${element(m.unlock).symbol} 后开放` : '研发模块'}<ChevronRight size={15}/></button>{can && !afford && <p className="cost-shortfall">还差 {shortfall(m.coins, m.data)}</p>}</>}</div>; })}</div>{s.modules.feed && <div className="automation-controls"><div><label htmlFor="reserve">保留碰撞能</label><input id="reserve" type="text" inputMode="numeric" value={s.automation.reserve.toString()} onChange={e => { try { const reserve = D(e.target.value || 0); if (reserve.isFinite() && reserve.gte(0) && reserve.e <= 1000) act(() => { s.automation.reserve = reserve; }); } catch { /* incomplete numeric input */ } }}/></div>{s.modules.reaction && <><div><label htmlFor="work-mode">流水线模式</label><select id="work-mode" value={s.automation.mode} onChange={e => act(engine => engine.setMode(e.target.value as WorkMode))}><option value="explore">探索优先</option><option value="produce">指定生产</option><option value="archive">收录优先</option></select></div>{s.automation.mode === 'produce' && <div><label htmlFor="production-target">生产目标</label><select id="production-target" value={s.automation.target} onChange={e => act(engine => engine.setMode('produce', +e.target.value))}>{ELEMENTS.slice(0, max).map(e => <option key={e.z} value={e.z}>{e.symbol} · {e.name}</option>)}</select></div>}</>}</div>}<div className="pipeline-apply"><button className="secondary-button" onClick={() => act(e => e.setMode(s.automation.mode))} disabled={!s.modules.reaction}>应用模式<ArrowRight size={15}/></button></div></section></>;

  const achievements = () => <><div className="section-heading"><div><div className="eyebrow">MILESTONES & IMPOSSIBILITIES</div><h1>记录突破，<span>也记录那些意外。</span></h1></div><span className="count-badge">{s.achievements.length}<small> / {ACHIEVEMENTS.length}</small></span></div><div className="achievement-grid">{ACHIEVEMENTS.map(a => { const earned = s.achievements.includes(a.id), hidden = a.hidden && !earned; return <section className={`panel achievement ${earned ? 'earned' : ''} ${hidden ? 'secret' : ''}`} key={a.id}><div className="achievement-medal">{hidden ? <LockKeyhole size={23}/> : a.hidden ? <Sparkles size={25}/> : <Trophy size={25}/>}</div><div><span className="eyebrow">{a.hidden ? 'HIDDEN DISCOVERY' : 'LAB MILESTONE'}{earned ? ' / 已达成' : ''}</span><h3>{hidden ? '？？？' : a.name}</h3><p>{hidden ? '在实验室的边界之外，还有意想不到的可能。' : a.description}</p></div>{earned && <Check className="earned-check" size={18}/>}</section>; })}</div><p className="page-note">隐藏成就只记录在线的成功合成；已发现元素的重复生产也可达成。徽章不会改变生产倍率。</p></>;

  const stats = () => <><div className="section-heading"><div><div className="eyebrow">LABORATORY OBSERVATORY</div><h1>每一个数字，<span>都来自你的实验。</span></h1></div><button className="secondary-button" onClick={exportSave}><Download size={16}/>导出实验存档</button></div><div className="stats-grid">{[{ label: '累计实验次数', value: fmt(s.stats.events), unit: '次实验', icon: Activity }, { label: '历史碰撞能总收益', value: fmt(s.stats.earned), unit: '碰撞能', icon: Zap }, { label: '累计获得元素', value: fmt(s.stats.produced), unit: '元素单位', icon: Atom }, { label: '历史余额峰值', value: fmt(s.stats.peak), unit: '碰撞能', icon: Gauge }, { label: '实验室运行时间', value: clock(s.elapsed), unit: '含已结算的离线时间', icon: RotateCcw }, { label: `v${GAME_VERSION} 收录进度`, value: `${archived} / ${PLAYABLE_ELEMENTS}`, unit: `发现 ${max}/${PLAYABLE_ELEMENTS} · 长期发现 ${max}/118`, icon: BookOpen }].map(item => <div className="panel stat-card" key={item.label}><item.icon size={18}/><span>{item.label}</span><strong>{item.value}</strong><small>{item.unit}</small></div>)}</div><section className="panel log-panel"><div className="panel-heading"><div><span className="eyebrow">MILESTONE LOG</span><h2>实验里程碑</h2></div><span className="tiny-label">SEED {s.seed}</span></div><div className="milestone-log"><div><time>00:00:00</time><i/><span>实验室启动 · 两颗氢原子</span></div>{Object.entries(s.stats.milestones).sort((a, b) => a[1] - b[1]).map(([key, time]) => <div key={key}><time>{clock(time)}</time><i/><span>{key.startsWith('element') ? `首次发现 ${element(+key.replace('element', '')).name}` : key.startsWith('reactor') ? `${REACTORS[+key.replace('reactor', '') - 1].name}投入运行` : key === 'firstUpgrade' ? '首次升级' : key === 'firstArchive' ? '第一种元素正式收录' : key === 'neonArchive' ? '提交 50 Ne · 第一阶段收录' : key === 'complete' ? '提交 50 Ca · 第二十号里程碑' : key === 'xeArchive' ? '提交 50 Xe · 第五十四号里程碑' : key === 'stage54' ? 'H–Xe 全部五十四格收录完成' : key.startsWith('module_') ? `${MODULES[key.replace('module_', '') as Module].name}模块上线` : '阶段记录'}</span></div>)}</div><p className="last-event">最近事件：{s.stats.lastEvent}</p></section>{import.meta.env.DEV && <section className="debug-section"><button className="text-button" onClick={() => setDebug(!debug)}><Gauge size={15}/>开发仪表 {debug ? '收起' : '展开'}</button>{debug && <pre>{JSON.stringify({ time: s.elapsed, eventsPerSecond: totalRate.toString(), coinsPerSecond: totalIncome.toString(), discovered: max, archived, lastEvent: s.stats.lastEvent, reactors: s.reactors.map(r => ({ id: r.id, built: r.built, target: r.target, probability: probability(r.target, r.id), rate: eventRate(r).toString() })) }, null, 2)}</pre>}</section>}</>;

  function elementDialog(z: number, discovery = false) {
    const info = element(z), state = s.elements[z - 1], known = !!state?.discovered, knowledge = KNOWLEDGE[z];
    const pendingDiscoveries = discovery && queue.length > 0 ? queue.length : 0;
    const inventory = known && knowledge ? <div className="inventory-block" role="region" aria-label="元素收录操作"><div><span>可提交库存</span><strong>{fmt(state.inventory)}<small> 单位</small></strong></div><div><span>档案累计提交</span><strong>{state.deposited}<small> / 50</small></strong></div><div className="progress"><i style={{ width: `${state.deposited * 2}%` }}/></div><button className="primary-button full" disabled={state.archived || state.inventory.lt(1)} onClick={() => act(e => { e.deposit(z); })}>{state.archived ? <><Check size={16}/>周期表已永久点亮</> : <><ArrowDownToLine size={16}/>提交 {Math.min(50 - state.deposited, state.inventory.gte(50) ? 50 : state.inventory.toNumber())} 单位至档案</>}</button><p>累计提交 50 单位，即可收录。</p></div> : null;
    return <Modal title={discovery ? `新元素发现 · ${info.name}` : `${info.name} · ${info.english}`} onClose={() => setDialog(null)}><div className="element-card-hero"><div className={`large-element ${state?.archived ? 'archived' : ''}`} style={{ '--element': info.color } as CSSProperties}><span>{z}</span><strong>{info.symbol}</strong><small>{info.english}</small><i>{info.mass || '—'}</i></div>{z <= CALCIUM_ELEMENT && known ? <div className={`specimen specimen-${z} ${z > 10 ? 'specimen-expansion' : ''}`} style={{ backgroundPosition: `${((z - 1) % 5) * 25}% ${(z - 1) % 10 < 5 ? 0 : 100}%` }} aria-label={info.specimenDescription}/> : z <= PLAYABLE_ELEMENTS && known ? <AtomicSpecimen info={info}/> : <div className="locked-specimen"><LockKeyhole size={32}/><p>{z > PLAYABLE_ELEMENTS ? '未来研究目标' : '等待首次发现'}</p></div>}</div><div className="knowledge-status"><span className={state?.archived ? 'accent' : ''}>{state?.archived ? '✓ 已正式收录' : known ? '已发现 · 尚未收录' : z > PLAYABLE_ELEMENTS ? `v${GAME_VERSION} 版本锁定` : '未发现'}</span><span>第 {z} 号元素</span></div>{inventory}{pendingDiscoveries > 0 && <div className="discovery-queue" role="status"><span>还有 {pendingDiscoveries} 项新发现待查看</span><button className="secondary-button" onClick={() => setDialog(null)}>查看下一个发现</button></div>}{known && <ElementAbility z={z} archived={state.archived} active={s.activeAbilities?.includes(z) ?? false} onActivate={() => activateAbilities([z])}/>}<AtomicFacts info={info} known={known}/>{known && knowledge ? <><div className="knowledge-body"><h3>{knowledge.title}</h3><p>{knowledge.fact}</p><h4>电子与性质</h4><p>{ATOMIC_PROFILES[z]?.chemistry}</p><h4>主要用途</h4><p>{knowledge.application}</p><FurtherScience info={info}/><h4>实验进展</h4><p>{knowledge.unlock}</p></div><dl className="element-history"><div><dt>首次发现</dt><dd>{clock(state.firstDiscoveredAt || 0)} · {state.firstDiscoveredReactor ? `${REACTORS[state.firstDiscoveredReactor - 1].roman} 级` : '初始样本'}</dd></div><div><dt>累计获得</dt><dd>{fmt(state.totalProduced)} 单位</dd></div></dl><p className="specimen-caption">{info.specimenDescription}{z === 10 && '（图为放电发光示意，常温常压下氖气无色。）'}{z >= 21 && z <= PLAYABLE_ELEMENTS && '（图为原子示意。）'}</p><p className="science-note">{SCIENCE_NOTE} <a href={baikeUrl(info.name)} target="_blank" rel="noreferrer">百度百科 ↗</a></p></> : <div className="locked-copy"><p>{z > PLAYABLE_ELEMENTS ? z === 118 ? '鿫是《通往118》的长期终点。未来版本中，“50 个 Og”将代表 50 次成功合成且确认的事件记录，并非长期储存的普通气体。' : `它属于未来的旅程。v${GAME_VERSION} 已开放 1—54 号元素（H–Xe）；55–118 号只作为未来研究目标显示，尚未开放或测试。` : `依次发现元素后，你将有机会与${info.name}相遇。当前下一个新元素是 ${element(Math.min(PLAYABLE_ELEMENTS, max + 1)).symbol}。`}</p><button className="secondary-button full" onClick={() => setDialog(null)}>返回实验室</button></div>}</Modal>;
  }

  return <div className="app-shell"><header className="site-header"><a className="brand" href="#" onClick={e => { e.preventDefault(); goToTab('lab'); }}><span className="brand-mark"><Atom size={30} strokeWidth={1.2}/></span><span><strong>通往<span>118</span></strong><small>ROAD TO 118</small></span><i>v{GAME_VERSION}</i></a><div className="header-right"><span className="save-label"><ShieldCheck size={14}/>{saveStatus}</span><button className="icon-button" aria-label="存档与设置" onClick={() => setDialog({ kind: 'settings' })}><Settings2 size={19}/></button></div></header><nav className="main-nav" aria-label="主导航">{tabs.map(t => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => goToTab(t.id)}><t.icon size={17}/><span>{t.name}</span><small>{t.en}</small>{t.id === 'research' && ((max >= MODULES.feed.unlock && !s.modules.feed) || REACTORS.some(t => max >= t.unlock && !s.reactors[t.id - 1].built)) && <i className="nav-dot"/>}</button>)}<div className="nav-caption"><i className="signal-dot"/>探索尚未被点亮的世界</div></nav><main>{tab !== 'guide' && <section className="resource-bar" aria-label="实验室资源"><div className="main-resource"><span className="resource-label"><Zap size={14}/>碰撞能</span><div className="coin-value" data-testid="coins">{fmt(s.coins)}</div><p className="resource-income">收入 <strong>+{fmt(totalIncome)}</strong><small> /秒</small></p></div><div className="resource-item"><span>总实验速度</span><strong>{fmt(totalRate)}<small>次/秒</small></strong></div><div className="resource-item"><span>研究数据</span><strong>{fmt(s.data)}<small>点</small></strong></div><div className="resource-item progress-resource"><span>元素档案</span><strong>{max}<small>/{PLAYABLE_ELEMENTS} 发现</small><em>{archived}/{PLAYABLE_ELEMENTS} 收录</em></strong><div className="segmented-progress">{Array.from({ length: PLAYABLE_ELEMENTS }, (_, i) => <i key={i} className={s.elements[i].archived ? 'archived' : s.elements[i].discovered ? 'discovered' : ''}/>)}</div></div></section>}{saveBlocked && <div className="message-banner recovery-warning" role="alert"><span>当前进度尚未保存。请先处理旧存档，刷新会丢失本次进度。</span><button className="secondary-button" onClick={() => setDialog({ kind: 'settings' })}>处理存档</button></div>}{message && <div className="message-banner" role="status"><span>{message}</span><button className="text-button" onClick={() => setMessage('')}>关闭</button></div>}{offline && tab !== 'guide' && <div className="offline-banner"><span><RotateCcw size={18}/><strong>欢迎回来。</strong>已结算 {clock(offline.seconds)} 离线实验：+{fmt(offline.coins)} 碰撞能，+{fmt(offline.produced)} 单位已发现元素。最多结算 4 小时。</span><button className="text-button" onClick={() => setOffline(null)}>继续实验<ArrowRight size={14}/></button></div>}<div className="tab-content" key={tab}>{tab === 'lab' ? lab() : tab === 'research' ? research() : tab === 'achievements' ? achievements() : tab === 'guide' ? <><div className="guide-replay"><button className="secondary-button" onClick={replayTutorial}><RotateCcw size={15}/>重看新手引导</button></div><Tutorial onPlay={() => goToTab('lab')}/></> : stats()}</div><footer><span><Atom size={15}/>ROAD TO 118<span className="footer-divider"/>从两颗氢原子开始的旅程</span><button className="text-button" onClick={() => goToTab('guide')}>教程<ArrowRight size={13}/></button></footer></main><div className="toast-stack" aria-live="polite">{toasts.filter(t => tab !== 'guide' && Date.now() - t.time < 6500).slice(-3).map(t => <div className={`toast ${t.kind}`} key={t.id}>{t.kind === 'achievement' ? <Trophy size={17}/> : t.kind === 'archive' ? <BookOpen size={17}/> : <Sparkles size={17}/>}<span>{t.text}</span></div>)}</div><input ref={importInput} type="file" accept=".json,application/json" className="sr-only" aria-label="导入游戏存档" onChange={e => { void importSave(e.target.files?.[0]); }}/>
    {dialog?.kind === 'element' && elementDialog(dialog.z, dialog.discovery)}
    {dialog?.kind === 'settings' && <Modal title="存档与实验室设置" onClose={() => setDialog(null)}><div className="settings-list"><label><span><strong>科学记数法</strong><small>关闭时显示中文大数单位，超过载后自动使用科学记数法</small></span><input type="checkbox" checked={s.settings.scientific} onChange={e => act(() => { s.settings.scientific = e.target.checked; })}/></label><label><span><strong>减少动态效果</strong><small>降低粒子运动，保留全部游戏功能</small></span><input type="checkbox" checked={s.settings.reducedMotion} onChange={e => act(() => { s.settings.reducedMotion = e.target.checked; })}/></label></div>{saveBlocked && boot.raw !== undefined && <button className="secondary-button full" onClick={exportRawSave}><Download size={17}/>导出原始旧档</button>}<div className="save-actions"><button className="secondary-button" onClick={exportSave}><Download size={17}/>导出存档</button><button className="secondary-button" onClick={() => importInput.current?.click()}><Upload size={17}/>导入存档</button></div><button className="primary-button full" onClick={saveCurrent}>{saveBlocked ? '备份旧档并保存当前进度' : '立即保存'}</button><p className="science-note">进度保存在当前浏览器，每 12 秒自动保存。导入会替换当前进度，建议先导出备份。离线仅结算已发现元素与碰撞能，不会自动发现新元素或取得隐藏成就。</p></Modal>}
    {dialog?.kind === 'complete' && <Modal title="H–Xe 全收集完成。" onClose={() => setDialog(null)}><div className="completion-emblem"><span>54</span><strong>Xe</strong><small>XENON / 氙</small><i><Check size={17}/>{archived} / {PLAYABLE_ELEMENTS} 已收录</i></div><p className="completion-text">从两颗氢原子，到 H–Xe 五十四格完整档案。<br/>氙是本版终点；锌、氪和钙都只是沿途里程碑。</p><div className="end-stats"><div><span>全收集时间</span><strong>{clock(s.stats.completedAt || 0)}</strong></div><div><span>氙收录时间</span><strong>{s.stats.xeCompletedAt === null ? '—' : clock(s.stats.xeCompletedAt)}</strong></div><div><span>已点亮元素</span><strong>{archived} / {PLAYABLE_ELEMENTS}</strong></div></div><p className="science-note">第 55–118 号为后续研究目标。你仍可继续使用实验室。</p><button className="primary-button full" onClick={() => setDialog(null)}>继续我的实验室<ArrowRight size={16}/></button></Modal>}
  </div>;
}



