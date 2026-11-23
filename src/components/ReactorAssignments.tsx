import { element } from '../data/elements';
import { REACTORS } from '../game/config';
import { experimentProduction } from '../game/experiments';
import { assignedToSample, SAMPLE_ROUTES } from '../game/sampleContract';
import type { GameState, ReactorState } from '../game/types';

function task(state: GameState, reactor: ReactorState) {
  const commission = experimentProduction(state, reactor);
  if (commission) return `委托供料 ${element(commission.offer.z).symbol} · ${commission.active.progress}/${commission.offer.goal}`;
  const sample = state.sampleContract;
  if (sample && !('answer' in sample) && assignedToSample(state, reactor)) {
    return reactor.id === sample.lead ? '分析异常样本' : `制备 ${SAMPLE_ROUTES[sample.route].symbol} 校准样本`;
  }
  const target = state.elements[reactor.target - 1];
  const symbol = element(reactor.target).symbol;
  if (target.discovered) return `生产 ${symbol}`;
  return `探索 ${symbol}${state.discoveryWait > 0 ? ` · 样本准备 ${Math.ceil(state.discoveryWait)} 秒` : ''}`;
}

export default function ReactorAssignments({ state }: { state: GameState }) {
  if (!state.reactors[1].built) return null;
  return <section className="panel reactor-assignments" aria-label="仪器分工">
    <h2>仪器分工</h2>
    <ul>{state.reactors.filter(r => r.built).map(r => <li key={r.id}>
      <strong>{REACTORS[r.id - 1].roman} 级</strong>
      <span>{!r.active && '已暂停 · '}{task(state, r)}</span>
    </li>)}</ul>
  </section>;
}
