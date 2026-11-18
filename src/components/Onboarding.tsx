import { ArrowRight, BookOpen, Check, X } from 'lucide-react';
import './onboarding.css';

export interface OnboardingProps {
  step: number;
  total: number;
  title: string;
  detail: string;
  actionLabel: string;
  canAct: boolean;
  onAction: () => void;
  onDismiss: () => void;
  onGuide: () => void;
}

export default function Onboarding(props: OnboardingProps) {
  const {
    step,
    total,
    title,
    detail,
    actionLabel,
    canAct,
    onAction,
    onDismiss,
    onGuide,
  } = props;

  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 1;
  const rawStep = Number.isFinite(step) ? Math.floor(step) : 0;
  const current = Math.min(Math.max(rawStep + 1, 1), safeTotal);
  const atEnd = rawStep + 1 > safeTotal;
  const progress = (current / safeTotal) * 100;

  return (
    <section className="nexus-coach" aria-label="新手实验引导">
      <div className="nexus-coach__head">
        <p className="nexus-coach__eyebrow">
          <span className="nexus-coach__eyebrow-label">新手实验</span>
          <span className="nexus-coach__counter">
            {current}/{safeTotal}
          </span>
        </p>
        <div
          className="nexus-coach__track"
          role="progressbar"
          aria-label="引导进度"
          aria-valuemin={0}
          aria-valuemax={safeTotal}
          aria-valuenow={current}
          aria-valuetext={`第 ${current} 步，共 ${safeTotal} 步`}
        >
          <span
            className="nexus-coach__fill"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      </div>

      <div className="nexus-coach__body">
        <div className="nexus-coach__text">
          <h2 className="nexus-coach__title">{title}</h2>
          <p className="nexus-coach__detail">{detail}</p>
        </div>

        <div className="nexus-coach__actions">
          <button
            type="button"
            className="nexus-coach__btn nexus-coach__btn--primary"
            aria-label={`引导操作：${actionLabel}`}
            disabled={!canAct}
            onClick={onAction}
          >
            <span className="nexus-coach__btn-label">{actionLabel}</span>
            {atEnd ? (
              <Check size={16} aria-hidden="true" className="nexus-coach__icon" />
            ) : (
              <ArrowRight size={16} aria-hidden="true" className="nexus-coach__icon" />
            )}
          </button>

          <button
            type="button"
            className="nexus-coach__btn nexus-coach__btn--ghost"
            onClick={onGuide}
          >
            <BookOpen size={16} aria-hidden="true" className="nexus-coach__icon" />
            <span className="nexus-coach__btn-label">完整教程</span>
          </button>

          <button
            type="button"
            className="nexus-coach__btn nexus-coach__btn--skip"
            onClick={onDismiss}
          >
            <X size={16} aria-hidden="true" className="nexus-coach__icon" />
            <span className="nexus-coach__btn-label">跳过引导</span>
          </button>
        </div>
      </div>
    </section>
  );
}
