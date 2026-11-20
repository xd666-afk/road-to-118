import { Database, Lightbulb, Zap } from 'lucide-react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { PULSE_BOOSTS, type PulseBoost, type PulseDrop } from '../game/pulseBoosts';
import './pulse-drops.css';

const icons = { inspiration: Lightbulb, energy: Zap, data: Database };

export default function PulseDrops({ drop, boost, reduced, onCollect }: {
  drop?: PulseDrop;
  boost?: PulseBoost;
  reduced: boolean;
  onCollect: (id: number) => void;
}) {
  const DropIcon = drop && icons[drop.kind];
  const BoostIcon = boost && icons[boost.kind];
  return createPortal(<>
    {drop && DropIcon && <button key={drop.id} type="button"
      className={`pulse-drop pulse-drop--${drop.kind}${drop.practice ? ' pulse-drop--practice' : ''}${reduced ? ' pulse-drop--static' : ''}`}
      style={{ '--drop-x': `${drop.x}%`, '--drop-y': `${drop.y}%` } as CSSProperties}
      aria-label={`拾取${PULSE_BOOSTS[drop.kind].name}`} onClick={() => onCollect(drop.id)}>
      <DropIcon size={20} aria-hidden="true"/><span>{PULSE_BOOSTS[drop.kind].name}</span>
    </button>}
    {boost && BoostIcon && <aside className={`pulse-boost pulse-drop--${boost.kind}`} aria-label="手动碰撞增益">
      <BoostIcon size={18} aria-hidden="true"/>
      <div><strong>{PULSE_BOOSTS[boost.kind].name}</strong><small>{PULSE_BOOSTS[boost.kind].description}</small></div>
      <time>{Math.max(0, Math.ceil((boost.expiresAt - Date.now()) / 1000))} 秒</time>
    </aside>}
  </>, document.body);
}
