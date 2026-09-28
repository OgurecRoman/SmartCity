import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { getPortalRoot } from '../../lib/portalRoot';
import { mediaUrl } from '../../lib/mediaUrl';
import s from './PhotoLightbox.module.scss';

type Props = {
  urls: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

const SWIPE_THRESHOLD = 56;

export function PhotoLightbox({ urls, index, onClose, onIndexChange }: Props) {
  const sources = urls.map((path) => mediaUrl(path)).filter((src): src is string => Boolean(src));
  const safeIndex = Math.min(Math.max(index, 0), Math.max(sources.length - 1, 0));
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<'x' | 'y' | null>(null);
  const didDrag = useRef(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const go = useCallback(
    (next: number) => {
      if (sources.length === 0) return;
      const wrapped = (next + sources.length) % sources.length;
      onIndexChange(wrapped);
      setDragX(0);
    },
    [onIndexChange, sources.length],
  );

  useBodyScrollLock(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(safeIndex - 1);
      if (e.key === 'ArrowRight') go(safeIndex + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, safeIndex]);

  if (sources.length === 0) return null;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    axis.current = null;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (!axis.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (axis.current === 'x') {
      setDragX(dx);
    } else if (dy > 0) {
      setDragX(0);
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragging(false);
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    didDrag.current = axis.current != null && (Math.abs(dx) > 8 || Math.abs(dy) > 8);
    if (axis.current === 'y' && dy > SWIPE_THRESHOLD) {
      onClose();
    } else if (axis.current === 'x' && Math.abs(dx) > SWIPE_THRESHOLD) {
      go(dx < 0 ? safeIndex + 1 : safeIndex - 1);
    } else {
      setDragX(0);
    }
    axis.current = null;
  }

  function onOverlayClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    const img = imageRef.current;
    if (img) {
      const r = img.getBoundingClientRect();
      const onPhoto =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (onPhoto) return;
    }
    onClose();
  }

  const node = (
    <div
      className={s.root}
      role="dialog"
      aria-modal="true"
      aria-label={`Фото ${safeIndex + 1} из ${sources.length}`}
      onClick={onOverlayClick}
    >
      <div className={s.topBar} onClick={(e) => e.stopPropagation()}>
        <span className={s.counter}>
          {safeIndex + 1} / {sources.length}
        </span>
        <button type="button" className={s.iconBtn} aria-label="Закрыть" onClick={onClose}>
          <X size={22} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {sources.length > 1 && (
        <>
          <button
            type="button"
            className={`${s.nav} ${s.navPrev}`}
            aria-label="Предыдущее фото"
            onClick={(e) => {
              e.stopPropagation();
              go(safeIndex - 1);
            }}
          >
            <ChevronLeft size={28} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className={`${s.nav} ${s.navNext}`}
            aria-label="Следующее фото"
            onClick={(e) => {
              e.stopPropagation();
              go(safeIndex + 1);
            }}
          >
            <ChevronRight size={28} strokeWidth={2} aria-hidden />
          </button>
        </>
      )}

      <div
        className={s.stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imageRef}
          key={sources[safeIndex]}
          src={sources[safeIndex]}
          alt=""
          className={s.image}
          draggable={false}
          style={{
            transform: `translateX(${dragX}px)`,
            transition: dragging ? 'none' : 'transform 160ms ease-out',
          }}
        />
      </div>

      {sources.length > 1 && (
        <div className={s.dots} onClick={(e) => e.stopPropagation()}>
          {sources.map((_, i) => (
            <button
              key={i}
              type="button"
              className={i === safeIndex ? `${s.dot} ${s.dotActive}` : s.dot}
              aria-label={`Фото ${i + 1}`}
              aria-current={i === safeIndex}
              onClick={() => onIndexChange(i)}
            />
          ))}
        </div>
      )}
    </div>
  );

  return createPortal(node, getPortalRoot());
}

type GalleryProps = {
  urls: string[];
  className?: string;
  thumbClassName?: string;
  imgClassName?: string;
};

export function PhotoGallery({ urls, className, thumbClassName, imgClassName }: GalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const sources = urls.map((path) => mediaUrl(path)).filter((src): src is string => Boolean(src));
  if (sources.length === 0) return null;

  return (
    <>
      <div className={className}>
        {sources.map((src, index) => (
          <button
            key={`${src}-${index}`}
            type="button"
            className={thumbClassName}
            onClick={() => setOpenIndex(index)}
            aria-label={`Открыть фото ${index + 1}`}
          >
            <img src={src} alt="" className={imgClassName} />
          </button>
        ))}
      </div>
      {openIndex != null && (
        <PhotoLightbox
          urls={urls}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndexChange={setOpenIndex}
        />
      )}
    </>
  );
}
