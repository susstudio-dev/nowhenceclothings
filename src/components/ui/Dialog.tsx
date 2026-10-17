'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './cn';
import { IconClose } from './icons';
import { useScrollLock } from './use-overlay';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Centred modal on native <dialog> (top layer, built-in focus containment and Escape).
 * Backdrop click closes; focus returns to the opener on close.
 */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal?.();
    }
    if (!open && d.open) {
      d.close?.();
      opener.current?.focus?.();
    }
  }, [open]);

  useScrollLock(open);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn(
        'w-[calc(100%-2.5rem)] max-w-lg border border-line bg-paper p-0 text-ink',
        'backdrop:bg-ink/30 open:animate-rise-in',
        className,
      )}
    >
      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          <h2 id={titleId} className="font-display text-h4">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center transition-opacity duration-fast hover:opacity-60"
          >
            <IconClose />
          </button>
        </div>
        {description && (
          <p id={descId} className="mt-2 text-small text-muted">
            {description}
          </p>
        )}
        {children && <div className="mt-6">{children}</div>}
        {footer && <div className="mt-8 flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </dialog>
  );
}
