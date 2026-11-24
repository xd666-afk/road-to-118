import { Check, Cpu, Layers3, LockKeyhole, Zap } from 'lucide-react';
import { getElementAbility, type AbilityChannel } from '../game/elementAbilities';
import { isTechniqueElement, techniques } from '../game/pulseTechniques';
import './element-ability.css';

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

export default function ElementAbility({ z, archived }: { z: number; archived: boolean }) {
  const ability = getElementAbility(z);
  if (!ability) return null;

  const ChannelIcon = CHANNEL_ICON[ability.channel];
  const stage = archived ? 'active' : 'locked';

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
      {isTechniqueElement(z) && <p className="ea-description">
        <strong>{techniques[z].name}</strong> · {techniques[z].description}
      </p>}
      <footer className="ea-foot">
        <p className="ea-value"><strong>+{ability.percent}%</strong><span>{CHANNEL_LABEL[ability.channel]}增益</span></p>
        {archived ? (
          <span className="ea-state ea-state-active"><Check size={14} aria-hidden="true"/>已生效</span>
        ) : (
          <span className="ea-state ea-state-locked"><LockKeyhole size={14} aria-hidden="true"/>收录后生效</span>
        )}
      </footer>
    </section>
  );
}
