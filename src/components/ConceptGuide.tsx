import { CircleHelp } from 'lucide-react';
import { CONCEPTS, type ConceptTopic } from '../data/concepts';
import { coinPerEvent, eventRate, income } from '../game/economy';
import { format } from '../game/numbers';
import type { ReactorState } from '../game/types';

export function MetricHelp({ topic, onOpen }: { topic: ConceptTopic; onOpen: (topic: ConceptTopic) => void }) {
  return <button className="metric-help" aria-label={`解释：${CONCEPTS[topic].title}`} onClick={() => onOpen(topic)}><CircleHelp size={14}/></button>;
}

export function IncomeFormula({ reactor, scientific }: { reactor: ReactorState; scientific: boolean }) {
  const fmt = (v: Parameters<typeof format>[0]) => format(v, scientific);
  return <div className="income-formula" aria-label="当前容器收入计算" data-testid="income-formula">
    <div><strong>{fmt(eventRate(reactor))}</strong><span>次实验/秒</span></div><b aria-hidden="true">×</b>
    <div><strong>{fmt(coinPerEvent(reactor))}</strong><span>碰撞能/次</span></div><b aria-hidden="true">≈</b>
    <div className="formula-result"><strong>{fmt(income(reactor))}</strong><span>碰撞能/秒</span></div>
  </div>;
}

export default function ConceptGuide({ topic, reactor, scientific, onSelect }: { topic: ConceptTopic | null; reactor: ReactorState; scientific: boolean; onSelect: (topic: ConceptTopic | null) => void }) {
  if (!topic) return <div className="concept-index"><p>总览看整个实验室，控制台看当前容器。点选一个指标查看含义和例子。</p><div className="concept-links">{(Object.keys(CONCEPTS) as ConceptTopic[]).map(key => <button className="secondary-button" key={key} onClick={() => onSelect(key)}>{CONCEPTS[key].title}<span aria-hidden="true">→</span></button>)}</div></div>;
  const content = CONCEPTS[topic];
  return <div className="concept-detail"><button className="text-button" onClick={() => onSelect(null)}>← 全部指标</button><p className="concept-summary">{content.summary}</p>{['energy', 'experiments', 'capacity'].includes(topic) && <><p className="formula-caption">当前 {['I', 'II', 'III'][reactor.id - 1]} 型容器 · 实时计算</p><IncomeFormula reactor={reactor} scientific={scientific}/></>}<ul>{content.points.map(point => <li key={point}>{point}</li>)}</ul></div>;
}
