import { useState, type CSSProperties, type ReactNode } from 'react';
import { artworkUrl, reactorScene } from '../data/artwork';

export default function ReactorScene({ id, children }: { id: number; children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const { file, aperture: { x, y, diameter } } = reactorScene(id);
  const viewport = { left: `${x}%`, top: `${y}%`, width: `${diameter}%` } satisfies CSSProperties;
  return <div className="scene-art">
    <div className="scene-frame">
      <img className="scene-image" src={artworkUrl(file)} alt="" draggable={false} fetchPriority="high"
        onLoad={() => setLoaded(true)}/>
      {loaded && <div className="scene-aperture" style={viewport}>{children}</div>}
    </div>
  </div>;
}
