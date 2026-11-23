import { useState } from 'react';
import { element } from '../data/elements';
import { REACTORS } from '../game/config';
import type { Engine } from '../game/engine';
import { availableIndustryUpgrade, INDUSTRY_DISCOUNT, isOfferAvailable, type ExperimentOffer } from '../game/experiments';
import { format } from '../game/numbers';
import { assignedToSample } from '../game/sampleContract';
import type { GameState } from '../game/types';
import './experiment-board.css';

function objective(offer: ExperimentOffer) {
  if (offer.kind === 'pulse') return `完成 ${offer.goal} 次手动碰撞`;
  if (offer.kind === 'archive') return `提交 ${offer.goal} 份${element(offer.z).name}至档案`;
  return `用 ${REACTORS[offer.reactor - 1].roman} 级仪器生产 ${offer.goal} 份${element(offer.z).name}`;
}

function reward({ reward }: ExperimentOffer, canReceiveCoupon: boolean) {
  if (reward.kind === 'discount' && canReceiveCoupon) return `下次工业升级费用减免 ${INDUSTRY_DISCOUNT}%`;
  return `${format(reward.amount)} ${reward.kind === 'energy' ? '碰撞能' : '研究数据'}`;
}

export default function ExperimentBoard({ state, act, openElement, focusReactor }: {
  state: GameState;
  act: (change: (engine: Engine) => boolean) => boolean;
  openElement: (z: number) => void;
  focusReactor: (id: number) => void;
}) {
  const board = state.experimentBoard;
  const [open, setOpen] = useState(() => !!board?.active);
  if (!board) return null;
  const { active } = board;
  const offer = active && board.offers[active.index];
  const fulfilled = !!active && !!offer && active.progress >= offer.goal;
  const canReceiveCoupon = !board.coupon && availableIndustryUpgrade(state);
  const busy = offer?.kind === 'production' && assignedToSample(state, state.reactors[offer.reactor - 1]);
  return <details className="panel experiment-board" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>试验委托 <small>{fulfilled ? '待领奖' : active ? '进行中' : board.cooldown ? '下轮准备中' : `第 ${board.round} 轮`}</small></summary>
    <div className="experiment-board-body">
      {board.coupon && <p className="experiment-coupon">持有工业升级券 · 下次升级减免 {INDUSTRY_DISCOUNT}%</p>}
      {offer && active ? <>
        <div className="experiment-board-header">
          <strong>{objective(offer)}</strong>
          <span>{fulfilled ? '已完成' : `剩余 ${Math.ceil(active.remaining)} 秒`}</span>
        </div>
        <div className="experiment-progress">
          <progress aria-label="委托进度" max={offer.goal} value={active.progress}/>
          <span>{active.progress}/{offer.goal}</span>
        </div>
        <p>奖励 {reward(offer, canReceiveCoupon)}</p>
        <div className="experiment-board-actions">
          {fulfilled ? <button className="primary-button" onClick={() => act(engine => engine.claimExperiment())}>领取奖励</button> : <>
            {offer.kind === 'archive' && <button className="secondary-button" onClick={() => openElement(offer.z)}>打开元素档案</button>}
            {offer.kind === 'production' && <button className="secondary-button" disabled={busy} onClick={() => {
              if (act(engine => engine.prepareExperimentProduction())) focusReactor(offer.reactor);
            }}>{busy ? '仪器正在分析异常样本' : '设为生产目标'}</button>}
            <button className="text-button" onClick={() => act(engine => engine.cancelExperiment())}>放弃委托</button>
          </>}
        </div>
      </> : board.cooldown ? <p role="status">
        {board.result === 'claimed' ? '奖励已领取。' : board.result === 'expired' ? '本轮已到期。' : '已放弃本轮。'}
        下一轮还有 {Math.ceil(board.cooldown)} 秒。
      </p> : <>
        <p>任选一项，限时 120 秒。离开游戏时暂停计时，自动作业照常计入进度。</p>
        <div className="experiment-offers">{board.offers.map((item, i) => {
          const available = isOfferAvailable(state, item);
          return <button className="secondary-button" key={item.kind} disabled={!available} onClick={() => act(engine => engine.startExperiment(i))}>
            <strong>{objective(item)}</strong>
            <small>{available ? `奖励 ${reward(item, canReceiveCoupon)}` : '档案剩余可提交量不足'}</small>
          </button>;
        })}</div>
      </>}
    </div>
  </details>;
}
