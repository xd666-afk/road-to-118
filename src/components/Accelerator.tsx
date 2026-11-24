import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ArrowLeft, Check, CircleDashed, Database, FlaskConical, LockKeyhole, Microscope, Minus, Play, Plus, X, Zap } from 'lucide-react';
import { artworkUrl } from '../data/artwork';
import { element } from '../data/elements';
import meshUrl from '../data/accelerator.mesh?url';
import geometry from '../data/acceleratorGeometry.json';
import { acceleratorSegments, caesiumReadiness, caesiumRun, segmentReadiness } from '../game/accelerator';
import { ARCHIVE_UNITS } from '../game/config';
import { format } from '../game/numbers';
import type { GameState } from '../game/types';
import { createHallRenderer, loadHallMesh, type HallCamera, type HallView } from './acceleratorRenderer';
import './accelerator.css';

const total = acceleratorSegments.length;
const defaultCamera = (view: HallView): HallCamera => ({ view, pitch: 0, yaw: 0, zoom: 1 });
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function Accelerator({ state, onBuild, onCommission, onResearch, onRead, onArchive, onExit, onGuideReady, onInspect, hud, notices }: {
  state: GameState;
  onBuild: (index: number) => boolean;
  onCommission: () => boolean;
  onResearch: () => boolean;
  onRead: () => boolean;
  onArchive: () => void;
  onExit: () => void;
  onGuideReady: (ready: boolean) => void;
  onInspect: (index: number) => void;
  hud: ReactNode;
  notices: ReactNode;
}) {
  const { built, commissioned } = state.accelerator;
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
  const caesium = caesiumReadiness(state);

  useEffect(() => {
    onGuideReady(true);
    return () => onGuideReady(false);
  }, [onGuideReady]);

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

  function select(index: number) {
    setSelected(index);
    setInspecting(true);
    setResearchOpen(false);
    onInspect(index);
  }

  function build() {
    if (!onBuild(selected)) return;
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

  function traceBeam() {
    changeView('plan');
    frame.current.beamAt = performance.now();
    if (status === 'photo') setPhotoPulse(value => value + 1);
    requestPaint.current();
  }

  return <section className="lab-scene accelerator" aria-label="加速大厅" data-renderer={status}>
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
        hidden={status === 'loading' || (status === 'photo' && view !== 'plan')}
        ref={button => { markers.current[index] = button; }}
        style={status === 'photo' ? {
          left: `calc(50% + var(--poster-width) * ${geometry.markers[index][0] / geometry.width - .5})`,
          top: `calc(50% + var(--poster-height) * ${geometry.markers[index][1] / geometry.height - .5})`,
        } : undefined}
        onClick={() => select(index)}>
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
            data-guide-target={index === 0 ? 'accelerator-ne' : undefined}
            data-built={index < built} title={name} onClick={() => select(index)}>{element(z).symbol}</button>)}
      </div>
      {built === total && <div className="accelerator-beam-controls">
        <button type="button" className="accelerator-beam-button" onClick={startBeam}><Play size={16}/>
          {commissioned ? '重放束流' : '启动全环试束'}</button>
        {commissioned && <button type="button" className="accelerator-beam-button" aria-expanded={researchOpen} onClick={() => {
          setInspecting(false);
          setResearchOpen(value => !value);
        }}><Microscope size={16}/>铯研究</button>}
      </div>}
    </div>

    {inspecting && <aside className="accelerator-detail" aria-label="工区操作">
      <header><h2>{segment.name}</h2><button type="button" aria-label="关闭工区操作" onClick={() => setInspecting(false)}><X size={18}/></button></header>
      <p>{segment.work}</p>
      {selected < built ? <div className="accelerator-finished"><Check size={16}/>已完工</div> : <>
        <ul className="accelerator-costs" aria-label="施工材料">
          <li data-enough={work.samples}><FlaskConical size={15}/><span>{sample.name}样本</span><b>{format(work.specimen.inventory)} / {segment.units}</b></li>
          <li data-enough={work.energy}><Zap size={15}/><span>碰撞能</span><b>{format(state.coins)} / {format(segment.coins)}</b></li>
          <li data-enough={work.data}><Database size={15}/><span>研究数据</span><b>{format(state.data)} / {format(segment.data)}</b></li>
        </ul>
        <button type="button" className="primary-button full" disabled={!work.ready} onClick={build}>
          {selected > built ? <><LockKeyhole size={15}/>先完成前一段</> : !work.discovered ? '发现' + sample.name + '后开放' :
            work.ready ? <><CircleDashed size={16}/>{'建造' + segment.name.split(' · ')[0]}</> : '等待材料'}
        </button>
      </>}
    </aside>}
    {commissioned && researchOpen && <aside className="accelerator-detail" aria-label="铯研究控制台">
      <header><h2>铯研究 · Cs</h2><button type="button" aria-label="关闭铯研究" onClick={() => setResearchOpen(false)}><X size={18}/></button></header>
      <p>{caesium.specimen.archived ? '铯已收录，铯钟校时能力已生效。' :
        caesium.remaining === undefined ? `用氙样本校准探测器。每次读取可获得 ${caesiumRun.output} 份铯样本。` :
        caesium.remaining > 0 ? '探测器正在采集信号。' : '信号已采集完毕，等待读取。'}</p>
      <p>收录 {caesium.specimen.deposited} / {ARCHIVE_UNITS} · 库存 {format(caesium.specimen.inventory)} 份</p>
      {!caesium.specimen.archived && (caesium.remaining !== undefined ? <>
        <progress className="accelerator-run-progress" aria-label="铯信号采集进度" value={caesiumRun.seconds - caesium.remaining} max={caesiumRun.seconds}/>
        <button type="button" className="primary-button full" disabled={caesium.remaining > 0} onClick={onRead}>
          {caesium.remaining > 0 ? '采集信号 · ' + Math.ceil(caesium.remaining) + ' 秒' : '读取探测结果'}
        </button>
      </> : caesium.enoughToArchive ? <button type="button" className="primary-button full" onClick={onArchive}>打开铯档案</button> : <>
        <ul className="accelerator-costs" aria-label="校准材料">
          <li data-enough={caesium.xenon.inventory.gte(caesiumRun.xenon)}><FlaskConical size={15}/><span>氙样本</span>
            <b>{format(caesium.xenon.inventory)} / {caesiumRun.xenon}</b></li>
          <li data-enough={state.data.gte(caesiumRun.data)}><Database size={15}/><span>研究数据</span>
            <b>{format(state.data)} / {format(caesiumRun.data)}</b></li>
        </ul>
        <button type="button" className="primary-button full" disabled={!caesium.ready} onClick={() => {
          if (onResearch()) traceBeam();
        }}>启动铯实验</button>
      </>)}
    </aside>}
  </section>;
}
