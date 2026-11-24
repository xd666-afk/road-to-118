import { Database, Lightbulb, Zap } from 'lucide-react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { PULSE_BOOSTS, PULSE_DROP_WARNING_MS, type PulseBoost, type PulseDrop } from '../game/pulseBoosts';
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
  const now = Date.now();
  const remaining = drop ? drop.expiresAt - now : 0;
  const phase = remaining <= 0 ? 'retracting' : remaining <= PULSE_DROP_WARNING_MS ? 'warning' : 'available';
  return createPortal(<>
    {drop && DropIcon && <div key={drop.id}
      className={`pulse-drop-flight pulse-drop--${drop.kind}${drop.practice ? ' pulse-drop--practice' : ''}${reduced ? ' pulse-drop--static' : ''}`}
      style={{ '--drop-x': `${drop.x}%`, '--drop-y': `${drop.y}%` } as CSSProperties}
      data-phase={phase}>
      <button type="button" className="pulse-drop" data-guide-target={drop.practice ? 'drop' : undefined} disabled={phase === 'retracting'}
        aria-label={`拾取${PULSE_BOOSTS[drop.kind].name}`} onClick={() => onCollect(drop.id)}>
        <span className="pulse-drop-visual">
          <DropIcon size={20} aria-hidden="true"/><span>{PULSE_BOOSTS[drop.kind].name}</span>
        </span>
      </button>
    </div>}
    {boost && BoostIcon && <aside className={`pulse-boost pulse-drop--${boost.kind}`} aria-label="手动碰撞增益">
      <BoostIcon size={18} aria-hidden="true"/>
      <div><strong>{PULSE_BOOSTS[boost.kind].name}</strong><small>{PULSE_BOOSTS[boost.kind].description}</small></div>
      <time>{Math.max(0, Math.ceil((boost.expiresAt - now) / 1000))} 秒</time>
    </aside>}
  </>, document.body);
}
