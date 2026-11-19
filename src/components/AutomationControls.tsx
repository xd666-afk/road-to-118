import { ELEMENTS, element } from '../data/elements';
import { REACTORS } from '../game/config';
import type { Engine } from '../game/engine';
import { D } from '../game/numbers';
import type { AllocationScope, FeedScope, GameState, ReactorJob, WorkMode } from '../game/types';

export default function AutomationControls({ state, max, act }: {
  state: GameState;
  max: number;
  act: (change: (engine: Engine) => void) => void;
}) {
  if (!state.modules.feed) return null;
  const { automation } = state;
  const options = ELEMENTS.slice(0, max).map(info => (
    <option key={info.z} value={info.z}>{info.symbol} · {info.name}</option>
  ));

  return <div className="industry-settings">
    <div className="automation-controls">
      <div><label htmlFor="feed-scope">自动补样范围</label>
        <select id="feed-scope" value={automation.feedScope} onChange={event => {
          const scope = event.target.value as FeedScope;
          act(e => { e.state.automation.feedScope = scope; });
        }}><option value="latest">只补最高级仪器</option><option value="all">补充所有运行中的仪器</option></select>
      </div>
      <div><label htmlFor="reserve">保留碰撞能</label>
        <input id="reserve" type="text" inputMode="numeric" value={automation.reserve.toString()} onChange={event => {
          try {
            const reserve = D(event.target.value || 0);
            if (reserve.isFinite() && reserve.gte(0) && reserve.e <= 1000) {
              act(e => { e.state.automation.reserve = reserve; });
            }
          } catch { /* Incomplete input. */ }
        }}/>
      </div>
      {state.modules.allocation && <div><label htmlFor="allocation-scope">自动提交范围</label>
        <select id="allocation-scope" value={automation.allocationScope} onChange={event => {
          const scope = event.target.value as AllocationScope;
          act(e => { e.state.automation.allocationScope = scope; });
        }}><option value="all">所有已发现元素</option><option value="calibration">仅当前校准样本</option></select>
      </div>}
    </div>
    {state.modules.reaction && <div className="work-assignments">
      <div className="work-assignments-heading">
        <h3>仪器分工</h3>
        {!automation.reaction && <small>自动反应已暂停</small>}
      </div>
      <div className="work-presets">
        <div><label htmlFor="work-mode">套用分工预设</label>
          <select id="work-mode" value={automation.mode} onChange={event => {
            const mode = event.target.value as WorkMode;
            act(e => e.setMode(mode));
          }}>
            <option value="custom" disabled>自定义分工</option>
            <option value="explore">主力探索，其余补档</option>
            <option value="produce">全部生产指定元素</option>
            <option value="archive">全部补齐档案</option>
          </select>
        </div>
        {automation.mode === 'produce' && <div><label htmlFor="production-target">全线生产目标</label>
          <select id="production-target" value={automation.target} onChange={event => {
            const target = Number(event.target.value);
            act(e => e.setMode('produce', target));
          }}>{options}</select>
        </div>}
      </div>
      <div className="work-lines">
        {state.reactors.filter(reactor => reactor.built).map(reactor => {
          const { id, active, job, target } = reactor;
          const label = `${REACTORS[id - 1].roman} 级`;
          return <div className="work-line" key={id}>
            <div className="work-line-status"><strong>{label}</strong><span>{active ? `目标 ${element(target).symbol}` : '已暂停'}</span></div>
            <select aria-label={`${label}任务`} value={job} onChange={event => {
              const nextJob = event.target.value as ReactorJob;
              act(e => e.setReactorJob(id, nextJob));
            }}><option value="manual">手动控制</option><option value="explore">探索优先</option><option value="produce">指定生产</option><option value="archive">生产缺档样本</option></select>
            {job === 'produce' && <select aria-label={`${label}生产目标`} value={target} onChange={event => {
              const z = Number(event.target.value);
              act(e => e.setReactorJob(id, 'produce', z));
            }}>{options}</select>}
          </div>;
        })}
      </div>
    </div>}
  </div>;
}
