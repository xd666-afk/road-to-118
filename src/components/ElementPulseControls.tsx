import { BatteryCharging, Check, Waves, Zap } from 'lucide-react';
import { ECHO_HITS, LITHIUM_CHARGE, TRIAL_LITHIUM_CHARGE, techniques, type TechniqueElement } from '../game/pulseTechniques';
import { HudRing } from './LabHud';

export type TechniqueTrial = { z: TechniqueElement; taps: number; complete: boolean };

interface Props {
  trial?: TechniqueTrial;
  echo?: number;
  lithium?: number;
  canRelease: boolean;
  releaseHint: string;
  onRelease: () => void;
  onChooseTarget?: () => void;
  onCloseTrial: () => void;
}

export default function ElementPulseControls(props: Props) {
  const { trial, echo, lithium, canRelease, releaseHint, onRelease, onChooseTarget, onCloseTrial } = props;
  if (trial) {
    const helium = trial.z === 2;
    const count = helium ? ECHO_HITS : TRIAL_LITHIUM_CHARGE;
    const info = techniques[trial.z];
    const unlocked = (helium ? echo : lithium) !== undefined;
    return <section className="scene-tech scene-tech-trial" aria-label={`${info.name}试用`}>
      <div className="scene-tech-chip">
        <HudRing label="试用进度" value={trial.taps} max={count}>
          {helium ? <Waves size={18} aria-hidden="true"/> : <BatteryCharging size={18} aria-hidden="true"/>}
        </HudRing>
        <div><strong>{info.name}</strong><small>{trial.taps}/{count} · {trial.complete ? '试用完成' : '试用'}</small></div>
      </div>
      <p>{trial.complete ? unlocked ? '已收录，可以在实验室继续使用。' : '累计提交 100 份后可永久使用。' : info.trial}</p>
      <div className="scene-tech-actions">
        {!helium && !trial.complete && <button type="button" className="scene-action" onClick={onRelease} disabled={!canRelease}>
          <Zap size={15}/>释放试用电芯
        </button>}
        <button type="button" className="scene-action" onClick={onCloseTrial}>
          {trial.complete && <Check size={15}/>}
          {trial.complete ? '继续实验' : '结束试用'}
        </button>
      </div>
    </section>;
  }
  if (echo === undefined && lithium === undefined) return null;
  return <section className="scene-tech" aria-label="碰撞能力">
    {echo !== undefined && <div className="scene-tech-chip" title={techniques[2].description}>
      <HudRing label="氦回波进度" value={echo} max={ECHO_HITS}><Waves size={17} aria-hidden="true"/></HudRing>
      <div><strong>氦回波</strong><small>{echo}/{ECHO_HITS}</small></div>
    </div>}
    {lithium !== undefined && <button type="button" className="scene-tech-chip scene-tech-battery" title={releaseHint}
      aria-label={onChooseTarget ? '选择蓄能样本目标' : '释放锂蓄能'} aria-description={releaseHint}
      disabled={!canRelease && !onChooseTarget} onClick={onChooseTarget ?? onRelease}>
      <HudRing label="锂蓄能进度" value={lithium} max={LITHIUM_CHARGE}><BatteryCharging size={17} aria-hidden="true"/></HudRing>
      <span><strong>锂蓄能</strong><small>{canRelease ? '释放样本' : onChooseTarget ? '选择目标' : `${lithium}/${LITHIUM_CHARGE}`}</small></span>
    </button>}
  </section>;
}
