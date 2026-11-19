import { useLayoutEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { OpeningStep } from '../game/types';
import './opening-spotlight.css';

const steps = {
  start: { number: 1, title: '开始实验', detail: '点击高亮按钮，启动仪器积累碰撞能。' },
  sample: { number: 2, title: '补充氢样本', detail: '攒够 5 碰撞能后，点击高亮按钮购买一份样本。' },
  explore: { number: 3, title: '探索氦', detail: '点击高亮按钮。引导结束后，仪器将合成第一份氦。' },
} satisfies Record<OpeningStep, { number: number; title: string; detail: string }>;

export default function OpeningSpotlight({ step, onSkip }: { step: OpeningStep; onSkip: () => void }) {
  const [bounds, setBounds] = useState<DOMRect>();

  useLayoutEffect(() => {
    const target = document.querySelector<HTMLButtonElement>(`[data-opening-target="${step}"]`);
    const root = document.getElementById('root');
    if (!target || !root) return;

    const blocked = new Set<HTMLElement>();
    for (let node: HTMLElement | null = target; node && node !== root; node = node.parentElement) {
      for (const sibling of node.parentElement?.children ?? []) {
        if (sibling instanceof HTMLElement && sibling !== node && !sibling.inert) {
          sibling.inert = true;
          blocked.add(sibling);
        }
      }
    }

    const place = () => setBounds(target.getBoundingClientRect());
    const priorDescription = target.getAttribute('aria-describedby');
    target.setAttribute('aria-describedby', 'opening-note');
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
    target.focus({ preventScroll: true });
    place();
    const resize = new ResizeObserver(place);
    resize.observe(target);
    resize.observe(root);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    const keepTarget = (event: Event) => {
      if (event.target instanceof Node && !target.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onSkip();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        target.focus({ preventScroll: true });
      }
    };
    document.addEventListener('pointerdown', keepTarget, true);
    document.addEventListener('click', keepTarget, true);
    document.addEventListener('keydown', onKey, true);

    return () => {
      resize.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', keepTarget, true);
      document.removeEventListener('click', keepTarget, true);
      document.removeEventListener('keydown', onKey, true);
      if (priorDescription === null) target.removeAttribute('aria-describedby');
      else target.setAttribute('aria-describedby', priorDescription);
      for (const sibling of blocked) sibling.inert = false;
    };
  }, [step, onSkip]);

  if (!bounds) return null;
  const { number, title, detail } = steps[step];
  const style = {
    '--opening-x': `${bounds.left}px`, '--opening-y': `${bounds.top}px`,
    '--opening-width': `${bounds.width}px`, '--opening-height': `${bounds.height}px`,
    '--opening-center': `${bounds.left + bounds.width / 2}px`,
  } as CSSProperties;

  return createPortal(
    <div className="opening-spotlight" style={style}>
      <div className="opening-spotlight__ring" aria-hidden="true" />
      <section id="opening-note" className={`opening-spotlight__note${bounds.top < 145 ? ' opening-spotlight__note--below' : ''}`} aria-label="开局操作引导" aria-live="polite">
        <span>第 {number} 步 / 共 3 步</span>
        <h2>{title}</h2>
        <p>{detail}</p>
      </section>
    </div>,
    document.body,
  );
}
