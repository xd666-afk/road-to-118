import { ARCHIVE_UNITS, MODULES, MODULE_UPGRADES, REACTORS } from './config';
import { archivedCount, discoveredMax } from './engine';
import type { GameState } from './types';

const cost = (coins: number, data: number) => `${coins.toLocaleString('zh-CN')} 碰撞能和 ${data.toLocaleString('zh-CN')} 研究数据`;
const feed = MODULES.feed, reaction = MODULES.reaction, upgrade = MODULE_UPGRADES.reaction[0], reactor = REACTORS[1];

const lessons = [
  { id: 'pickup', title: '拾取灵感点', detail: '点击「放出练习灵感点」，再点屏幕上落下的灵感点。拾取后，手动碰撞获得的碰撞能和研究数据翻倍，持续 1 分钟。' },
  { id: 'pulse', title: '用灵感触发碰撞', detail: '去点反应容器图片中的任意位置，看看这次碰撞实际拿到了多少资源。灵感结束后可以再放出一个练习灵感点。' },
  { id: 'feed', title: '研发原料补充', detail: `打开「科研」里的工业自动化，点「研发模块」，花 ${cost(feed.coins, feed.data)} 开启自动补样。它会先保留你设定的碰撞能。` },
  { id: 'be', title: '发现铍，开放第二代仪器', detail: '用 I 级容器继续探索。发现锂（Li）后会接着寻找铍（Be）。等待时，可以手动碰撞积累建造资源。' },
  { id: 'build', title: '建造 II 级反应容器', detail: `在「科研」找到「受控反应容器」，用 ${cost(reactor.buildCoins, reactor.buildData)} 点击「研发并建造」。建成后用实验室的「仪器」下拉菜单切换设备。` },
  { id: 'reaction', title: '研发自动反应', detail: `在工业自动化找到「自动反应」，用 ${cost(reaction.coins, reaction.data)} 研发。启用后可批量生产已发现元素，也可逐台给仪器分工。` },
  { id: 'upgrade', title: '把自动反应升到 2 级', detail: `用 ${cost(upgrade.coins, upgrade.data)} 点击「升级至 2 级」。同样的自动生产时间里，I 级仪器倍率从 ×8 到 ×10，II 级及更高级从 ×32 到 ×40。` },
  { id: 'archive', title: '收录第一种元素', detail: `让 I 级容器生产氢。累计提交 ${ARCHIVE_UNITS} 份即可在周期表点亮档案并激活能力。` },
  { id: 'accelerator', title: '进入加速大厅', detail: '点击实验室右侧的「加速环」，看看四段束管将在哪里建造。' },
] as const;

export const LAB_GUIDE_LENGTH = lessons.length;

export function labGuideStep(state: GameState) {
  const done = [
    state.stats.milestones.pulsePickup !== undefined,
    state.stats.milestones.boostedPulse !== undefined,
    state.modules.feed,
    discoveredMax(state) >= 4,
    state.reactors[1].built,
    state.modules.reaction,
    state.moduleLevels.reaction >= 2,
    archivedCount(state) > 0,
    state.stats.milestones.acceleratorIntro !== undefined,
  ];
  const step = done.indexOf(false);
  return step < 0
    ? { id: 'done' as const, step: LAB_GUIDE_LENGTH, title: '你已完成新手实验', detail: '继续探索和收录新元素。屏幕上还会随机出现灵感点、能量碎片和数据碎片。' }
    : { ...lessons[step], step };
}

export type LabGuideStep = ReturnType<typeof labGuideStep>;
