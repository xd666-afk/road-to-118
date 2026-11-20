import { useState } from 'react';
import type { SaveSlot } from '../game/localSaves';

export default function SavedGames({ slots, activeId, error, onCreate, onSwitch, onDelete }: {
  slots: SaveSlot[];
  activeId: string;
  error: string;
  onCreate: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => boolean;
}) {
  const [pending, setPending] = useState<string>();
  const selected = slots.find(slot => slot.id === pending);
  return <section className="saved-games" aria-labelledby="saved-games-title">
    <div className="saved-games-heading">
      <h3 id="saved-games-title">本地存档</h3>
      <button className="secondary-button" onClick={onCreate}>新建存档</button>
    </div>
    <ul>
      {slots.map(slot => <li key={slot.id}>
        <strong>{slot.name}</strong>
        <div className="saved-game-actions">
          {slot.id === activeId ? <span>正在使用</span> : <button className="secondary-button" aria-label={`切换到${slot.name}`}
            onClick={() => onSwitch(slot.id)}>切换</button>}
          <button className="text-button delete-save" aria-label={`删除${slot.name}`} onClick={() => setPending(slot.id)}>删除</button>
        </div>
      </li>)}
    </ul>
    {selected && <div className="delete-save-confirm" role="group" aria-label="确认删除存档">
      <p>永久删除「{selected.name}」及其进度？{slots.length === 1 && '删完会进入一个新的空白存档。'}</p>
      <div>
        <button className="secondary-button" onClick={() => setPending(undefined)}>取消</button>
        <button className="secondary-button delete-save" onClick={() => {
          if (onDelete(selected.id)) setPending(undefined);
        }}>确认删除</button>
      </div>
    </div>}
    {error && <p className="save-slot-error" role="alert">{error}</p>}
  </section>;
}
