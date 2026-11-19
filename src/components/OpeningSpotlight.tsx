import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Atom } from 'lucide-react';
import type { OpeningStep } from '../game/types';
import './opening-spotlight.css';

const steps: Record<OpeningStep, { number: number; title: string; detail: string; done?: string }> = {
  start: { number: 1, title: '开始实验', detail: '点击高亮按钮，启动仪器积累碰撞能。', done: '仪器开始运行了。' },
  charge: { number: 2, title: '手动触发碰撞', detail: '点击高亮的观察窗，立刻获得碰撞能。攒到 5 后，就可以补充一份氢样本。', done: '碰撞能已就绪。' },
  sample: { number: 3, title: '补充氢样本', detail: '点击高亮按钮，花 5 碰撞能购买一份样本。', done: '已补充一份氢样本。' },
  explore: { number: 4, title: '探索氦', detail: '点击高亮按钮。引导结束后，仪器将合成第一份氦。' },
};

type GuideStep = 'welcome' | OpeningStep;
const HOLD_MS = 650;
const FADE_MS = 250;

export default function OpeningSpotlight({ step, onBegin, onSkip }: { step?: GuideStep; onBegin: () => void; onSkip: () => void }) {
  const [bounds, setBounds] = useState<DOMRect>();
  const [shown, setShown] = useState(step);
  const [fading, setFading] = useState(false);
  const welcomeButton = useRef<HTMLButtonElement>(null);
  const transitionLock = useRef(false);
  const pending = shown !== step;

  useLayoutEffect(() => { transitionLock.current = pending; }, [pending]);

  useEffect(() => {
    if (!pending) return;
    if (!shown) { setShown(step); return; }
    const fade = window.setTimeout(() => setFading(true), HOLD_MS);
    const advance = window.setTimeout(() => {
      setFading(false);
      setShown(step);
    }, HOLD_MS + FADE_MS);
    return () => { window.clearTimeout(fade); window.clearTimeout(advance); };
  }, [pending, shown, step]);

  useLayoutEffect(() => {
    if (!shown) return;
    const welcome = shown === 'welcome';
    const target = welcome ? welcomeButton.current : document.querySelector<HTMLButtonElement>(`[data-opening-target="${shown}"]`);
    const root = document.getElementById('root');
    if (!target || !root) return;

    const blocked = new Set<HTMLElement>();
    const disable = (node: Element) => {
      if (node instanceof HTMLElement && !node.inert) {
        node.inert = true;
        blocked.add(node);
      }
    };
    if (welcome) disable(root);
    else for (let node: HTMLElement | null = target; node && node !== root; node = node.parentElement) {
      for (const sibling of node.parentElement?.children ?? []) if (sibling !== node) disable(sibling);
    }

    const place = () => setBounds(target.getBoundingClientRect());
    const priorDescription = target.getAttribute('aria-describedby');
    if (!welcome) {
      target.setAttribute('aria-describedby', 'opening-note');
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    target.focus({ preventScroll: true });
    place();
    const resize = new ResizeObserver(place);
    resize.observe(target);
    resize.observe(root);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    const keepTarget = (event: Event) => {
      if (transitionLock.current || (event.target instanceof Node && !target.contains(event.target))) {
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
      } else if ((transitionLock.current || event.repeat) && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
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
  }, [shown, onSkip]);

  if (!shown) return null;
  const welcome = shown === 'welcome';
  const lesson = welcome ? undefined : steps[shown];
  const done = pending && step ? lesson?.done : undefined;
  const style = bounds && {
    '--opening-x': `${bounds.left}px`, '--opening-y': `${bounds.top}px`,
    '--opening-width': `${bounds.width}px`, '--opening-height': `${bounds.height}px`,
    '--opening-center': `${bounds.left + bounds.width / 2}px`,
  } as CSSProperties;

  return createPortal(
    <div className={`opening-spotlight${fading ? step ? ' opening-spotlight--switching' : ' opening-spotlight--closing' : ''}`} style={style}>
      {welcome ? <div className="opening-spotlight__welcome-shade">
        <section className="opening-spotlight__welcome" role="dialog" aria-modal="true" aria-labelledby="opening-welcome-title" aria-describedby="opening-welcome-body">
          <div className="opening-spotlight__welcome-icon"><Atom size={24} aria-hidden="true" /></div>
          <h2 id="opening-welcome-title">欢迎来到《通往118》</h2>
          <p id="opening-welcome-body">我是你的实验助手。在这里，你会从氢出发，逐步发现和收录更多元素。先跟我一起合成第一份氦吧。</p>
          <button ref={welcomeButton} type="button" className="primary-button" onClick={onBegin}>开始引导<ArrowRight size={16} aria-hidden="true" /></button>
        </section>
      </div> : bounds && lesson && <>
        <div className="opening-spotlight__ring" aria-hidden="true" />
        <section id="opening-note" className={`opening-spotlight__note${bounds.top < 145 ? ' opening-spotlight__note--below' : ''}`} aria-label="开局操作引导" aria-live="polite">
          <span>第 {lesson.number} 步 / 共 4 步</span>
          <h2>{lesson.title}</h2>
          <p>{done ?? lesson.detail}</p>
        </section>
      </>}
      <div className="opening-spotlight__cover" aria-hidden="true" />
    </div>,
    document.body,
  );
}
