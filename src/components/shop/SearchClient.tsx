'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Image, Input, Price } from '@/components/ui';
import { searchIndex, type SearchEntry } from './merch';

/** Client-side catalogue search (S10). The index is built server-side and passed in. */
export function SearchClient({ index, initialQuery = '' }: { index: SearchEntry[]; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const router = useRouter();
  const pathname = usePathname();
  const results = useMemo(() => searchIndex(index, q), [index, q]);

  // Keep ?q= in sync (shareable) without adding history entries per keystroke.
  useEffect(() => {
    const t = setTimeout(() => router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false }), 300);
    return () => clearTimeout(t);
  }, [q, pathname, router]);

  return (
    <div>
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <Input type="search" label="Search the collection" hideLabel placeholder="Search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <p className="mt-4 text-caption text-muted" aria-live="polite">
        {q.trim() ? `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${q.trim()}”` : 'Try “tee”, “black” or “cotton”.'}
      </p>
      <ul className="mt-10 grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-4 md:gap-y-14 lg:grid-cols-4">
        {results.map((r) => (
          <li key={r.slug}>
            <Link href={`/products/${r.slug}`} className="block">
              <div className="aspect-garment overflow-hidden bg-paper-deep">
                {r.image && <Image media={r.image} alt={r.image.alt || r.title} sizes="(min-width: 1024px) 25vw, 50vw" className="h-full w-full object-cover" />}
              </div>
              <div className="mt-3 flex justify-between gap-3 text-small">
                <span>{r.title}</span>
                <Price amount={r.price} size="sm" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
