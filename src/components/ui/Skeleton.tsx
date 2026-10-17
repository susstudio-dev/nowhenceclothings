import { cn } from './cn';

export interface SkeletonProps {
  className?: string;
  /** Preset shapes. `image` uses the 4:5 garment ratio. */
  shape?: 'block' | 'text' | 'image';
  /** Number of lines (shape="text"). */
  lines?: number;
}

/** Quiet loading placeholder in paper-deep with a slow sheen (static under reduced motion). */
export function Skeleton({ className, shape = 'block', lines = 3 }: SkeletonProps) {
  if (shape === 'text') {
    return (
      <div aria-hidden="true" className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="skeleton h-3" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
        ))}
      </div>
    );
  }
  return <div aria-hidden="true" className={cn('skeleton', shape === 'image' && 'aspect-garment w-full', className)} />;
}

/** Product card placeholder: image plus name and price lines. */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col gap-3', className)}>
      <Skeleton shape="image" />
      <div className="flex justify-between gap-4">
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-3 w-14" />
      </div>
    </div>
  );
}
