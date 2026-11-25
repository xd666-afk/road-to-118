import { Database } from 'lucide-react';
import { format, type Amount } from '../game/numbers';
import { researchContribution } from '../game/projects';
import './research-funding.css';

export default function ResearchFunding({ name, balance, funded, cost, locked, onInvest }: {
  name: string;
  balance: Amount;
  funded: number;
  cost: number;
  locked?: string;
  onInvest: (limit?: number) => void;
}) {
  const available = researchContribution(balance, cost - funded);
  const portion = Math.ceil(cost / 4);
  return <div className="research-funding">
    <div className="research-funding-meter">
      <span><Database size={15} aria-hidden="true"/>科研投入</span>
      <strong title={`${funded.toLocaleString('zh-CN')} / ${cost.toLocaleString('zh-CN')}`}>{format(funded)} / {format(cost)}</strong>
    </div>
    <progress aria-label={name + '科研投入'} value={funded} max={cost}/>
    {locked ? <p className="research-funding-lock">{locked}</p> : <>
      <div className="research-funding-balance">可用科研点 <b>{format(balance)}</b></div>
      <div className="research-funding-actions">
        {available > portion && <button type="button" className="secondary-button"
          onClick={() => onInvest(portion)}>投入 {format(portion)}</button>}
        <button type="button" className="primary-button full" disabled={available === 0} onClick={() => onInvest()}>
          {available === 0 ? '等待科研点' : available === cost - funded ? `投入 ${format(available)} 完工` : `投入 ${format(available)} 科研点`}
        </button>
      </div>
    </>}
  </div>;
}
