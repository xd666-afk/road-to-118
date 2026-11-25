import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ArrowLeft, Check, CircleDashed, Database, FlaskConical, Microscope, Minus, Play, Plus, Radio, X } from 'lucide-react';
import { artworkUrl } from '../data/artwork';
import { element } from '../data/elements';
import meshUrl from '../data/accelerator.mesh?url';
import geometry from '../data/acceleratorGeometry.json';
import { acceleratorBatch, acceleratorReadiness, acceleratorSegments, acceleratorSweep, acceleratorSweeps, activeAcceleratorTarget, bariumBeamOffset, segmentReadiness, type AcceleratorTarget } from '../game/accelerator';
import { BARIUM_ELEMENT, CAESIUM_ELEMENT, archiveUnits } from '../game/config';
import { format } from '../game/numbers';
import type { GameState } from '../game/types';
import { createHallRenderer, loadHallMesh, type HallCamera, type HallView } from './acceleratorRenderer';
import ResearchFunding from './ResearchFunding';
import './accelerator.css';

const total = acceleratorSegments.length;
const defaultCamera = (view: HallView): HallCamera => ({ view, pitch: 0, yaw: 0, zoom: 1 });
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function Accelerator({ state, onInvest, onCommission, onResearch, onLock, onAdjust, onRead, onArchive, onExit, hud, notices }: {
  state: GameState;
  onInvest: (index: number, limit?: number) => number;
  onCommission: () => boolean;
  onResearch: (target: AcceleratorTarget) => boolean;
  onLock: () => boolean;
  onAdjust: (direction: -1 | 1) => boolean;
  onRead: (target: AcceleratorTarget) => boolean;
  onArchive: (target: AcceleratorTarget) => void;
  onExit: () => void;
  hud: ReactNode;
  notices: ReactNode;
}) {
  const { built, commissioned } = state.accelerator;
  const active = activeAcceleratorTarget(state.accelerator);
  const bariumUnlocked = state.elements[CAESIUM_ELEMENT - 1].archived;
  const nextResearch = active ?? (bariumUnlocked ? BARIUM_ELEMENT : CAESIUM_ELEMENT);
  const [researchSelection, setResearchSelection] = useState<AcceleratorTarget>(nextResearch);
  const target = active ?? (bariumUnlocked ? researchSelection : CAESIUM_ELEMENT);
  const researchName = element(target).name;
  const alignBeam = target === BARIUM_ELEMENT;
  const [view, setView] = useState<HallView>('plan');
  const [selected, setSelected] = useState(Math.min(built, total - 1));
  const [inspecting, setInspecting] = useState(false);
  const [researchOpen, setResearchOpen] = useState(state.accelerator.runRemaining !== undefined);
  const [photoPulse, setPhotoPulse] = useState(0);
  const [status, setStatus] = useState<'loading' | 'webgl' | 'photo'>('loading');
  const reduced = state.settings.reducedMotion;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markers = useRef<(HTMLButtonElement | null)[]>([]);
  const camera = useRef(defaultCamera('plan'));
  const frame = useRef({ built, installedAt: -Infinity, beamAt: -Infinity, reduced });
  const requestPaint = useRef(() => {});
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const work = segmentReadiness(state, selected)!;
  const { segment } = work;
  const sample = element(segment.z);
  const research = acceleratorReadiness(state, target);
  const material = element(research.recipe.sample);
  const signal = research.remaining === undefined ? undefined : acceleratorSweep(research.remaining);
  const offset = alignBeam ? bariumBeamOffset(state) : 0;
  const locks = state.accelerator.runLocks ?? 0;
  const panelTrigger = useRef<HTMLButtonElement>(null);
  const panelClose = useRef<HTMLButtonElement>(null);
  const panelOpen = inspecting || researchOpen;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const controller = new AbortController();
    const observer = new ResizeObserver(() => requestPaint.current());
    let hall: ReturnType<typeof createHallRenderer> | undefined;
    let pending = 0;
    function paint(now: number) {
      pending = 0;
      if (!hall) return;
      const { built, installedAt, beamAt, reduced } = frame.current;
      const installation = clamp((now - installedAt) / 720, 0, 1);
      const beamDuration = reduced ? 1200 : 3600;
      const tracing = now - beamAt < beamDuration;
      const visible = hall.draw({
        camera: camera.current, built,
        raised: reduced ? 0 : Math.pow(1 - installation, 3) * 1.6,
        beam: tracing ? reduced ? .57 : (now - beamAt) / 1800 : -1,
      });
      for (const [i, point] of visible.entries()) {
        const button = markers.current[i];
        if (!button) continue;
        button.style.left = (point.x * 100) + '%';
        button.style.top = (point.y * 100) + '%';
        button.hidden = !point.visible;
      }
      if (installation < 1 || tracing) schedule();
    }
    function schedule() {
      if (!pending && !controller.signal.aborted) pending = requestAnimationFrame(paint);
    }
    function showFallback() {
      cancelAnimationFrame(pending);
      observer.disconnect();
      hall?.dispose();
      hall = undefined;
      requestPaint.current = () => {};
      setStatus('photo');
    }
    function lost(event: Event) {
      event.preventDefault();
      showFallback();
    }
    canvas.addEventListener('webglcontextlost', lost);
    void loadHallMesh(meshUrl, controller.signal).then(mesh => {
      if (controller.signal.aborted) return;
      hall = createHallRenderer(canvas, mesh);
      requestPaint.current = schedule;
      observer.observe(canvas);
      schedule();
      setStatus('webgl');
    }).catch(error => {
      if (!controller.signal.aborted) {
        console.warn('Accelerator 3D unavailable', error);
        showFallback();
      }
    });
    return () => {
      controller.abort();
      cancelAnimationFrame(pending);
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      hall?.dispose();
      requestPaint.current = () => {};
    };
  }, []);

  useEffect(() => {
    frame.current = { ...frame.current, built, reduced };
    requestPaint.current();
  }, [built, reduced]);

  useEffect(() => {
    if (!panelOpen) return;
    if (!document.querySelector('.opening-spotlight')) panelClose.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open], .opening-spotlight')) return;
      event.preventDefault();
      closePanel();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [panelOpen]);

  function closePanel() {
    setInspecting(false);
    setResearchOpen(false);
    requestAnimationFrame(() => panelTrigger.current?.focus({ preventScroll: true }));
  }

  function changeView(next: HallView) {
    camera.current = defaultCamera(next);
    setView(next);
    requestPaint.current();
  }

  function zoomBy(delta: number) {
    camera.current.zoom = clamp(camera.current.zoom * delta, .72, 1.5);
    requestPaint.current();
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || event.pointerId !== drag.current.id) return;
    const { x, y } = drag.current, c = camera.current;
    c.yaw = clamp(c.yaw - (event.clientX - x) * .005, -.58, .58);
    c.pitch = clamp(c.pitch + (event.clientY - y) * .003, -.23, .40);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    requestPaint.current();
  }

  function select(index: number, trigger: HTMLButtonElement) {
    panelTrigger.current = trigger;
    setSelected(index);
    setInspecting(true);
    setResearchOpen(false);
  }

  function invest(limit?: number) {
    if (!onInvest(selected, limit) || state.accelerator.built <= selected) return;
    frame.current.installedAt = performance.now();
    frame.current.built = selected + 1;
    setSelected(Math.min(selected + 1, total - 1));
    requestPaint.current();
  }

  function startBeam() {
    if (!commissioned && !onCommission()) return;
    setInspecting(false);
    traceBeam();
  }

  function traceBeam(overview = true) {
    if (overview) changeView('plan');
    frame.current.beamAt = performance.now();
    if (status === 'photo') setPhotoPulse(value => value + 1);
    requestPaint.current();
  }

  return <section className="lab-scene accelerator" aria-label="加速大厅" data-renderer={status} data-reduced={reduced}>
    {status !== 'webgl' && <div className="accelerator-poster">
      <img src={artworkUrl('accelerator/' + view + '-' + built + '.webp')} alt="" draggable={false}/>
      {view === 'plan' && photoPulse > 0 && <svg className="accelerator-photo-beam"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" aria-hidden="true">
        <path key={photoPulse} d={geometry.beam} pathLength={1} className={reduced ? 'static' : ''}/>
      </svg>}
    </div>}
    <canvas ref={canvasRef} className="accelerator-world" aria-label="可拖动视角的环形加速器"
      tabIndex={status === 'webgl' ? 0 : -1}
      onPointerDown={event => {
        if (status !== 'webgl' || event.button !== 0 || !event.isPrimary) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerMove={pointerMove} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        const turns = { ArrowLeft: -.10, ArrowRight: .10, ArrowUp: -.07, ArrowDown: .07 } as const;
        if (!(event.key in turns)) return;
        event.preventDefault();
        const key = event.key as keyof typeof turns;
        const c = camera.current;
        if (key === 'ArrowLeft' || key === 'ArrowRight') c.yaw = clamp(c.yaw + turns[key], -.58, .58);
        else c.pitch = clamp(c.pitch + turns[key], -.23, .40);
        requestPaint.current();
      }}/>
    {hud}
    <div className="accelerator-location">
      <button type="button" className="scene-icon-button" onClick={onExit} aria-label="返回反应容器"><ArrowLeft size={18}/></button>
      <h1>加速大厅</h1>
    </div>
    <div className="accelerator-overview">
      <progress aria-label="加速环工程进度" max={total} value={built}/>
      <strong>{built} / {total}</strong>
      {commissioned && <span>试束完成</span>}
    </div>
    <div className="scene-notices">{notices}</div>
    {status === 'loading' && <p className="accelerator-loading" role="status">正在载入大厅模型…</p>}
    {acceleratorSegments.map((item, index) =>
      <button key={item.z} type="button" className="accelerator-marker" data-built={index < built}
        aria-pressed={inspecting && index === selected} aria-label={'查看' + item.name}
        tabIndex={panelOpen ? -1 : undefined}
        hidden={status === 'loading' || (status === 'photo' && view !== 'plan')}
        ref={button => { markers.current[index] = button; }}
        style={status === 'photo' ? {
          left: `calc(50% + var(--poster-width) * ${geometry.markers[index][0] / geometry.width - .5})`,
          top: `calc(50% + var(--poster-height) * ${geometry.markers[index][1] / geometry.height - .5})`,
        } : undefined}
        onClick={event => select(index, event.currentTarget)}>
        {index < built ? <Check size={16}/> : <strong>{element(item.z).symbol}</strong>}
      </button>)}

    <div className="accelerator-dock">
      <div className="accelerator-dock-left">
        <div className="accelerator-camera" role="group" aria-label="观察视角">
          <button type="button" aria-pressed={view === 'plan'} onClick={() => changeView('plan')}>全环俯瞰</button>
          <button type="button" aria-pressed={view === 'aisle'} onClick={() => changeView('aisle')}>检修通道</button>
          {status === 'webgl' && <>
            <button type="button" aria-label="拉近视角" onClick={() => zoomBy(1.14)}><Plus size={17}/></button>
            <button type="button" aria-label="拉远视角" onClick={() => zoomBy(1 / 1.14)}><Minus size={17}/></button>
          </>}
        </div>
      </div>
      <div className="accelerator-sector-picker" role="group" aria-label="施工分段">
        {acceleratorSegments.map(({ name, z }, index) =>
          <button key={z} type="button" aria-pressed={inspecting && index === selected} aria-label={name}
            data-built={index < built} title={name} onClick={event => select(index, event.currentTarget)}>{element(z).symbol}</button>)}
      </div>
      {built === total && <div className="accelerator-beam-controls">
        <button type="button" className="accelerator-beam-button" onClick={startBeam}><Play size={16}/>
          {commissioned ? '重放束流' : '启动全环试束'}</button>
        {commissioned && <button type="button" className="accelerator-beam-button" aria-expanded={researchOpen} onClick={event => {
          panelTrigger.current = event.currentTarget;
          setInspecting(false);
          if (!researchOpen) setResearchSelection(nextResearch);
          setResearchOpen(value => !value);
        }}><Microscope size={16}/>{element(nextResearch).name}研究</button>}
      </div>}
    </div>

    {inspecting && <aside className="accelerator-detail" aria-label="工区操作">
      <header><h2>{segment.name}</h2><button ref={panelClose} type="button" aria-label="关闭工区操作" onClick={closePanel}><X size={18}/></button></header>
      <p>{segment.work}</p>
      {selected < built ? <div className="accelerator-finished"><Check size={16}/>已完工</div> :
        <ResearchFunding name={segment.name} balance={state.data} funded={work.funded} cost={segment.data}
          locked={!work.discovered ? '发现' + sample.name + '后开放' : selected > built ? '先完成前一段' : undefined}
          onInvest={invest}/>}
    </aside>}
    {commissioned && researchOpen && <aside className="accelerator-detail" aria-label={researchName + '研究控制台'}>
      <header><h2>{researchName}研究 · {element(target).symbol}</h2><button ref={panelClose} type="button" aria-label={'关闭' + researchName + '研究'} onClick={closePanel}><X size={18}/></button></header>
      {bariumUnlocked && <div className="accelerator-research-picker" role="group" aria-label="研究目标">
        {([CAESIUM_ELEMENT, BARIUM_ELEMENT] as const).map(z => <button key={z} type="button"
          aria-pressed={z === target} disabled={active !== undefined && z !== active}
          onClick={() => setResearchSelection(z)}>{element(z).symbol} {element(z).name}</button>)}
      </div>}
      <p>{research.specimen.archived ? (alignBeam ? '钡已收录，已知元素样本产量加成 +4%。' : '铯已收录，铯钟校时能力已生效。') :
        research.remaining === undefined ? `用${material.name}样本校准。自动采样 ${acceleratorBatch.output} 份，${alignBeam ? '对准束流' : '锁定信号'}可增产。` :
        research.remaining > 0 ? (alignBeam ? '把偏差调到 0，立刻推进扫描并额外拿到 5 份。' : '信号稳定时锁定，可跳过余下扫描并多收样本。') :
          `采样完成，可读取 ${research.output} 份${researchName}样本。`}</p>
      <p>收录 {research.specimen.deposited} / {research.specimen.archived ? research.specimen.deposited : archiveUnits(target)} · 库存 {format(research.specimen.inventory)} 份</p>
      {!alignBeam && research.specimen.archived && !state.elements[BARIUM_ELEMENT - 1].archived &&
        <button type="button" className="primary-button full" onClick={() => setResearchSelection(BARIUM_ELEMENT)}>前往钡研究</button>}
      {!research.specimen.archived && (research.remaining !== undefined ? <>
        <div className="accelerator-signal" data-ready={!alignBeam && signal?.ready}>
          <span>{research.remaining === 0 ? '采样完成' : alignBeam ? '束流扫描' : signal?.ready ? '信号稳定' : '扫描中'}</span>
          <div className="accelerator-sweeps" aria-hidden="true">
            {acceleratorSweeps.slice(1).map((mark, index) => <i key={mark} data-done={index < signal!.phase}/>)}
          </div>
          <strong key={locks} data-bonus={locks > 0}>+{locks * acceleratorBatch.bonus} 份</strong>
        </div>
        <progress className="accelerator-run-progress" aria-label={alignBeam ? '钡束流扫描进度' : '铯信号采集进度'}
          value={acceleratorBatch.seconds - research.remaining} max={acceleratorBatch.seconds}/>
        {research.remaining === 0 ? <button type="button" className="primary-button full" onClick={() => onRead(target)}>读取探测结果</button> :
          alignBeam ? <div className="accelerator-alignment" role="group" aria-label="束流调校">
            <output className="accelerator-alignment-value">偏差 {offset > 0 ? '+' : ''}{offset}</output>
            <div className="accelerator-alignment-track" aria-hidden="true">
              {[-2, -1, 0, 1, 2].map(tick => <i key={tick} data-center={tick === 0} data-beam={tick === offset}/>)}
            </div>
            <div className="accelerator-alignment-actions">
              <button type="button" className="secondary-button" aria-disabled={offset === -2}
                onClick={() => { if (onAdjust(-1)) traceBeam(false); }}><ArrowLeft size={16}/>向左调校</button>
              <button type="button" className="secondary-button" aria-disabled={offset === 2}
                onClick={() => { if (onAdjust(1)) traceBeam(false); }}>向右调校<ArrowLeft size={16} className="accelerator-arrow-right"/></button>
            </div>
          </div> : <button type="button" className="accelerator-lock-button full"
          aria-disabled={!signal?.ready} onClick={() => { if (onLock()) traceBeam(false); }}>
          <Radio size={17}/><span>锁定信号</span><small>{Math.ceil(research.remaining)} 秒</small>
        </button>}
      </> : research.enoughToArchive ? <button type="button" className="primary-button full" onClick={() => onArchive(target)}>打开{researchName}档案</button> : <>
        <ul className="accelerator-costs" aria-label="校准材料">
          <li data-enough={research.supply.inventory.gte(research.recipe.units)}><FlaskConical size={15}/><span>{material.name}样本</span>
            <b>{format(research.supply.inventory)} / {research.recipe.units}</b></li>
          <li data-enough={state.data.gte(research.recipe.data)}><Database size={15}/><span>研究数据</span>
            <b>{format(state.data)} / {format(research.recipe.data)}</b></li>
        </ul>
        <button type="button" className="primary-button full" disabled={!research.ready} onClick={() => {
          if (onResearch(target)) traceBeam();
        }}>启动{researchName}实验</button>
      </>)}
    </aside>}
  </section>;
}
