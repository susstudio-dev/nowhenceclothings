import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'ink' | 'clay' | 'sale' | 'success' | 'inverse';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** `tag` = hairline care-label (default). `solid` = filled. */
  variant?: 'tag' | 'solid';
  className?: string;
}

const tag: Record<BadgeTone, string> = {
  neutral: 'text-ink-soft bg-paper/90',
  ink: 'text-ink bg-paper/90',
  clay: 'text-clay bg-paper/90',
  sale: 'text-sale bg-paper/90',
  success: 'text-success bg-paper/90',
  inverse: 'text-paper',
};
const solid: Record<BadgeTone, string> = {
  neutral: 'border-paper-deep bg-paper-deep text-ink',
  ink: 'border-ink bg-ink text-paper',
  clay: 'border-clay-soft bg-clay-soft text-ink',
  sale: 'border-sale bg-sale text-paper',
  success: 'border-success bg-success text-paper',
  inverse: 'border-paper bg-paper text-ink',
};

/** Garment care-label badge: tracked micro caps in a hairline box. One per card, at most. */
export function Badge({ children, tone = 'neutral', variant = 'tag', className }: BadgeProps) {
  return <span className={cn('care-tag', variant === 'tag' ? tag[tone] : solid[tone], className)}>{children}</span>;
}
