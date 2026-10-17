'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Drawer } from './Drawer';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Responsive sheet: a bottom sheet under 768px and a right side panel above it.
 * For quick-buy and checkout over the page (A16). Same focus, scroll-lock and Escape behaviour as Drawer.
 */
export function Sheet(props: SheetProps) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return <Drawer {...props} side={wide ? 'right' : 'bottom'} />;
}
