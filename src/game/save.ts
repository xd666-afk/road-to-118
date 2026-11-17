import { D } from './numbers';
import { createState } from './engine';
import { ACHIEVEMENTS, PLAYABLE_ELEMENTS, REACTORS } from './config';
import type { GameState } from './types';
const KEY = 'road-to-118.save.v1';
export function serialize(s: GameState, now = Date.now()): string {
  return JSON.stringify({ ...s, savedAt: now, notices: [] });
}
export function deserialize(text: string): GameState {
  if (text.length > 2_000_000) throw new Error('存档文件过大。');
  let raw: any; try { raw = JSON.parse(text); } catch { throw new Error('无法读取存档：JSON 格式损坏。'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('这不是有效的游戏存档。');
  // Accept the released 10-element saves and migrate them without clearing progress.
  if (![0, 1, 2].includes(raw.saveVersion)) throw new Error('存档版本不兼容。请保留原文件。');
  const legacy = raw.saveVersion < 2;
  if (!Array.isArray(raw.elements) || raw.elements.length !== (legacy ? 10 : PLAYABLE_ELEMENTS) || !Array.isArray(raw.reactors) || raw.reactors.length !== (legacy ? 3 : REACTORS.length)) throw new Error('存档缺少元素或设备数据。');
  const s = createState(1, 0), defaults = createState(1, 0), num = (v: unknown, max = Number.MAX_SAFE_INTEGER): number => { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) throw new Error('存档包含无效数值。'); return v; };
  const amount = (v: unknown) => { if (typeof v !== 'string' || v.length > 10000) throw new Error('存档中的大数格式错误。'); let d; try { d = D(v); } catch { throw new Error('存档中的大数格式错误。'); } if (!d.isFinite() || d.lt(0) || d.e > 1e9) throw new Error('存档数值超出支持范围。'); return d; };
  const bool = (v: unknown) => { if (typeof v !== 'boolean') throw new Error('存档状态字段损坏。'); return v; };
  s.seed = num(raw.seed, 0xffffffff); s.rng = num(raw.rng, 0xffffffff); s.elapsed = num(raw.elapsed); s.savedAt = num(raw.savedAt);
  s.coins = amount(raw.coins); s.data = amount(raw.data);
  let locked = false;
  s.elements = raw.elements.map((e: any, i: number) => {
    const discovered = bool(e.discovered); if (!discovered) locked = true; else if (locked) throw new Error('存档的元素发现顺序不正确。');
    const deposited = num(e.deposited, 50); if (!Number.isInteger(deposited)) throw new Error('收录进度必须为整数。');
    const inventory = amount(e.inventory), totalProduced = amount(e.totalProduced);
    if (!inventory.isInteger() || !totalProduced.isInteger() || bool(e.archived) !== (deposited === 50) || (!discovered && (deposited > 0 || !inventory.isZero()))) throw new Error('元素库存或收录状态损坏。');
    if (totalProduced.lt(inventory.plus(deposited))) throw new Error('库存与历史产量不一致。');
    return { discovered, inventory, deposited, archived: deposited === 50, totalProduced, firstDiscoveredAt: e.firstDiscoveredAt === null ? null : num(e.firstDiscoveredAt), firstDiscoveredReactor: e.firstDiscoveredReactor === null ? null : num(e.firstDiscoveredReactor, legacy ? 3 : REACTORS.length) };
  });
  if (legacy) s.elements.push(...defaults.elements.slice(10));
  if (!s.elements[0].discovered) throw new Error('存档缺少初始氢元素。');
  const max = s.elements.filter(e => e.discovered).length;
  s.reactors = raw.reactors.map((r: any, i: number) => {
    if (r.id !== i + 1 || !r.upgrades) throw new Error('设备数据损坏。');
    const upgrades = {} as GameState['reactors'][0]['upgrades'];
    for (const key of ['atoms', 'speed', 'yield', 'capacity'] as const) { const n = num(r.upgrades[key], 1e7); if (!Number.isInteger(n)) throw new Error('升级等级必须为整数。'); upgrades[key] = n; }
    const target = num(r.target, Math.min(PLAYABLE_ELEMENTS, max + 1)); if (target < 1 || !Number.isInteger(target)) throw new Error('设备目标无效。');
    return { id: i + 1, built: bool(r.built), active: bool(r.active), target, exploring: bool(r.exploring), upgrades, events: amount(r.events), discoveryHazard: num(r.discoveryHazard), productionRemainder: amount(r.productionRemainder), eventRemainder: r.eventRemainder === undefined ? D(0) : amount(r.eventRemainder) };
  });
  if (legacy) s.reactors.push(...defaults.reactors.slice(3).map(r => ({ ...r, discoveryHazard: 1 })));
  if (!s.reactors[0].built || s.reactors.some(r => r.built && !s.elements[REACTORS[r.id - 1].unlock - 1].discovered)) throw new Error('设备开放状态不正确。');
  if (!raw.modules || !raw.automation || !raw.stats) throw new Error('存档缺少工业或统计数据。');
  for (const key of ['feed', 'reaction', 'allocation'] as const) { s.modules[key] = bool(raw.modules[key]); s.automation[key] = bool(raw.automation[key]); if (s.automation[key] && !s.modules[key]) throw new Error('工业模块尚未研发。'); }
  if ((s.modules.reaction && !s.modules.feed) || (s.modules.allocation && !s.modules.reaction)) throw new Error('工业模块顺序损坏。');
  if (!['explore', 'produce', 'archive'].includes(raw.automation.mode)) throw new Error('工作模式损坏。');
  s.automation.mode = raw.automation.mode; s.automation.reserve = amount(raw.automation.reserve); s.automation.target = num(raw.automation.target, max);
  if (!Number.isInteger(s.automation.target) || s.automation.target < 1) throw new Error('生产目标无效。');
  for (const k of ['events', 'produced', 'earned', 'peak'] as const) s.stats[k] = amount(raw.stats[k]);
  s.stats.builds = num(raw.stats.builds, legacy ? 3 : REACTORS.length); s.stats.purchases = num(raw.stats.purchases); s.stats.lastEvent = typeof raw.stats.lastEvent === 'string' ? raw.stats.lastEvent.slice(0, 200) : '存档已恢复';
  const priorComplete = raw.stats.completedAt === null ? null : num(raw.stats.completedAt);
  s.stats.neonCompletedAt = legacy ? priorComplete : raw.stats.neonCompletedAt === null ? null : num(raw.stats.neonCompletedAt);
  s.stats.completedAt = legacy ? null : priorComplete;
  if ((s.stats.neonCompletedAt !== null) !== s.elements[9].archived || (s.stats.completedAt !== null) !== s.elements[PLAYABLE_ELEMENTS - 1].archived) throw new Error('阶段完成状态与收录进度不一致。');
  const validMilestones = new Set(['complete', 'neonArchive', 'firstUpgrade', 'firstArchive', 'module_feed', 'module_reaction', 'module_allocation', ...Array.from({length: PLAYABLE_ELEMENTS - 1}, (_, i) => `element${i + 2}`), ...REACTORS.slice(1).map(r => `reactor${r.id}`)]);
  s.stats.milestones = {}; for (const [k, v] of Object.entries(raw.stats.milestones || {})) { const key = legacy && k === 'complete' ? 'neonArchive' : k; if (validMilestones.has(key)) s.stats.milestones[key] = num(v); }
  if (legacy && priorComplete !== null && s.stats.milestones.neonArchive === undefined) s.stats.milestones.neonArchive = priorComplete;
  const valid = new Set<string>(ACHIEVEMENTS.map(a => a.id)); if (!Array.isArray(raw.achievements)) throw new Error('成就数据损坏。');
  s.achievements = [...new Set<string>(raw.achievements.filter((id: unknown) => typeof id === 'string' && valid.has(id)))];
  if (raw.settings && typeof raw.settings === 'object') {
    s.settings.scientific = raw.settings.scientific === true; s.settings.reducedMotion = raw.settings.reducedMotion === true; s.settings.guideDismissed = raw.settings.guideDismissed === true;
    s.settings.mix = Array.isArray(raw.settings.mix) ? [...new Set<number>(raw.settings.mix.filter((z: unknown) => typeof z === 'number' && Number.isInteger(z) && z >= 1 && z <= max))].slice(0, PLAYABLE_ELEMENTS) : [1];
    if (!s.settings.mix.length) s.settings.mix = [1];
  }
  s.noticeSeq = raw.noticeSeq === undefined ? 0 : num(raw.noticeSeq);
  s.saveVersion = 2; s.notices = []; return s;
}
export function saveLocal(s: GameState): { ok: boolean; message: string } {
  try { localStorage.setItem(KEY, serialize(s)); return { ok: true, message: '存档已保存在此浏览器' }; }
  catch { return { ok: false, message: '浏览器存储不可用。请导出存档以保留进度。' }; }
}
export function loadLocal(): { state: GameState; error?: string } {
  try { const text = localStorage.getItem(KEY); return { state: text ? deserialize(text) : createState() }; }
  catch (error) { return { state: createState(), error: `旧存档未被覆盖。${error instanceof Error ? error.message : '读取失败'}` }; }
}
