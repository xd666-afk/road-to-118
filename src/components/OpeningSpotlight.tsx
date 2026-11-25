import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Atom, Check } from 'lucide-react';
import './opening-spotlight.css';

export type SpotlightStep = {
  id: string;
  number: number;
  title: string;
  detail: string;
  target?: string;
  done?: string;
  status?: string;
  waiting?: boolean;
};

const HOLD_MS = 620;
const FADE_MS = 230;

export default function OpeningSpotlight({ step, total, reduced, onBegin, onSkip, onManageSaves, onFinish }: {
  step?: SpotlightStep;
  total: number;
  reduced: boolean;
  onBegin: () => void;
  onSkip: () => void;
  onManageSaves: () => void;
  onFinish: () => void;
}) {
  const [shown, setShown] = useState(step);
  const [fading, setFading] = useState(false);
  const [layout, setLayout] = useState<CSSProperties>();
  const primary = useRef<HTMLButtonElement>(null);
  const note = useRef<HTMLElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const saves = useRef<HTMLButtonElement>(null);
  const skipAction = useRef(onSkip);
  const pending = shown?.id !== step?.id;
  const current = pending ? shown : step;
  const id = current?.id;
  const targetSelector = current?.target;
  const waiting = current?.waiting;
  const transitionLock = useRef(false);

  useLayoutEffect(() => {
    transitionLock.current = pending;
    skipAction.current = onSkip;
  }, [pending, onSkip]);

  useEffect(() => {
    if (!pending) return;
    if (!shown) { setShown(step); return; }
    const fade = window.setTimeout(() => setFading(true), HOLD_MS);
    const advance = window.setTimeout(() => {
      setFading(false);
      setShown(step);
    }, HOLD_MS + (reduced ? 0 : FADE_MS));
    return () => { window.clearTimeout(fade); window.clearTimeout(advance); };
    // Dynamic progress text does not restart the transition.
  }, [pending, shown?.id, step?.id, reduced]);

  useLayoutEffect(() => {
    if (!id) return;
    const target = targetSelector ? document.querySelector<HTMLElement>(targetSelector) : primary.current;
    const root = document.getElementById('root');
    const hint = note.current;
    const blocked = new Set<HTMLElement>();
    const disable = (node: Element) => {
      if (node instanceof HTMLElement && !node.inert) {
        node.inert = true;
        blocked.add(node);
      }
    };

    if (target && root?.contains(target) && !waiting) {
      for (let node: HTMLElement | null = target; node && node !== root; node = node.parentElement) {
        for (const sibling of node.parentElement?.children ?? []) if (sibling !== node) disable(sibling);
      }
    } else if (root) disable(root);

    function place() {
      if (!targetSelector || !target?.isConnected || !hint) return;
      let bounds = target.getBoundingClientRect();
      const noteWidth = hint.offsetWidth;
      const noteHeight = hint.offsetHeight;
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const gutter = 10;
      const gap = 15;
      const roomAbove = noteHeight + gap + gutter;
      const fitsBeside = bounds.right + gap + noteWidth <= width - gutter || bounds.left - gap - noteWidth >= gutter;
      if (root?.contains(target) && bounds.top < roomAbove && !fitsBeside &&
        bounds.bottom + roomAbove > height && roomAbove + bounds.height < height - gutter) {
        const scrollTop = Math.max(0, window.scrollY + bounds.top - roomAbove);
        if (window.scrollY - scrollTop > 1) {
          window.scrollTo({ top: scrollTop, behavior: 'instant' });
          bounds = target.getBoundingClientRect();
        }
      }
      const within = (value: number, limit: number) => Math.max(gutter, Math.min(value, limit - gutter));
      let x = within(bounds.left + (bounds.width - noteWidth) / 2, width - noteWidth);
      let y = bounds.top - noteHeight - gap;
      if (y < gutter) {
        if (bounds.bottom + gap + noteHeight <= height - gutter) y = bounds.bottom + gap;
        else if (fitsBeside) {
          x = bounds.right + gap + noteWidth <= width - gutter ? bounds.right + gap : bounds.left - gap - noteWidth;
          y = within(bounds.top + (bounds.height - noteHeight) / 2, height - noteHeight);
        } else y = bounds.top > height - bounds.bottom ? gutter : height - noteHeight - gutter;
      }
      const next = {
        '--guide-x': `${bounds.left}px`, '--guide-y': `${bounds.top}px`,
        '--guide-width': `${bounds.width}px`, '--guide-height': `${bounds.height}px`,
        '--hint-x': `${x}px`, '--hint-y': `${y}px`,
      } as CSSProperties;
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }

    const previousDescription = target?.getAttribute('aria-describedby');
    if (targetSelector && target && hint) {
      target.setAttribute('aria-describedby', [previousDescription, 'opening-note-body'].filter(Boolean).join(' '));
      if (root?.contains(target)) target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    }
    const focusable = () => [waiting ? null : target, saves.current, skip.current].filter(
      (node): node is HTMLElement => !!node?.isConnected && !(node instanceof HTMLButtonElement && node.disabled),
    );
    focusable()[0]?.focus({ preventScroll: true });
    place();
    const observer = new ResizeObserver(place);
    if (target) observer.observe(target);
    if (hint) observer.observe(hint);
    if (root) observer.observe(root);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    // The practice item moves independently of the laboratory layout while falling.
    let frame = 0;
    if (id === 'drop' && !reduced) {
      let started: number | undefined;
      const track = (now: number) => {
        started ??= now;
        place();
        if (now - started < 1250) frame = requestAnimationFrame(track);
      };
      frame = requestAnimationFrame(track);
    }
    const flight = id === 'drop' ? target?.parentElement : undefined;
    const phaseObserver = flight && new MutationObserver(place);
    if (flight && phaseObserver) {
      phaseObserver.observe(flight, { attributes: true, attributeFilter: ['data-phase'] });
      flight.addEventListener('animationend', place);
    }

    const keepTarget = (event: Event) => {
      const node = event.target;
      if (!(node instanceof Node)) return;
      if (skip.current?.contains(node)) return;
      if (!transitionLock.current && ((!waiting && target?.contains(node)) || saves.current?.contains(node))) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        skipAction.current();
      } else if (event.key === 'Tab') {
        const options = focusable();
        const index = options.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        const next = index < 0 ? (event.shiftKey ? options.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + options.length) % options.length;
        options[next]?.focus({ preventScroll: true });
      } else if ((transitionLock.current || event.repeat) && (event.key === 'Enter' || event.key === ' ')) {
        if (document.activeElement !== skip.current) event.preventDefault();
      }
    };
    document.addEventListener('pointerdown', keepTarget, true);
    document.addEventListener('click', keepTarget, true);
    document.addEventListener('keydown', onKey, true);

    return () => {
      observer.disconnect();
      phaseObserver?.disconnect();
      flight?.removeEventListener('animationend', place);
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', keepTarget, true);
      document.removeEventListener('click', keepTarget, true);
      document.removeEventListener('keydown', onKey, true);
      if (targetSelector && target) {
        if (previousDescription) target.setAttribute('aria-describedby', previousDescription);
        else target.removeAttribute('aria-describedby');
      }
      for (const sibling of blocked) sibling.inert = false;
    };
  }, [id, targetSelector, waiting, reduced]);

  if (!current) return null;
  const welcome = current.id === 'welcome';
  const card = welcome || current.id === 'done';
  const done = pending && step ? current.done : undefined;
  const className = fading ? step ? ' opening-spotlight--switching' : ' opening-spotlight--closing' : '';
  return createPortal(
    <div className={`opening-spotlight${className}`} style={layout} data-step={current.id} data-reduced={reduced}>
      {card ? <div className="opening-spotlight__welcome-shade">
        <section className="opening-spotlight__welcome" role="dialog" aria-modal="true" aria-labelledby="opening-welcome-title" aria-describedby="opening-welcome-body">
          <div className="opening-spotlight__welcome-icon">{welcome ? <Atom size={24} aria-hidden="true"/> : <Check size={24} aria-hidden="true"/>}</div>
          <h2 id="opening-welcome-title">{current.title}</h2>
          <p id="opening-welcome-body">{current.detail}</p>
          <button ref={primary} type="button" className="primary-button" onClick={welcome ? onBegin : onFinish}>
            {welcome ? '开始引导' : '完成引导'}<ArrowRight size={16} aria-hidden="true"/>
          </button>
          {welcome && <div className="opening-spotlight__links">
            <button ref={saves} type="button" className="text-button" onClick={onManageSaves}>管理存档</button>
            <button ref={skip} type="button" className="text-button" onClick={onSkip}>跳过引导</button>
          </div>}
        </section>
      </div> : <>
        <div className="opening-spotlight__ring" aria-hidden="true"/>
        <section ref={note} id="opening-note" className="opening-spotlight__note" aria-label="新手实验引导">
          <div aria-live="polite">
            <span>第 {current.number} 步 / 共 {total} 步</span>
            <h2>{current.title}</h2>
            <p id="opening-note-body">{done ?? current.detail}</p>
          </div>
          {!done && current.status && <p className="opening-spotlight__status">{current.status}</p>}
          <button ref={skip} type="button" className="text-button" onClick={onSkip}>跳过引导</button>
        </section>
      </>}
      <div className="opening-spotlight__cover" aria-hidden="true"/>
    </div>,
    document.body,
  );
}
