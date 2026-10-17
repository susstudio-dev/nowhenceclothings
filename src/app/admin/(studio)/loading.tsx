import { Skeleton } from '@/components/ui/Skeleton';

export default function StudioLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-8">
      <div className="space-y-3">
        <Skeleton shape="text" lines={1} className="w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 bg-paper p-4">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-px border border-line">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-6 border-t border-line p-4 first:border-t-0">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
