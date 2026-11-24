import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export default function Modal({ title, children, onClose, wide = false, guided = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; guided?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null), close = useRef(onClose); close.current = onClose;
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const el = dialog.current!; el.showModal(); el.querySelector<HTMLElement>('[data-guide-dialog-action]')?.focus(); const cancel = (e: Event) => { e.preventDefault(); close.current(); }; el.addEventListener('cancel', cancel); return () => { el.removeEventListener('cancel', cancel); el.close(); previous?.focus(); }; }, []);
  return <dialog ref={dialog} className={`modal ${wide ? 'wide' : ''}`} aria-label={title} onClick={e => {
    if (guided || e.target !== e.currentTarget) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose();
  }}><div className="modal-head"><span className="eyebrow">ROAD TO 118 / ARCHIVE</span>{!guided && <button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={20}/></button>}</div><h2>{title}</h2>{children}</dialog>;
}
