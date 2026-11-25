import { ARCHIVE_UNITS } from '../game/config';
import { discoveredMax, type Engine } from '../game/engine';
import { discoveryStage, stageReadiness } from '../game/discovery';

export function discoverThrough(e: Engine, z: number) {
  const discoveries: number[] = [];
  for (let next = discoveredMax(e.state) + 1; next <= z; next++) {
    const previousNotice = e.state.noticeSeq;
    const stage = discoveryStage(next);
    if (!stage) {
      e.target(1, next);
      e.state.reactors[0].discoveryHazard = 0;
      e.step(e.state.discoveryWait + .1);
    } else {
      const status = stageReadiness(e.state, stage);
      if (!status.reactor.built) e.build(stage.reactor);
      if (status.capacity < stage.capacity) e.buy(stage.reactor, 'capacity', stage.capacity - status.capacity);
      const missingTuning = stage.tuning - status.reactor.upgrades.capacity - status.reactor.upgrades.yield;
      if (missingTuning > 0) e.buy(stage.reactor, 'yield', missingTuning);
      if (!status.calibrated) {
        const specimen = e.state.elements[stage.specimen - 1];
        const needed = ARCHIVE_UNITS - specimen.deposited;
        specimen.inventory = specimen.inventory.plus(needed);
        specimen.totalProduced = specimen.totalProduced.plus(needed);
        e.deposit(stage.specimen, true);
      }
      e.target(stage.reactor, next);
      e.step(120);
    }
    for (const notice of e.state.notices) {
      if (notice.id > previousNotice && notice.kind === 'discovery' && notice.z) discoveries.push(notice.z);
    }
  }
  return discoveries;
}
