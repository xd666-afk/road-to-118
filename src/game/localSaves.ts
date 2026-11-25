import { createFirstRun, createState } from './engine';
import { deserialize, serialize } from './save';
import type { GameState } from './types';

const LEGACY_KEY = 'road-to-118.save.v1';
const DIRECTORY_KEY = 'road-to-118.saves.v1';
const ORIGINAL = { id: 'original', name: '存档 1' };
const storageKey = (id: string) => id === ORIGINAL.id ? LEGACY_KEY : `${LEGACY_KEY}.slot.${id}`;
export const SAVE_STORAGE_ERROR = '浏览器存储不可用。请导出存档以保留进度。';
const SAVE_CHANGED = '另一个标签页已保存。请先导出本页要保留的进度，再刷新读取最新存档。';
const lastRead = new Map<string, string | null>();

export interface SaveSlot { id: string; name: string }
interface SaveDirectory { active: string; slots: SaveSlot[] }
export interface LocalSave {
  slot: SaveSlot;
  state: GameState;
  error?: string;
  raw?: string;
}

function readDirectory(): SaveDirectory {
  const text = localStorage.getItem(DIRECTORY_KEY);
  if (text === null) return { active: ORIGINAL.id, slots: [ORIGINAL] };
  const directory: SaveDirectory = JSON.parse(text);
  const slots = directory?.slots;
  if (!Array.isArray(slots) || slots.some(slot => !slot || typeof slot.id !== 'string' ||
    !/^[a-z0-9-]{1,72}$/.test(slot.id) || typeof slot.name !== 'string') ||
    new Set(slots.map(slot => slot.id)).size !== slots.length ||
    !slots.some(slot => slot.id === directory.active)) {
    throw new Error('存档列表无法读取。');
  }
  return directory;
}

function loadSlot(slot: SaveSlot): LocalSave {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey(slot.id));
    lastRead.set(slot.id, raw);
    return { slot, state: raw === null ? createFirstRun() : deserialize(raw) };
  } catch (error) {
    return { slot, state: createState(), raw: raw ?? undefined, error: `旧存档未被覆盖。${error instanceof Error ? error.message : '读取失败'}` };
  }
}

export function loadLocal(): LocalSave & { slots: SaveSlot[] } {
  try {
    const { active, slots } = readDirectory();
    return { ...loadSlot(slots.find(slot => slot.id === active)!), slots };
  } catch {
    return { slot: ORIGINAL, slots: [ORIGINAL], state: createState(), error: SAVE_STORAGE_ERROR };
  }
}

export function saveLocal(slotId: string, state: GameState): { ok: boolean; message: string } {
  try {
    if (!readDirectory().slots.some(slot => slot.id === slotId)) {
      return { ok: false, message: '这个存档已被删除。可以导出当前进度。' };
    }
    const key = storageKey(slotId);
    if (lastRead.has(slotId) && localStorage.getItem(key) !== lastRead.get(slotId)) {
      return { ok: false, message: SAVE_CHANGED };
    }
    const snapshot = serialize(state);
    localStorage.setItem(key, snapshot);
    lastRead.set(slotId, snapshot);
    return { ok: true, message: '存档已保存在此浏览器' };
  } catch {
    return { ok: false, message: SAVE_STORAGE_ERROR };
  }
}

function addSlot(slots: SaveSlot[]): { slots: SaveSlot[]; save: LocalSave } {
  const names = new Set(slots.map(slot => slot.name));
  let number = 1;
  while (names.has(`存档 ${number}`)) number++;
  const id = globalThis.crypto.randomUUID?.() ??
    Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16)).join('-');
  const slot = { id, name: `存档 ${number}` };
  const state = createFirstRun();
  const updated = [...slots, slot];
  const snapshot = serialize(state);
  localStorage.setItem(storageKey(id), snapshot);
  try {
    localStorage.setItem(DIRECTORY_KEY, JSON.stringify({ active: id, slots: updated }));
  } catch (error) {
    localStorage.removeItem(storageKey(id));
    throw error;
  }
  lastRead.set(id, snapshot);
  return { slots: updated, save: { slot, state } };
}

export function createLocalSlot() {
  return addSlot(readDirectory().slots);
}

export function switchLocalSlot(id: string) {
  const directory = readDirectory();
  const slot = directory.slots.find(item => item.id === id);
  if (!slot) throw new Error('找不到这个存档。');
  const save = loadSlot(slot);
  localStorage.setItem(DIRECTORY_KEY, JSON.stringify({ ...directory, active: id }));
  return { slots: directory.slots, save };
}

export function deleteLocalSlot(id: string, currentId: string): { slots: SaveSlot[]; save?: LocalSave } {
  const directory = readDirectory();
  if (!directory.slots.some(slot => slot.id === id)) throw new Error('找不到这个存档。');
  const remaining = directory.slots.filter(slot => slot.id !== id);
  let result: { slots: SaveSlot[]; save?: LocalSave };
  if (remaining.length === 0) {
    result = addSlot([]);
  } else {
    const active = remaining.find(slot => slot.id === currentId) ?? remaining[0];
    localStorage.setItem(DIRECTORY_KEY, JSON.stringify({ active: active.id, slots: remaining }));
    result = { slots: remaining, save: active.id === currentId ? undefined : loadSlot(active) };
  }
  localStorage.removeItem(storageKey(id));
  lastRead.delete(id);
  return result;
}
