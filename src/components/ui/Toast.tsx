'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { IconClose } from './icons';

export type ToastTone = 'neutral' | 'success' | 'error';
export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Optional action, e.g. a "View bag" button. */
  action?: { label: string; onClick: () => void };
  /** Milliseconds; default 4000. 0 keeps it until dismissed. */
  duration?: number;
}
interface ToastItem extends ToastInput {
  id: number;
}

const noop = () => {};
const ToastCtx = createContext<((t: ToastInput) => void) | null>(null);

/** Returns a function that shows a toast. A no-op outside a ToastProvider. */
export function useToast(): (t: ToastInput) => void {
  return useContext(ToastCtx) ?? noop;
}

/** Mount once near the root. Toasts stack bottom-centre on mobile, bottom-right on desktop; max three. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const seq = useRef(0);
  useEffect(() => setMounted(true), []);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      const d = t.duration ?? 4000;
      if (d > 0) setTimeout(() => dismiss(id), d);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-toast flex flex-col items-center gap-2 p-4 md:items-end md:p-6"
          >
            {items.map((t) => (
              <Toast key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}

/** A single toast; also usable on its own. */
export function Toast({
  title,
  description,
  tone = 'neutral',
  action,
  onDismiss,
  className,
}: ToastInput & { onDismiss?: () => void; className?: string }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('pointer-events-auto flex w-full max-w-sm animate-rise-in items-start gap-4 bg-ink px-5 py-4 text-paper', className)}
    >
      <span
        aria-hidden="true"
        className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', tone === 'error' ? 'bg-sale' : tone === 'success' ? 'bg-clay' : 'bg-paper/60')}
      />
      <div className="min-w-0 flex-1">
        <p className="text-small">{title}</p>
        {description && <p className="mt-0.5 text-caption text-paper/70">{description}</p>}
        {action && (
          <button type="button" onClick={action.onClick} className="mt-2 text-label uppercase underline underline-offset-4">
            {action.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="-mr-1 opacity-60 transition-opacity hover:opacity-100">
          <IconClose size={16} />
        </button>
      )}
    </div>
  );
}
