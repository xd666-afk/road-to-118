import { useState } from 'react';
import { Activity, ArrowRight, Check, CircleDashed, Database, FlaskConical, LockKeyhole, Zap } from 'lucide-react';
import { element } from '../data/elements';
import { artworkUrl } from '../data/artwork';
import { acceleratorSegments } from '../game/accelerator';
import { projectBonus, projectIds, projects, type ProjectId } from '../game/projects';
import type { GameState } from '../game/types';
import ResearchFunding from './ResearchFunding';
import './research-projects.css';

const icons = { spectroscopy: Database, separation: FlaskConical, pulse: Zap };

export function ProjectPicker({ state, id, onChange }: { state: GameState; id: ProjectId; onChange: (id: ProjectId) => void }) {
  return <div className="facility-picker" role="group" aria-label="选择工程">
    {projectIds.map(projectId => {
      const Icon = icons[projectId];
      const project = projects[projectId];
      return <button key={projectId} type="button" aria-pressed={id === projectId}
        onClick={() => onChange(projectId)}><Icon size={16} aria-hidden="true"/>
        <span>{project.name}</span>
        <small>{state.elements[project.stages[0].z - 1].discovered ? `${state.projects[projectId].built}/${project.stages.length}` : '发现 ' + element(project.stages[0].z).symbol}</small>
      </button>;
    })}
  </div>;
}

export default function ResearchProjects({ state, initialProject, onInvest, onAccelerator, onOperate }: {
  state: GameState;
  initialProject: ProjectId;
  onInvest: (id: ProjectId, index: number, limit?: number) => void;
  onAccelerator: () => void;
  onOperate: (id: ProjectId) => void;
}) {
  const [id, setProject] = useState(initialProject);
  const { name, effect, stages } = projects[id];
  const { built, funded } = state.projects[id];
  const stage = stages[built];
  const bonus = projectBonus(state, id);
  return <div className="research-projects">
    <ProjectPicker state={state} id={id} onChange={setProject}/>
    <section className="facility-panel" aria-label={name}>
      <img className="facility-preview" src={artworkUrl(`campus-${id}-${built}.webp`)}
        alt={name + `施工外观，已完成 ${built} 段`}/>
      <div className="facility-body">
        <div className="facility-title"><h3>{name}</h3><span aria-live="polite"><Activity size={15} aria-hidden="true"/>{effect}加成 +{bonus}%</span></div>
        <ol className="facility-stages" aria-label={name + '施工进度'}>
          {stages.map((step, index) => <li key={step.name} data-built={index < built} aria-current={index === built ? 'step' : undefined}>
            {index < built ? <Check size={15} aria-label="已完工"/> : <b>{element(step.z).symbol}</b>}
            <span>{step.name}</span><small>+{step.bonus}%</small>
          </li>)}
        </ol>
        {stage ? <ResearchFunding name={stage.name} balance={state.data} funded={funded} cost={stage.data}
          locked={state.elements[stage.z - 1].discovered ? undefined : `发现${element(stage.z).name}（${element(stage.z).symbol}）后开放`}
          onInvest={limit => onInvest(id, built, limit)}/> : <p className="facility-complete"><Check size={16}/>全站已投运</p>}
        {built > 0 && <button type="button" className="facility-enter secondary-button full" onClick={() => onOperate(id)}>
          进入{name}<ArrowRight size={16}/>
        </button>}
      </div>
    </section>
    <button type="button" className="facility-hall-link" onClick={onAccelerator}>
      {state.elements[acceleratorSegments[0].z - 1].discovered ? <CircleDashed size={20}/> : <LockKeyhole size={18}/>}
      <span><strong>环形加速器</strong><small>Ne · Ar · Kr · Xe</small></span>
      <b>{state.accelerator.built}/{acceleratorSegments.length}</b><ArrowRight size={16}/>
    </button>
  </div>;
}
