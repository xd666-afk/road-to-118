import { useState } from 'react';
import { element } from '../data/elements';
import { REACTORS } from '../game/config';
import type { Engine } from '../game/engine';
import { SAMPLE_CLUES, SAMPLE_GUESS_BONUS, SAMPLE_ROUTES, sampleAnswer, sampleReady, type SampleAnswer, type SampleRoute } from '../game/sampleContract';
import type { GameState } from '../game/types';
import './sample-contract.css';

const deviceName = (id: number) => `${REACTORS[id - 1].roman} 级仪器`;
const routes = Object.keys(SAMPLE_ROUTES) as SampleRoute[];
const answers = [7, 8, 9] as const;
const rewardText = (route: SampleRoute) => `${SAMPLE_ROUTES[route].reward.toLocaleString('zh-CN')} ${SAMPLE_ROUTES[route].resource}`;

export default function SampleContract({ state, act }: {
  state: GameState;
  act: (change: (engine: Engine) => boolean) => boolean;
}) {
  const contract = state.sampleContract;
  const [support, setSupport] = useState(0);
  const [guess, setGuess] = useState<SampleAnswer>();
  const [open, setOpen] = useState(() => state.elements[7].discovered && (!state.elements[8].discovered || !!contract));
  if (!state.elements[7].discovered) return null;

  const active = state.reactors.filter(r => r.built && r.active);
  const lead = active.at(-1);
  const options = active.slice(0, -1);
  const selected = options.find(r => r.id === support) ?? options[0];

  return <details className="panel sample-contract" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>异常样本委托</summary>
    {!contract ? <div className="sample-contract-body">
      <p>一份样本的谱线出现异常。用主仪器分析，再让一台旧仪器制备校准样本。</p>
      {lead && selected ? <>
        <div className="sample-contract-assignment">
          <span>{deviceName(lead.id)}分析</span>
          <label>供料仪器 <select value={selected.id} onChange={event => setSupport(Number(event.target.value))}>
            {options.map(r => <option key={r.id} value={r.id}>{deviceName(r.id)}</option>)}
          </select></label>
        </div>
        <div className="sample-contract-choices">{routes.map(route =>
          <button className="secondary-button" key={route} onClick={() => act(engine => engine.startSampleContract(route, selected.id))}>
            <strong>{SAMPLE_ROUTES[route].name}</strong><small>{route === 'hydrogen' ? '供料较快' : '供料较慢'} · {rewardText(route)}</small>
          </button>
        )}</div>
      </> : <p>开启两台仪器即可接取。</p>}
    </div> : 'answer' in contract ? <div className="sample-contract-body" role="status">
      <p>样本确认是 <strong>{element(contract.answer).name}（{element(contract.answer).symbol}）</strong>。已领取 {rewardText(contract.route)}。
        {contract.guess === contract.answer ? `判断正确，额外获得 ${SAMPLE_GUESS_BONUS} 研究数据。` : `你的判断是${element(contract.guess).name}。 ${SAMPLE_CLUES[contract.answer]}`}</p>
    </div> : <div className="sample-contract-body">
      {sampleReady(contract) ? <>
        <p><strong>谱线已就绪</strong>。{SAMPLE_CLUES[sampleAnswer(state.seed)]}</p>
        <fieldset className="sample-contract-guess">
          <legend>判断样本是什么</legend>
          {answers.map(z => <label key={z}>
            <input type="radio" name="sample-guess" checked={guess === z} onChange={() => setGuess(z)}/>
            {element(z).name} {element(z).symbol}
          </label>)}
        </fieldset>
        <p>答对额外得 {SAMPLE_GUESS_BONUS} 研究数据。两台仪器已恢复各自的任务。</p>
      </> : <>
        <div className="sample-contract-progress">
          {[{ id: contract.support, progress: contract.supply, job: `制备 ${SAMPLE_ROUTES[contract.route].symbol} 校准样本`, label: '供料进度' },
            { id: contract.lead, progress: contract.scan, job: '分析异常样本', label: '分析进度' }].map(work =>
            <div key={work.id}>
              <span>{deviceName(work.id)} · {work.job}{!state.reactors[work.id - 1].active && '（已暂停）'}</span>
              <progress aria-label={work.label} max={1} value={work.progress}/>
              <small>{Math.floor(work.progress * 100)}%</small>
            </div>
          )}
        </div>
        <p>委托占用这两台仪器的合成任务，碰撞能和研究数据照常产出。</p>
      </>}
      <div className="sample-contract-actions">
        {sampleReady(contract) && <button className="primary-button" disabled={guess === undefined}
          onClick={() => { if (guess !== undefined) act(engine => engine.revealSampleContract(guess)); }}>确认样本</button>}
        <button className="text-button" onClick={() => { if (act(engine => engine.cancelSampleContract())) setGuess(undefined); }}>退出委托</button>
      </div>
    </div>}
  </details>;
}
