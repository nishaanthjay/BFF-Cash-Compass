import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';
import { color } from '../../styles/tokens';
import s from './Facilitator.module.css';

/** Full-screen join code + QR for the projector. Esc or the X closes it. */
export function CodeScreen({ chapter, url, joined, onClose }: { chapter: string; url: string; joined: number; onClose: () => void }) {
  const closer = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closer.current?.focus();
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);
  return createPortal(
    <div className={s.codeScreen} role="dialog" aria-modal="true" aria-label="Join code, full screen">
      <button ref={closer} type="button" className={s.codeClose} onClick={onClose} aria-label="Close full screen">
        <X size={22} strokeWidth={2.5} aria-hidden />
      </button>
      <p className={s.csUrl}>Go to {window.location.host}</p>
      <p className="eyebrow">and type this code</p>
      <p className={s.csCode} aria-label={`Chapter code ${chapter.split('').join(' ')}`}>
        {chapter}
      </p>
      <QRCodeSVG value={url} size={320} level="M" fgColor={color.foreground} bgColor={color.card} className={s.qr} title={`QR code for ${url}`} />
      <p className={`${s.csUrl} num`}>{joined} joined</p>
    </div>,
    document.body,
  );
}
