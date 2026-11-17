import { useEffect, useRef } from 'react';
import { element } from '../data/elements';
import { particleScale } from '../game/visuals';
interface Particle { x: number; y: number; vx: number; vy: number; z: number; }
export default function Particles({ count, mix, speed, reduced, active, flash }: { count: number; mix: number[]; speed: number; reduced: boolean; active: boolean; flash: number }) {
  const canvas = useRef<HTMLCanvasElement>(null), current = useRef({ count, mix, speed, reduced, active, flash });
  current.current = { count, mix, speed, reduced, active, flash };
  useEffect(() => {
    const el = canvas.current!, context = el.getContext('2d'); if (!context) return;
    const ctx: CanvasRenderingContext2D = context;
    let width = 320, frame = 0, last = 0, lastFlash = current.current.flash, pulse = 0;
    const particles: Particle[] = [];
    const resize = new ResizeObserver(entries => { width = entries[0].contentRect.width; particles.length = 0; const dpr = Math.min(2, window.devicePixelRatio || 1); el.width = width * dpr; el.height = width * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }); resize.observe(el);
    function draw(time: number) {
      const s = current.current, dt = Math.min(.035, (time - last) / 1000 || 0); last = time;
      const radius = width * .45, mid = width / 2, baseRadius = Math.max(7.5, Math.min(10, width / 26));
      const size = (z: number) => baseRadius * particleScale(z);
      const largest = Math.max(...s.mix.map(size));
      // Keep representative particles legible in small viewports; economic samples are independent.
      const visibleLimit = Math.min(60, Math.max(2, Math.floor(radius * radius / (largest * largest) * .32)));
      const n = Math.min(visibleLimit, Math.max(2, s.count));
      while (particles.length < n) {
        const z = s.mix[particles.length % s.mix.length] || 1, r = size(z);
        let x = 0, y = 0;
        for (let attempt = 0; attempt < 40; attempt++) {
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * Math.max(0, radius - r - 2);
          x = Math.cos(a) * d; y = Math.sin(a) * d;
          if (particles.every(p => Math.hypot(p.x - x, p.y - y) >= (r + size(p.z)) * 1.1)) break;
        }
        particles.push({ x, y, vx: (Math.random() - .5) * 45, vy: (Math.random() - .5) * 45, z });
      }
      particles.length = n;
      ctx.clearRect(0, 0, width, width);
      const glow = ctx.createRadialGradient(mid, mid, 0, mid, mid, radius); glow.addColorStop(0, 'rgba(99,143,163,.10)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, width, width);
      if (s.flash !== lastFlash) { pulse = 1; lastFlash = s.flash; }
      pulse *= .94;
      if (pulse > .02 && !s.reduced) { ctx.fillStyle = `rgba(224,184,121,${pulse * .17})`; ctx.beginPath(); ctx.arc(mid, mid, radius, 0, Math.PI * 2); ctx.fill(); }
      for (let i = 0; i < n; i++) {
        const p = particles[i]; p.z = s.mix[i % s.mix.length] || 1;
        const r = size(p.z);
        if (s.active && !s.reduced) { const v = Math.min(3, 1 + s.speed * .08); p.x += p.vx * dt * v; p.y += p.vy * dt * v;
          const dist = Math.hypot(p.x, p.y); if (dist > radius - r) { const nx = p.x / dist, ny = p.y / dist, dot = p.vx * nx + p.vy * ny; p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny; p.x = nx * (radius - r - 1); p.y = ny * (radius - r - 1); }
        }
        if (s.active && !s.reduced) for (let j = 0; j < i; j++) {
          const other = particles[j], dx = p.x - other.x, dy = p.y - other.y, distance = Math.hypot(dx, dy), contact = r + size(other.z);
          if (distance > 0 && distance < contact) {
            const nx = dx / distance, ny = dy / distance, approach = (p.vx - other.vx) * nx + (p.vy - other.vy) * ny;
            if (approach < 0) { p.vx -= approach * nx; p.vy -= approach * ny; other.vx += approach * nx; other.vy += approach * ny; }
            p.x += nx * (contact - distance) * .5; p.y += ny * (contact - distance) * .5;
            other.x -= nx * (contact - distance) * .5; other.y -= ny * (contact - distance) * .5;
            ctx.strokeStyle = 'rgba(229,192,128,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(mid + (p.x + other.x) / 2, mid + (p.y + other.y) / 2, r * 1.7, 0, Math.PI * 2); ctx.stroke();
          }
        }
        const x = mid + p.x, y = mid + p.y;
        const color = element(p.z).color;
        ctx.shadowColor = color; ctx.shadowBlur = 10;
        const sphere = ctx.createRadialGradient(x - r * .3, y - r * .35, 0, x, y, r); sphere.addColorStop(0, '#f5f7f5'); sphere.addColorStop(.28, color); sphere.addColorStop(1, '#18272d');
        ctx.fillStyle = sphere; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        const symbol = element(p.z).symbol;
        ctx.font = `600 ${r * (symbol.length > 1 ? 1.02 : 1.3)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(5,15,20,.95)'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
        ctx.strokeText(symbol, x, y, r * 1.65);
        ctx.fillStyle = '#f3f0e6'; ctx.fillText(symbol, x, y, r * 1.65);
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); };
  }, []);
  return <canvas ref={canvas} className="particle-canvas" aria-label={`代表性粒子示意；展示元素：${mix.map(z => element(z).symbol).join('、')}。粒子大小用于辨认，不表示真实原子半径。`} />;
}
