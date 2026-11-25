import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { artworkUrl } from '../data/artwork';
import optics from '../data/campus-spectroscopy.mesh?url';
import separation from '../data/campus-separation.mesh?url';
import pulse from '../data/campus-pulse.mesh?url';
import geometry from '../data/campusGeometry.json';
import type { ProjectId } from '../game/projects';
import { createHallRenderer, loadHallMesh, type HallCamera } from './acceleratorRenderer';

const meshes = { spectroscopy: optics, separation, pulse };
const defaultCamera: HallCamera = { view: 'plan', yaw: 0, pitch: 0, zoom: 1 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function CampusModel({ id, built, name }: { id: ProjectId; built: number; name: string }) {
  const [renderer, setRenderer] = useState<'loading' | 'webgl' | 'photo'>('loading');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useRef({ ...defaultCamera });
  const stage = useRef(built);
  const repaint = useRef(() => {});
  const drag = useRef<{ id: number; x: number; y: number } | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const controller = new AbortController();
    let hall: ReturnType<typeof createHallRenderer> | undefined;
    let pending = 0;
    function schedule() {
      if (pending || controller.signal.aborted || !hall) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        hall?.draw({ camera: camera.current, built: stage.current, raised: 0, beam: -1 });
      });
    }
    function fallback(event?: Event) {
      event?.preventDefault();
      cancelAnimationFrame(pending);
      pending = 0;
      hall?.dispose();
      hall = undefined;
      setRenderer('photo');
    }
    const observer = new ResizeObserver(schedule);
    canvas.addEventListener('webglcontextlost', fallback);
    repaint.current = schedule;
    void loadHallMesh(meshes[id], controller.signal, geometry[id]).then(mesh => {
      if (controller.signal.aborted) return;
      hall = createHallRenderer(canvas, mesh, geometry[id], true);
      observer.observe(canvas);
      schedule();
      setRenderer('webgl');
    }).catch(() => { if (!controller.signal.aborted) fallback(); });
    return () => {
      controller.abort();
      cancelAnimationFrame(pending);
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', fallback);
      hall?.dispose();
    };
  }, [id]);

  useEffect(() => {
    stage.current = built;
    repaint.current();
  }, [built]);

  function orbit(yaw: number, pitch: number) {
    const view = camera.current;
    view.yaw += yaw;
    view.pitch = clamp(view.pitch + pitch, -.27, .47);
    repaint.current();
  }

  function zoom(ratio: number) {
    camera.current.zoom = clamp(camera.current.zoom * ratio, .66, 1.8);
    repaint.current();
  }

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const prior = drag.current;
    if (prior?.id !== event.pointerId) return;
    orbit((prior.x - event.clientX) * .006, (event.clientY - prior.y) * .005);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    switch (event.key) {
      case 'ArrowLeft': orbit(.12, 0); break;
      case 'ArrowRight': orbit(-.12, 0); break;
      case 'ArrowUp': orbit(0, .1); break;
      case 'ArrowDown': orbit(0, -.1); break;
      case '+': case '=': zoom(1.15); break;
      case '-': zoom(1 / 1.15); break;
      default: return;
    }
    event.preventDefault();
  }

  return <div className="campus-model" data-renderer={renderer} data-built={built}>
    <img className="campus-poster" src={artworkUrl(`campus-${id}-${built}.webp`)} alt={renderer === 'photo' ? name + '的当前施工外观' : ''}/>
    <canvas ref={canvasRef} tabIndex={renderer === 'webgl' ? 0 : -1} aria-label={name + '三维场景'}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onLostPointerCapture={() => { drag.current = undefined; }} onKeyDown={keyDown}/>
    {renderer === 'webgl' && <div className="campus-camera" role="group" aria-label="三维视角">
      <button type="button" className="scene-icon-button" aria-label="拉近视角" onClick={() => zoom(1.15)}><Plus size={18}/></button>
      <button type="button" className="scene-icon-button" aria-label="拉远视角" onClick={() => zoom(1 / 1.15)}><Minus size={18}/></button>
      <button type="button" className="scene-icon-button" aria-label="重置视角" onClick={() => { camera.current = { ...defaultCamera }; repaint.current(); }}><RotateCcw size={16}/></button>
    </div>}
  </div>;
}
