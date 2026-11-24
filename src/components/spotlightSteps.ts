import { ARCHIVE_UNITS, MODULES, REACTORS } from '../game/config';
import { industryUpgradePrice } from '../game/experiments';
import { LAB_GUIDE_LENGTH, type LabGuideStep } from '../game/labGuide';
import type { GameState, OpeningStep } from '../game/types';
import type { SpotlightStep } from './OpeningSpotlight';

const target = (name: string) => `[data-guide-target="${name}"]`;
const chamber = '[data-opening-target="charge"]';
const openingSteps: Record<OpeningStep, Omit<SpotlightStep, 'id'>> = {
  start: { number: 1, target: '[data-opening-target="start"]', title: '启动反应容器', detail: '点击高亮的「开始实验」，让容器运转起来。', done: '仪器开始运行了。' },
  charge: { number: 2, target: chamber, title: '亲手触发碰撞', detail: '点击反应容器图片中的任意位置。每次碰撞都会给你碰撞能和研究数据，攒够 5 碰撞能即可补样。', done: '碰撞能已就绪。' },
  sample: { number: 3, target: '[data-opening-target="sample"]', title: '补充氢样本', detail: '点击购买按钮，用 5 碰撞能补充氢样本。更多样本能提高实验速度。', done: '已补充一份氢样本。' },
  explore: { number: 4, target: target('explore'), title: '合成第一份氦', detail: '点击「探索 He」，容器会改做氦实验。' },
};

export const SPOTLIGHT_LENGTH = Object.keys(openingSteps).length + LAB_GUIDE_LENGTH;

export function spotlightStep(state: GameState, lesson: LabGuideStep | undefined, tab: string, focus: number, practiceDrop: boolean, inspiration: boolean, shortfall: (coins: number, data: number) => string): SpotlightStep | undefined {
  const opening = state.firstRun;
  if (opening?.step === 'welcome') return {
    id: 'welcome', number: 0, title: '欢迎来到《通往118》',
    detail: '我是你的实验助手。跟着高亮的位置，从第一次碰撞开始，合成氦、建造仪器、收录第一个元素，再去看看加速大厅。',
  };
  if (opening?.step === 'helium' && !state.settings.guideDismissed) return {
    id: 'helium', number: 4, title: '正在合成氦', detail: '等容器完成这一次实验，氦的发现卡片就会出现。',
    target: chamber, waiting: true, status: `约 ${Math.ceil(opening.remaining)} 秒`,
  };
  if (opening && opening.step !== 'free' && opening.step !== 'helium') {
    return { id: opening.step, ...openingSteps[opening.step] };
  }
  if (!lesson) return;

  const base = { id: lesson.id, number: Math.min(SPOTLIGHT_LENGTH, 5 + lesson.step), title: lesson.title, detail: lesson.detail };
  const reactor = state.reactors[focus - 1];
  const first = state.reactors[0];
  const lab = tab === 'lab';
  const continueInLab = { ...base, id: `${lesson.id}-lab`, target: target('lab'), detail: '点击「实验室」，继续动手实验。' };
  const atChamber = reactor.active ? chamber : target('reactor-status');
  if (lesson.id === 'done') return { ...base, title: '新手引导完成', detail: '发现氖后，就能回到加速大厅建造东段。点击大厅左上角的返回箭头，继续在反应容器中探索。' };

  if (lesson.id === 'accelerator') {
    if (tab === 'accelerator') return {
      ...base, id: 'accelerator-sector', target: target('accelerator-ne'), title: '查看东段的施工条件',
      detail: '点击「Ne」查看东段需要的材料。发现氖后，攒够氖样本、碰撞能和研究数据就能建造。',
    };
    if (!lab) return continueInLab;
    return { ...base, target: target('accelerator-entry') };
  }

  if (lesson.id === 'pickup' || lesson.id === 'pulse') {
    if (!lab) return continueInLab;
    if (practiceDrop) return { ...base, id: 'drop', target: target('drop'), title: '拾取灵感点', detail: '点一下落下的灵感点。接下来 1 分钟内，手动碰撞获得的碰撞能和研究数据翻倍。', done: '已获得 1 分钟灵感。' };
    if (inspiration) return { ...base, id: 'pulse', target: atChamber, title: '用灵感触发碰撞', detail: reactor.active ? '再次点击容器，看看这次碰撞获得了多少资源。' : '先启动容器，再用灵感触发碰撞。', done: '这次碰撞获得了双倍收益。' };
    return { ...base, id: 'release-drop', target: target('release-drop'), title: '认识灵感点', detail: '点击「放出练习灵感点」，试试捡起屏幕上出现的限时增益。' };
  }

  if (lesson.id === 'be') {
    if (!lab) return continueInLab;
    const exploring = first.exploring && first.target > 2;
    if (!first.active) return { ...base, id: 'be-start', target: target('reactor-status'), detail: '先启动容器，再探索新的元素。' };
    if (exploring) return { ...base, id: 'be-wait', target: chamber, detail: '容器会依次尝试发现锂和铍。等结果时，可以点击容器积累建造资源。' };
    return { ...base, target: target('explore'), detail: '点击「探索」。容器会先尝试发现锂，再继续寻找铍。' };
  }

  if (lesson.id === 'archive') {
    if (!lab) return continueInLab;
    const hydrogen = state.elements[0];
    const remaining = ARCHIVE_UNITS - hydrogen.deposited;
    if (hydrogen.inventory.gte(remaining)) return { ...base, target: target('archive'), detail: '点击周期表里的氢（H），打开档案并提交样本。' };
    if (first.active && first.target === 1) return {
      ...base, id: 'archive-wait', target: atChamber, detail: 'I 级容器正在生产氢，库存够了就可以提交。等待时可以手动碰撞。',
      status: `氢库存 ${hydrogen.inventory.floor().toNumber()} / ${remaining}`,
    };
    return { ...base, id: 'archive-produce', target: target('produce-h'), detail: '点击「让 I 级生产氢」。自动反应开启后，容器会批量产出已发现的元素。' };
  }

  const cost = lesson.id === 'feed' ? MODULES.feed : lesson.id === 'build' ? { coins: REACTORS[1].buildCoins, data: REACTORS[1].buildData }
    : lesson.id === 'reaction' ? MODULES.reaction : industryUpgradePrice(state, 'reaction');
  const missing = cost && shortfall(cost.coins, cost.data);
  if (missing) {
    const step = { ...base, id: `${lesson.id}-funds`, title: `${lesson.title}前先备料`, status: `还差 ${missing}` };
    if (!lab) return { ...step, id: `${step.id}-lab`, target: target('lab'), detail: '点击「实验室」返回容器。' };
    return { ...step, target: atChamber, detail: reactor.active ? '点击反应容器积累碰撞能和研究数据。运行中的容器也会自动产出。' : '点击状态按钮，启动容器积累资源。' };
  }
  if (tab !== 'research') return { ...base, id: `${lesson.id}-research`, target: target('research'), detail: '材料已备齐。点击「科研」找到这项研发。' };
  const control = lesson.id === 'build' ? 'build' : lesson.id === 'feed' ? 'module-feed' : 'module-reaction';
  return { ...base, target: target(control) };
}
