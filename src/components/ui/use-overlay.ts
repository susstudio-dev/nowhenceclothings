'use client';
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

let lockCount = 0;

/** Lock page scroll while any overlay is open (ref-counted across overlays). */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const el = document.documentElement;
    lockCount += 1;
    if (lockCount === 1) {
      const gap = window.innerWidth - el.clientWidth;
      if (gap > 0) el.style.setProperty('padding-right', `${gap}px`);
      el.setAttribute('data-scroll-locked', '');
    }
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        el.removeAttribute('data-scroll-locked');
        el.style.removeProperty('padding-right');
      }
    };
  }, [active]);
}

/**
 * Trap Tab focus inside `ref` while active, call `onEscape` on Escape,
 * and restore focus to the previously focused element on deactivate.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
): void {
  const escRef = useRef(onEscape);
  escRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const items = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => !n.hasAttribute('inert') && n.getClientRects().length > 0,
      );
    const first = items()[0];
    (first ?? root).focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        escRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const head = list[0]!;
      const tail = list[list.length - 1]!;
      const current = document.activeElement;
      if (e.shiftKey && (current === head || current === root)) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && current === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [active, ref]);
}
