import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export default function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null), close = useRef(onClose); close.current = onClose;
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const el = dialog.current!; el.showModal(); const cancel = (e: Event) => { e.preventDefault(); close.current(); }; el.addEventListener('cancel', cancel); return () => { el.removeEventListener('cancel', cancel); el.close(); previous?.focus(); }; }, []);
  return <dialog ref={dialog} className={`modal ${wide ? 'wide' : ''}`} aria-label={title} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-head"><span className="eyebrow">ROAD TO 118 / ARCHIVE</span><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={20}/></button></div><h2>{title}</h2>{children}</dialog>;
}
