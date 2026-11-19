import type { CSSProperties } from 'react';
import { ATOMIC_PROFILES } from '../data/atomic';
import type { ElementInfo } from '../data/elements';

/** Illustrative electron shells shown with the expanded science details. */
export default function AtomicSpecimen({ info }: { info: ElementInfo }) {
  const atom = ATOMIC_PROFILES[info.z];
  const shells = atom?.shells ?? [2, 8, 8, 2];
  return <div className="atomic-specimen" style={{ '--element': info.color } as CSSProperties}
    role="img" aria-label={`${info.name}原子的示意模型：${shells.map((n, i) => `第${i + 1}层${n}个电子`).join('，')}。仅用于游戏示意。`}>
    <div className="atomic-specimen-head"><span>{String(info.z).padStart(2, '0')}</span><small>ATOMIC SCHEMATIC</small></div>
    <div className="atomic-nucleus"><strong>{info.symbol}</strong><small>{info.z} p</small></div>
    {shells.slice(0, 5).map((count, index) => <span key={index} className={`atomic-orbit orbit-${index + 1}`} style={{ width: `${29 + index * 8}%` }}><i>{count}</i></span>)}
    <div className="atomic-specimen-foot"><span>{atom?.configuration ?? '电子排布示意'}</span><small>电子层与颜色为示意，不表示真实原子半径</small></div>
  </div>;
}
