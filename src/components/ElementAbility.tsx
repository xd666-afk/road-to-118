import { Check, Cpu, Layers3, LockKeyhole, Sparkles, Zap } from 'lucide-react';
import { getElementAbility, type AbilityChannel } from '../game/elementAbilities';
import './element-ability.css';

export interface ElementAbilityProps {
  z: number;
  /** 该元素是否已收录（档案永久点亮）。 */
  archived: boolean;
  /** 该能力是否已被宿主激活。 */
  active: boolean;
  /** 宿主负责写入存档、校验上限并应用到引擎。 */
  onActivate: () => void;
}

const CHANNEL_LABEL: Record<AbilityChannel, string> = {
  energy: '碰撞能',
  data: '研究数据',
  production: '元素产出',
};

const CHANNEL_ICON = {
  energy: Zap,
  data: Cpu,
  production: Layers3,
} as const;

export default function ElementAbility({ z, archived, active, onActivate }: ElementAbilityProps) {
  const ability = getElementAbility(z);
  if (!ability) return null;

  const ChannelIcon = CHANNEL_ICON[ability.channel];
  const stage = active ? 'active' : archived ? 'ready' : 'locked';

  return (
    <section className={`element-ability ea-${stage}`} data-stage={stage} aria-label={`${ability.name} · 元素能力`}>
      <header className="ea-head">
        <span className="ea-index" aria-hidden="true">{String(z).padStart(2, '0')}</span>
        <div className="ea-identity">
          <span className="ea-eyebrow">ELEMENT ABILITY</span>
          <h3 className="ea-name">{ability.name}</h3>
        </div>
        <span className="ea-channel">
          <ChannelIcon size={12} aria-hidden="true"/>
          {CHANNEL_LABEL[ability.channel]}
        </span>
      </header>
      <p className="ea-description">{ability.description}</p>
      <footer className="ea-foot">
        {active ? (
          <p className="ea-value" aria-live="polite">
            <strong>+{ability.percent}%</strong>
            <span>{CHANNEL_LABEL[ability.channel]}增益</span>
          </p>
        ) : (
          <p className="ea-hint">
            {archived ? <>能力已就绪，激活后计入实验室。</> : <><LockKeyhole size={11} aria-hidden="true"/>收录后可激活</>}
          </p>
        )}
        {active ? (
          <span className="ea-state ea-state-active"><Check size={14} aria-hidden="true"/>已激活</span>
        ) : archived ? (
          <button type="button" className="ea-activate" onClick={onActivate}>
            激活能力
            <Sparkles size={14} aria-hidden="true"/>
          </button>
        ) : (
          <span className="ea-state ea-state-locked"><LockKeyhole size={14} aria-hidden="true"/>未点亮</span>
        )}
      </footer>
    </section>
  );
}
