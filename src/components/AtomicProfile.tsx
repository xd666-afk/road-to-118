import { ATOMIC_PROFILES } from '../data/atomic';
import type { ElementInfo } from '../data/elements';
import { CALCIUM_ELEMENT } from '../game/config';
import AtomicSpecimen from './AtomicSpecimen';

export function AtomicFacts({ info, known }: { info: ElementInfo; known: boolean }) {
  const atom = known ? ATOMIC_PROFILES[info.z] : undefined;
  const facts = [
    { label: '原子序数', value: info.z }, { label: '质子数', value: info.z },
    { label: '电子数（中性）', value: info.z },
    ...(atom ? [
      { label: '中子数', value: atom.isotope - info.z, note: `${info.name}-${atom.isotope}` },
      { label: '相对原子质量', value: info.mass, note: '约值' },
      { label: '常温状态', value: atom.state, note: '20 °C' },
    ] : []),
  ];
  return <section className="atomic-profile" aria-label="原子档案">
    <dl className="atomic-facts">{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}{'note' in fact && <small>{fact.note}</small>}</dd></div>)}</dl>
    {atom && <div className="electron-structure"><div className="electron-configuration"><span>电子排布</span><strong>{atom.configuration}</strong></div><div className="electron-shells" aria-label={`电子层由内到外：${atom.shells.join('、')}`}><span>电子分层</span>{atom.shells.map((count, index) => <span className="shell-chip" key={index}><small>第 {index + 1} 层</small><b>{count}</b><i aria-hidden="true">{Array.from({ length: count }, (_, n) => <em key={n}/>)}</i></span>)}<small>最外层 {atom.shells.at(-1)} 个电子</small></div></div>}
  </section>;
}

export function FurtherScience({ info }: { info: ElementInfo }) {
  const atom = ATOMIC_PROFILES[info.z];
  if (!atom) return null;
  return <details className="further-science"><summary>更多科学资料</summary><div>
    <dl className="physical-facts"><div><dt>周期 / 族</dt><dd>第 {info.period} 周期 · 第 {atom.group} 族</dd></div><div><dt>{info.z === 6 ? '相变特性' : '熔点'}</dt><dd>{atom.melting}</dd></div><div><dt>{info.z === 6 ? '升华温度' : '沸点'}</dt><dd>{atom.boiling}</dd></div></dl>
    <p className="physical-note">相变数据为常压近似值；不同压力或物质结构可能改变相变条件。</p>
    <h4>同位素与中子</h4><p>同一种元素的质子数相同，同位素的中子数不同。{atom.isotopes}</p>
    <h4>在自然界中</h4><p>{atom.occurrence}</p>
    {info.z > CALCIUM_ELEMENT && <><h4>电子层示意</h4><AtomicSpecimen info={info}/></>}
  </div></details>;
}
