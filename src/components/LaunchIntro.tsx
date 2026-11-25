import { useEffect, type CSSProperties } from 'react';
import qoderMark from './qoder-mark.png';
import './launch-intro.css';

const INTRO_SEEN = 'road-to-118.intro-seen';

export function shouldPlayIntro() {
  try {
    return sessionStorage.getItem(INTRO_SEEN) !== '1';
  } catch {
    return true;
  }
}

export function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_SEEN, '1');
  } catch {
    // A blocked storage session can still dismiss the intro.
  }
}

export default function LaunchIntro({ reduced, onFinish }: { reduced: boolean; onFinish: () => void }) {
  const duration = reduced ? 1250 : 3300;

  useEffect(() => {
    // CSS controls the reveal. The timer also releases the game if animation events are unavailable.
    const timeout = window.setTimeout(onFinish, duration + 120);
    function skip(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onFinish();
    }
    window.addEventListener('keydown', skip, true);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', skip, true);
    };
  }, [duration, onFinish]);

  return <section
    aria-label="游戏开场"
    className={`launch-intro${reduced ? ' launch-intro--reduced' : ''}`}
    style={{ '--intro-duration': `${duration}ms` } as CSSProperties}
    onAnimationEnd={event => { if (event.target === event.currentTarget) onFinish(); }}
  >
    <div className="launch-intro__collision" aria-hidden="true">
      <span className="launch-intro__atom launch-intro__atom--warm"/>
      <span className="launch-intro__atom launch-intro__atom--cool"/>
      <span className="launch-intro__beam"/>
      <span className="launch-intro__wave"/>
    </div>
    <div className="launch-intro__light" aria-hidden="true"/>
    <div className="launch-intro__credit" lang="en">
      <img src={qoderMark} width={304} height={304} alt=""/>
      <strong>Developed by Qoder</strong>
    </div>
    <button className="launch-intro__skip" type="button" onClick={onFinish}>跳过开场</button>
  </section>;
}
