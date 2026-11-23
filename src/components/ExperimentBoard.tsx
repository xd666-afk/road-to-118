import { useState } from 'react';
import { element } from '../data/elements';
import { REACTORS } from '../game/config';
import type { Engine } from '../game/engine';
import { availableIndustryUpgrade, EXPERIMENT_SECONDS, INDUSTRY_DISCOUNT, isOfferAvailable, productionPlans, type ExperimentOffer } from '../game/experiments';
import { format } from '../game/numbers';
import type { GameState } from '../game/types';
import './experiment-board.css';

function objective(offer: ExperimentOffer) {
  if (offer.kind === 'pulse') return `完成 ${offer.goal} 次手动碰撞`;
  if (offer.kind === 'archive') return `提交 ${offer.goal} 份${element(offer.z).name}至档案`;
  return `交付 ${offer.goal} 份${element(offer.z).name}样本`;
}

function reward({ reward }: ExperimentOffer, canReceiveCoupon: boolean) {
  if (reward.kind === 'discount' && canReceiveCoupon) return `下次工业升级费用减免 ${INDUSTRY_DISCOUNT}%`;
  return `${format(reward.amount)} ${reward.kind === 'energy' ? '碰撞能' : '研究数据'}`;
}

export default function ExperimentBoard({ state, act, openElement }: {
  state: GameState;
  act: (change: (engine: Engine) => boolean) => boolean;
  openElement: (z: number) => void;
}) {
  const board = state.experimentBoard;
  const [open, setOpen] = useState(() => !!board?.active);
  if (!board) return null;
  const { active } = board;
  const offer = active && board.offers[active.index];
  const fulfilled = !!active && !!offer && active.progress >= offer.goal;
  const canReceiveCoupon = !board.coupon && availableIndustryUpgrade(state);
  return <details className="panel experiment-board" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>试验委托 <small>{fulfilled ? '待领奖' : active ? '进行中' : board.cooldown ? '下轮准备中' : `第 ${board.round} 轮`}</small></summary>
    <div className="experiment-board-body">
      {board.coupon && <p className="experiment-coupon">持有工业升级券 · 下次升级减免 {INDUSTRY_DISCOUNT}%</p>}
      {board.delivery && <p className="experiment-delivery">上次交付 · {REACTORS[board.delivery.reactor - 1].roman} 级仪器交付了 {board.delivery.count} 份{element(board.delivery.z).name}。</p>}
      {offer && active ? <>
        <div className="experiment-board-header">
          <strong>{objective(offer)}</strong>
          <span>{fulfilled ? '已完成' : `剩余 ${Math.ceil(active.remaining)} 秒`}</span>
        </div>
        <div className="experiment-progress">
          <progress aria-label="委托进度" max={offer.goal} value={active.progress}/>
          <span>{active.progress}/{offer.goal}</span>
        </div>
        {offer.kind === 'production' && active.reactor && <p>{REACTORS[active.reactor - 1].roman} 级仪器
          {fulfilled ? `已交付 ${active.progress} 份${element(offer.z).name}，已恢复原任务。`
            : state.reactors[active.reactor - 1].active ? '正在执行生产委托。' : '已暂停，恢复运行后继续供料。'}</p>}
        <p>奖励 {reward(offer, canReceiveCoupon)}</p>
        <div className="experiment-board-actions">
          {fulfilled ? <button className="primary-button" onClick={() => act(engine => engine.claimExperiment())}>领取奖励</button> : <>
            {offer.kind === 'archive' && <button className="secondary-button" onClick={() => openElement(offer.z)}>打开元素档案</button>}
            <button className="text-button" onClick={() => act(engine => engine.cancelExperiment())}>放弃委托</button>
          </>}
        </div>
      </> : board.cooldown ? <p role="status">
        {board.result === 'claimed' ? '奖励已领取。' : board.result === 'expired' ? '本轮已到期。' : '已放弃本轮。'}
        下一轮还有 {Math.ceil(board.cooldown)} 秒。
      </p> : <>
        <p>任选一项，限时 120 秒。离开游戏时暂停计时，自动作业照常计入进度。</p>
        <div className="experiment-offers">{board.offers.map((item, i) => {
          if (item.kind === 'production') return <div className="experiment-production-offer" key={item.kind}>
            <strong>{objective(item)}</strong>
            <small>样本直接交付 · 奖励 {reward(item, canReceiveCoupon)}</small>
            <div className="experiment-plans">{productionPlans(state, item).map(plan =>
              <button className="secondary-button" key={plan.kind} disabled={!plan.enabled} onClick={() => act(engine => engine.startExperiment(i, plan.reactor.id))}>
                <strong>{plan.kind === 'lead' ? '主仪器转产' : '旧仪器供料'} · {REACTORS[plan.reactor.id - 1].roman} 级</strong>
                <small>{plan.seconds === undefined ? plan.reactor.active ? '仪器忙碌' : '仪器已暂停'
                  : `约 ${plan.seconds} 秒${plan.seconds > EXPERIMENT_SECONDS ? ' · 可能超时' : ''}`}
                  {plan.kind === 'support' && plan.enabled && ' · 主仪器继续原任务'}</small>
              </button>
            )}</div>
          </div>;
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
