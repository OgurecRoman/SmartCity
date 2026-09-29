import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { messageForApiError } from '../../lib/apiError';
import { getPortalRoot } from '../../lib/portalRoot';
import s from './Toast.module.scss';

type ToastTone = 'info' | 'success' | 'error';

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastApi = {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (err: unknown, fallback?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const MAX_TOASTS = 3;
const TTL_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const text = message.trim();
    if (!text) return;
    const id = idRef.current++;
    setItems((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, message: text, tone }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show(message, 'success'),
      error: (err, fallback) => show(messageForApiError(err, fallback), 'error'),
    }),
    [show],
  );

  const host =
    items.length > 0
      ? createPortal(
          <div className={s.host} aria-live="polite" aria-relevant="additions">
            {items.map((item) => (
              <ToastCard key={item.id} item={item} onDone={() => dismiss(item.id)} />
            ))}
          </div>,
          // body — вне #root/zoom и поверх карты / модалок
          typeof document !== 'undefined' ? document.body : getPortalRoot(),
        )
      : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {host}
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, TTL_MS);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <button
      type="button"
      className={`${s.toast} ${s[item.tone]}`}
      onClick={onDone}
      aria-label="Закрыть уведомление"
    >
      {item.message}
    </button>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast вне ToastProvider');
  return ctx;
}
