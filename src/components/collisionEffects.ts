import { useEffect, useRef } from 'react';

export type ImpactKind = 'pulse' | 'echo' | 'charged' | 'release' | 'discovery';
export type ReactorImpact = { serial: number; kind: ImpactKind; at: number; reactor?: number; bearing?: number; symbol?: string };

export function useCollisionSound(enabled: boolean) {
  const audio = useRef<AudioContext | null>(null);
  const last = useRef(0);

  useEffect(() => () => {
    if (audio.current) void audio.current.close().catch(() => {});
    audio.current = null;
  }, []);

  return (kind: ImpactKind) => {
    if (!enabled || !window.AudioContext) return;
    try {
      const context = audio.current ??= new AudioContext();
      const play = () => {
        if (audio.current !== context || context.state !== 'running') return;
        const now = context.currentTime;
        if (now - last.current < .038 && last.current > 0) return;
        last.current = now;
        const tone = (delay: number, high: number, low: number, length: number, volume: number) => {
          const start = now + delay;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(high, start);
          oscillator.frequency.exponentialRampToValueAtTime(low, start + length);
          gain.gain.setValueAtTime(volume, start);
          gain.gain.exponentialRampToValueAtTime(.001, start + length);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + length);
        };
        if (kind === 'echo') {
          tone(0, 410, 180, .1, .055);
          tone(.09, 580, 240, .15, .048);
        } else if (kind === 'charged' || kind === 'release') {
          tone(0, 610, 180, .16, .065);
          tone(.06, 360, 82, .21, .055);
        } else tone(0, 310, 105, .085, .038);
      };
      if (context.state === 'suspended') void context.resume().then(play).catch(() => {});
      else play();
    } catch {
      // The game remains playable when the browser cannot open an audio output.
    }
  };
}
