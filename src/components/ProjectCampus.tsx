import { useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Database, FlaskConical, LockKeyhole, Zap } from 'lucide-react';
import { element } from '../data/elements';
import { format } from '../game/numbers';
import { knownReactorSample, projects, pulseStationLimits, separationBonus, separationCost, SPECTRAL_SAMPLES, SPECTRAL_SECONDS, spectrumReward, STATION_SURGE, type ProjectId } from '../game/projects';
import type { GameState } from '../game/types';
import CampusModel from './CampusModel';
import { ProjectPicker } from './ResearchProjects';

function SampleSelect({ state, value, onChange, label }: {
  state: GameState;
  value: number;
  onChange: (z: number) => void;
  label: string;
}) {
  return <label className="campus-sample-select"><span>{label}</span>
    <select value={value} onChange={event => onChange(Number(event.target.value))}>
      {state.elements.map((_, index) => index + 1).filter(z => knownReactorSample(state, z)).map(z =>
        <option key={z} value={z}>{element(z).name} · {element(z).symbol}</option>)}
    </select>
  </label>;
}

function SpectrumConsole({ state, onStart, onClaim }: {
  state: GameState;
  onStart: (z: number) => void;
  onClaim: () => boolean;
}) {
  const [selected, setSelected] = useState(() => {
    if (state.projectOperations.scan) return state.projectOperations.scan.target;
    const available = state.elements.findIndex((row, index) => knownReactorSample(state, index + 1) && row.inventory.gte(SPECTRAL_SAMPLES));
    return Math.max(1, available + 1);
  });
  const [claimed, setClaimed] = useState(0);
  const scan = state.projectOperations.scan;
  const fmt = (value: Parameters<typeof format>[0]) => format(value, state.settings.scientific);
  if (scan) {
    const reward = spectrumReward(scan.target, scan.level);
    return <>
      <p className="campus-readout"><FlaskConical size={17}/><span>{element(scan.target).name}光谱</span>
        <strong>{scan.remaining > 0 ? Math.ceil(scan.remaining) + ' 秒' : '报告就绪'}</strong></p>
      <progress aria-label="光谱分析进度" value={SPECTRAL_SECONDS - scan.remaining} max={SPECTRAL_SECONDS}/>
      <button type="button" className="primary-button full" disabled={scan.remaining > 0}
        onClick={() => { if (onClaim()) setClaimed(reward); }}>
        领取 {fmt(reward)} 科研点
      </button>
    </>;
  }
  const inventory = state.elements[selected - 1].inventory;
  return <>
    {claimed > 0 && <p className="campus-readout" role="status"><Check size={17}/><span>报告已领取</span><strong>+{fmt(claimed)} 科研点</strong></p>}
    <SampleSelect state={state} value={selected} onChange={setSelected} label="分析样本"/>
    <p className="campus-readout"><FlaskConical size={17}/><span>消耗 {SPECTRAL_SAMPLES} 份</span><strong>库存 {fmt(inventory)}</strong></p>
    <button type="button" className="primary-button full" disabled={inventory.lt(SPECTRAL_SAMPLES)} onClick={() => onStart(selected)}>
      分析 {SPECTRAL_SECONDS} 秒 · +{fmt(spectrumReward(selected, state.projects.spectroscopy.built))} 科研点
    </button>
  </>;
}

function SeparationConsole({ state, onAssign }: { state: GameState; onAssign: (z: number) => void }) {
  const active = state.projectOperations.separationTarget;
  const [selected, setSelected] = useState(active ?? 1);
  const cost = separationCost(selected);
  const boost = 5 + state.projects.separation.built * 10;
  return <>
    {active && <p className="campus-readout" role="status"><Check size={17}/><span>{element(active).name}专线运行中</span>
      <strong>产量 +{separationBonus(state, active)}%</strong></p>}
    <SampleSelect state={state} value={selected} onChange={setSelected} label="专线目标"/>
    <p className="campus-caption">生产指定元素时，样本产量加成 +{boost}%。</p>
    <button type="button" className="primary-button full" disabled={active === selected || state.data.lt(cost)} onClick={() => onAssign(selected)}>
      {active === selected ? '已启用专线' : `配置专线 · ${format(cost, state.settings.scientific)} 科研点`}
    </button>
  </>;
}

function PulseConsole({ state, onRelease, onExit }: { state: GameState; onRelease: () => void; onExit: () => void }) {
  const { pulseCharge, pulseHits } = state.projectOperations;
  const { charge, hits } = pulseStationLimits(state);
  const active = pulseHits > 0;
  return <>
    <p className="campus-readout"><Zap size={17}/><span>{active ? '增压剩余' : '手动碰撞蓄能'}</span>
      <strong>{active ? pulseHits + ' 次' : `${pulseCharge} / ${charge}`}</strong></p>
    <progress aria-label={active ? '增压剩余次数' : '供能站蓄能'} value={active ? pulseHits : pulseCharge} max={active ? hits : charge}/>
    <p className="campus-caption">蓄满后，接下来的 {hits} 次手动碰撞获得额外 {STATION_SURGE}% 碰撞能加成。</p>
    {active || pulseCharge < charge ? <button type="button" className="secondary-button full" onClick={onExit}>返回实验室碰撞</button> :
      <button type="button" className="primary-button full" onClick={onRelease}>释放增压</button>}
  </>;
}

export default function ProjectCampus({ state, id, hud, notices, onChange, onExit, onConstruction, onStart, onClaim, onAssign, onRelease }: {
  state: GameState;
  id: ProjectId;
  hud: ReactNode;
  notices: ReactNode;
  onChange: (id: ProjectId) => void;
  onExit: () => void;
  onConstruction: () => void;
  onStart: (z: number) => void;
  onClaim: () => boolean;
  onAssign: (z: number) => void;
  onRelease: () => void;
}) {
  const { built } = state.projects[id];
  const project = projects[id];
  return <section className="lab-scene project-campus" aria-label="科研园区" data-reduced={state.settings.reducedMotion}>
    <CampusModel key={id} id={id} built={built} name={project.name}/>
    {hud}
    <div className="scene-notices">{notices}</div>
    <header className="campus-location">
      <button type="button" className="scene-icon-button" aria-label="返回实验室" onClick={onExit}><ArrowLeft size={20}/></button>
      <h1>{project.name}</h1>
    </header>
    <aside className="campus-console" aria-label={project.name + '控制台'}>
      <div className="campus-console-title">
        <h2>{id === 'spectroscopy' ? '光谱分析' : id === 'separation' ? '样本专线' : '脉冲增压'}</h2>
        <button type="button" className="text-button" onClick={onConstruction}>施工 {built}/{project.stages.length}</button>
      </div>
      {built === 0 ? <p className="campus-readout"><LockKeyhole size={16}/>完成首段施工后开放</p> :
        id === 'spectroscopy' ? <SpectrumConsole key={id} state={state} onStart={onStart} onClaim={onClaim}/> :
        id === 'separation' ? <SeparationConsole key={id} state={state} onAssign={onAssign}/> :
        <PulseConsole state={state} onRelease={onRelease} onExit={onExit}/>}
    </aside>
    <div className="campus-dock"><ProjectPicker state={state} id={id} onChange={onChange}/></div>
  </section>;
}
