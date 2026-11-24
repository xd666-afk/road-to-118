import { useState, type CSSProperties, type ReactNode } from 'react';
import { artworkUrl, reactorScene } from '../data/artwork';
import type { ReactorImpact } from './collisionEffects';
import './reactor-impact.css';

export default function ReactorScene({ id, impact, reduced, children }: {
  id: number; impact?: ReactorImpact; reduced: boolean; children: ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  const { file, aperture: { x, y, diameter } } = reactorScene(id);
  const viewport = { left: `${x}%`, top: `${y}%`, width: `${diameter}%` } satisfies CSSProperties;
  const visibleImpact = impact && (impact.reactor === undefined || impact.reactor === id) && Date.now() - impact.at < 950 ? impact : undefined;
  return <div className="scene-art">
    <div className="scene-frame">
      <img className="scene-image" src={artworkUrl(file)} alt="" draggable={false} fetchPriority="high"
        onLoad={() => setLoaded(true)}/>
      {loaded && <div className="scene-aperture" style={viewport}>
        {children}
        {visibleImpact && <div key={visibleImpact.serial} className="reactor-impact" data-kind={visibleImpact.kind}
          data-reduced={reduced} style={visibleImpact.bearing === undefined ? undefined : { rotate: `${visibleImpact.bearing}deg` }} aria-hidden="true">
          <i className="reactor-impact-particle"/>
          <i className="reactor-impact-particle"/>
          <i className="reactor-impact-light"/>
          <i className="reactor-impact-wave"/>
          {visibleImpact.symbol && <strong>{visibleImpact.symbol}</strong>}
        </div>}
      </div>}
      {loaded && visibleImpact && <i key={visibleImpact.serial} className="reactor-impact reactor-impact-halo"
        style={viewport} data-kind={visibleImpact.kind} data-reduced={reduced} aria-hidden="true"/>}
    </div>
  </div>;
}
