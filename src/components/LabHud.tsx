import type { CSSProperties, ReactNode } from 'react';
import { X } from 'lucide-react';

export function HudRing({ label, value, max, children }: {
  label?: string;
  value: number;
  max: number;
  children: ReactNode;
}) {
  return <span className="hud-ring" style={{ '--hud-progress': `${Math.max(0, Math.min(100, value / max * 100))}%` } as CSSProperties}>
    {children}
    {label && <progress className="sr-only" aria-label={label} value={value} max={max}/>}
  </span>;
}

export function LabDrawer({ title, children, onClose }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return <section id="experiment-drawer" className="scene-drawer" aria-label={`${title}面板`}>
    <header className="scene-drawer-head">
      <h2>{title}</h2>
      <button type="button" className="scene-icon-button" aria-label="关闭面板" onClick={onClose}><X size={20}/></button>
    </header>
    <div className="scene-drawer-content">{children}</div>
  </section>;
}
