'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { IconClose } from './icons';
import { useFocusTrap, useScrollLock } from './use-overlay';

export type DrawerSide = 'left' | 'right' | 'bottom';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: DrawerSide;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Matches duration-slow so the exit transform finishes before unmount. */
const EXIT_MS = 300;

const panelSide: Record<DrawerSide, string> = {
  right: 'right-0 top-0 h-full w-full max-w-[28rem] border-l',
  left: 'left-0 top-0 h-full w-full max-w-[24rem] border-r',
  bottom: 'bottom-0 left-0 max-h-[85dvh] w-full border-t',
};
const hiddenTransform: Record<DrawerSide, string> = {
  right: 'translate-x-full',
  left: '-translate-x-full',
  bottom: 'translate-y-full',
};

/** Modal side sheet: portal, focus trap + restore, scroll lock, Escape/backdrop close, transform motion. */
export function Drawer({ open, onClose, title, side = 'right', children, footer, className }: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  useScrollLock(open);
  useFocusTrap(panel, open && mounted, onClose);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-overlay">
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-ink/30 transition-opacity duration-base ease-out',
          shown ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-side={side}
        data-state={shown ? 'open' : 'closed'}
        className={cn(
          'absolute flex flex-col border-line bg-paper outline-none',
          'transition-transform duration-slow ease-out',
          panelSide[side],
          !shown && hiddenTransform[side],
          className,
        )}
      >
        <header className="flex h-header shrink-0 items-center justify-between border-b border-line px-gutter">
          <h2 id={titleId} className="font-sans text-micro uppercase text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 inline-flex h-10 w-10 items-center justify-center text-ink transition-opacity duration-fast hover:opacity-60"
          >
            <IconClose />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-gutter py-6">{children}</div>
        {footer && <footer className="shrink-0 border-t border-line px-gutter py-5">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
