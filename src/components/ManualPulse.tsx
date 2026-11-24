import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import './manual-pulse.css';

export interface ManualPulseProps {
  /** 宿主是否允许手动碰撞。禁用时按钮不可触发，也不会展示任何收益。 */
  enabled: boolean;
  /** 宿主自己的“减少动态效果”设置；与系统 prefers-reduced-motion 取并集。 */
  reducedMotion: boolean;
  tutorialTarget?: boolean;
  /** 反应容器图片底部的短提示。 */
  label: string;
  /** 每次有效碰撞只调用一次；返回本次真实收益，无法结算时返回 null。 */
  onPulse: (bearing: number) => { energy: string; data: string; technique?: string } | null;
}

const COMBO_WINDOW = 900;
const MAX_EFFECTS = 12;
const FULL_LIFE = 900;
const REDUCED_LIFE = 300;

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return reduced;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function ManualPulse({ enabled, reducedMotion, tutorialTarget, label, onPulse }: ManualPulseProps) {
  const shell = useRef<HTMLDivElement>(null);
  const fxLayer = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLParagraphElement>(null);
  const comboBadge = useRef<HTMLSpanElement>(null);
  const contact = useRef<HTMLSpanElement>(null);
  const contactAnimation = useRef<Animation | null>(null);
  const combo = useRef({ count: 0, at: Number.NEGATIVE_INFINITY, timer: 0 });
  const timers = useRef(new Map<Element, number>());
  const systemReduced = useSystemReducedMotion();
  const reduced = reducedMotion || systemReduced;

  const hintId = 'manual-pulse-hint';
  const reducedId = 'manual-pulse-reduced';

  useEffect(() => {
    const pending = timers.current;
    const state = combo.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
      pending.clear();
      if (state.timer) window.clearTimeout(state.timer);
    };
  }, []);

  useEffect(() => {
    if (enabled) return;
    combo.current.count = 0;
    combo.current.at = Number.NEGATIVE_INFINITY;
    if (combo.current.timer) {
      window.clearTimeout(combo.current.timer);
      combo.current.timer = 0;
    }
    if (comboBadge.current) {
      comboBadge.current.textContent = '';
      comboBadge.current.classList.remove('is-on');
    }
    if (live.current) live.current.textContent = '';
  }, [enabled]);

  function press(event: ReactPointerEvent<HTMLButtonElement>) {
    const marker = contact.current;
    if (!enabled || !marker || !event.isPrimary || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    marker.style.left = `${event.clientX - rect.left}px`;
    marker.style.top = `${event.clientY - rect.top}px`;
    contactAnimation.current?.cancel();
    contactAnimation.current = marker.animate?.(
      [{ opacity: .92, scale: reduced ? 1 : .65 }, { opacity: 0, scale: reduced ? 1 : 1.65 }],
      { duration: 140, easing: 'ease-out' },
    ) ?? null;
  }

  function spawnEffect(x: number, y: number, rect: DOMRect, gain: NonNullable<ReturnType<ManualPulseProps['onPulse']>>, streak: number) {
    const host = fxLayer.current;
    if (!host) return;

    host.querySelector('.is-latest')?.classList.remove('is-latest');
    const group = document.createElement('div');
    group.className = `mp-fx-group is-latest${reduced ? ' is-reduced' : ''}`;
    group.style.left = `${x}px`;
    group.style.top = `${y}px`;
    group.style.setProperty('--mp-combo', String(Math.min(3, streak - 1)));
    const textInset = Math.min(58, rect.width / 2);
    const textX = clamp(x + ((streak % 3) - 1) * 8, textInset, rect.width - textInset);
    group.style.setProperty('--mp-text-x', `${textX - x}px`);
    group.style.setProperty('--mp-text-y', `${clamp(y, 12, Math.max(12, rect.height - 62)) - y}px`);

    const core = document.createElement('i');
    core.className = 'mp-core';
    group.append(core);

    const ring = document.createElement('i');
    ring.className = 'mp-ring';
    group.append(ring);

    const echo = document.createElement('i');
    echo.className = 'mp-ring mp-ring--echo';
    group.append(echo);

    const sparks = document.createElement('span');
    sparks.className = 'mp-sparks';
    for (let i = 0; i < 8; i += 1) {
      const spark = document.createElement('i');
      spark.style.setProperty('--a', `${i * 45 + (i % 2) * 7}deg`);
      sparks.append(spark);
    }
    group.append(sparks);

    const gains = document.createElement('span');
    gains.className = 'mp-gains';
    const energy = document.createElement('b');
    energy.className = 'mp-gain mp-gain--energy';
    energy.textContent = `+${gain.energy} 碰撞能`;
    const data = document.createElement('b');
    data.className = 'mp-gain mp-gain--data';
    data.textContent = `+${gain.data} 数据`;
    gains.append(energy, data);
    if (gain.technique) {
      const special = document.createElement('b');
      special.className = 'mp-gain mp-gain--technique';
      special.textContent = gain.technique;
      gains.prepend(special);
    }
    group.append(gains);

    host.append(group);
    while (host.childElementCount > MAX_EFFECTS && host.firstElementChild) {
      const oldest = host.firstElementChild;
      window.clearTimeout(timers.current.get(oldest));
      timers.current.delete(oldest);
      oldest.remove();
    }

    const timer = window.setTimeout(() => {
      group.remove();
      timers.current.delete(group);
    }, reduced ? REDUCED_LIFE : FULL_LIFE);
    timers.current.set(group, timer);
  }

  function pulse(event: ReactMouseEvent<HTMLButtonElement>) {
    if (!enabled) return;
    const rect = shell.current?.getBoundingClientRect();
    if (!rect) return;
    const keyboard = event.detail === 0;
    const point = keyboard ? { x: rect.width / 2, y: rect.height / 2 } : {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
    };

    // 每个有效激活只调用一次；收益完全以宿主返回值为准。
    const bearing = Math.atan2(point.y - rect.height / 2, point.x - rect.width / 2) * 180 / Math.PI;
    const gain = onPulse(bearing);
    if (!gain) return;

    const now = performance.now();
    const state = combo.current;
    state.count = now - state.at <= COMBO_WINDOW ? state.count + 1 : 1;
    state.at = now;
    if (state.timer) window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      state.count = 0;
      state.at = Number.NEGATIVE_INFINITY;
      state.timer = 0;
      if (comboBadge.current) {
        comboBadge.current.textContent = '';
        comboBadge.current.classList.remove('is-on');
      }
    }, COMBO_WINDOW + 120);
    if (comboBadge.current && state.count > 1) {
      comboBadge.current.textContent = `${state.count} 连击`;
      comboBadge.current.classList.add('is-on');
    }

    if (live.current) {
      live.current.textContent = `碰撞 +${gain.energy} 碰撞能，+${gain.data} 数据。${gain.technique ?? ''}`;
    }

    spawnEffect(point.x, point.y, rect, gain, state.count);
  }

  const describedBy = reduced ? `${hintId} ${reducedId}` : hintId;

  return <div
    ref={shell}
    className={`manual-pulse${enabled ? '' : ' is-disabled'}${reduced ? ' is-reduced' : ''}`}
    data-reduced-motion={reduced ? 'true' : 'false'}
  >
    <button
      type="button"
      className="manual-pulse__hit"
      aria-label="手动碰撞"
      aria-describedby={describedBy}
      data-opening-target={tutorialTarget ? 'charge' : undefined}
      disabled={!enabled}
      onKeyDown={event => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
      }}
      onPointerDown={press}
      onClick={pulse}
    >
      <span className="mp-hint" id={hintId}>
        <i className="mp-hint-dot" aria-hidden="true"/>
        <span className="mp-hint-label">{label}</span>
        <span ref={comboBadge} className="mp-combo" aria-hidden="true"/>
      </span>
    </button>
    <span ref={contact} className="mp-contact" aria-hidden="true"/>
    <div ref={fxLayer} className="mp-fx" aria-hidden="true"/>
    <p ref={live} className="mp-sr" aria-live="polite" aria-atomic="true"/>
    {reduced && <span id={reducedId} className="mp-sr">已根据减少动态效果偏好简化碰撞特效。</span>}
  </div>;
}
