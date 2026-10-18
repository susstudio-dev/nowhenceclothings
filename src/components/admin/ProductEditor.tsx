'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SIZES, type Size } from '@/lib/schemas/common';
import type { Category, Collection, Colour, Drop, Product, SizeChart } from '@/lib/schemas/catalogue';
import { buildVariantGrid } from '@/lib/admin/variants';
import { titleWithColour } from '@/components/shop/merch';
import { Button, Input, Select } from '@/components/ui';
import { adminFetch, toPaise, toRupees } from './api-client';
import { MediaListEditor } from './MediaUploader';
import { AvailabilityEditor } from './AvailabilityEditor';
import { useMsgToast } from './useMsgToast';

type Draft = Omit<Product, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string };

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export function emptyProduct(defaults: { categoryId: string; sizeChartId: string }): Draft {
  return {
    id: '',
    slug: '',
    title: '',
    description: '',
    categoryId: defaults.categoryId,
    collectionIds: [],
    status: 'draft',
    price: 0,
    colours: [{ id: 'black', name: 'Black', hex: '#141412', images: [] }],
    sizes: ['S', 'M', 'L', 'XL'],
    variants: [],
    fabric: '',
    care: '',
    fit: '',
    sizeChartId: defaults.sizeChartId,
    relatedIds: [],
    sortOrder: 0,
    seo: {},
  };
}

export function ProductEditor({
  initial,
  mode,
  categories,
  collections,
  drops,
  sizeCharts,
}: {
  initial: Draft;
  mode: 'create' | 'update';
  categories: Category[];
  collections: Collection[];
  drops: Drop[];
  sizeCharts: SizeChart[];
}) {
  const router = useRouter();
  const [p, setP] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useMsgToast(msg);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setP((cur) => ({ ...cur, [k]: v }));

  const base = p.slug || p.id || 'item';
  const variants = useMemo(
    () => buildVariantGrid(base, p.colours, p.sizes, p.variants),
    [base, p.colours, p.sizes, p.variants],
  );

  // F23: open bookings follow a moved sale date. Preview how many will move.
  const termsKey = (d: Draft) =>
    `${d.dropId ?? ''}|${d.presale?.enabled ? 1 : 0}|${d.presale?.paymentMode ?? ''}|${d.presale?.deposit?.saleStartsAt ?? ''}|${d.presale?.deposit?.balanceWindowDays ?? ''}`;
  const termsChanged = mode === 'update' && termsKey(p) !== termsKey(initial);
  const [moving, setMoving] = useState<number>(0);
  useEffect(() => {
    if (!termsChanged) {
      setMoving(0);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      adminFetch<{ count: number }>(`/api/admin/products/${encodeURIComponent(p.id)}`, { method: 'POST', body: { ...p, variants } })
        .then((r) => live && setMoving(r.count))
        .catch(() => live && setMoving(0));
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termsChanged, termsKey(p)]);

  function setColour(i: number, patch: Partial<Colour>) {
    set('colours', p.colours.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  function setVariant(sku: string, patch: { priceOverride?: number; sku?: string }) {
    const next = variants.map((v) => (v.sku === sku ? { ...v, ...patch } : v));
    set('variants', next);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const id = p.id || `prod-${slugify(p.slug || p.title)}`;
      const body = { ...p, id, slug: p.slug || slugify(p.title), variants };
      const path = mode === 'create' ? '/api/admin/products' : `/api/admin/products/${encodeURIComponent(id)}`;
      const res = await adminFetch<{ bookings?: { moved: string[]; emailed: string[] } }>(path, {
        method: mode === 'create' ? 'POST' : 'PUT',
        body,
      });
      const moved = res?.bookings?.moved.length ?? 0;
      setMsg({
        ok: true,
        text: moved ? `Saved. ${moved} open booking${moved === 1 ? '' : 's'} moved to the new date (${res.bookings!.emailed.length} emailed).` : 'Saved',
      });
      if (mode === 'create') router.push(`/admin/products/${encodeURIComponent(id)}`);
      else router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: Product['status']) {
    try {
      await adminFetch(`/api/admin/products/${encodeURIComponent(p.id)}`, { method: 'PATCH', body: { status } });
      set('status', status);
      setMsg({ ok: true, text: `Status: ${status}` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' });
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <section className="grid gap-4 border border-line p-5 md:grid-cols-2">
        <Input label="Title" required value={p.title} onChange={(e) => set('title', e.target.value)} />
        <Input
          label="Slug"
          hint="URL: /products/{slug}. Leave blank to generate from the title."
          value={p.slug}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          onChange={(e) => set('slug', e.target.value)}
        />
        <Input
          label="Tagline"
          hint="One short line under the title. Optional."
          maxLength={140}
          value={p.tagline ?? ''}
          onChange={(e) => set('tagline', e.target.value || undefined)}
          className="md:col-span-2"
        />
        <Select
          label="Category"
          value={p.categoryId}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(e) => set('categoryId', e.target.value)}
        />
        <div>
          <Select
            label="Size chart"
            value={p.sizeChartId}
            options={sizeCharts.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(e) => set('sizeChartId', e.target.value)}
          />
          <Link href="/admin/size-charts" className="mt-1.5 inline-block text-xs text-muted hover:text-ink hover:underline">
            Edit size charts
          </Link>
        </div>
        <Select
          label="Drop"
          value={p.dropId ?? ''}
          placeholder="Not part of a drop"
          options={drops.map((d) => ({ value: d.id, label: `${d.name} (${d.releaseAt.slice(0, 10)})` }))}
          onChange={(e) => set('dropId', e.target.value || undefined)}
        />
        <fieldset className="text-sm">
          <legend className="mb-2 text-[11px] font-medium uppercase tracking-label text-muted">Collections</legend>
          {collections.map((c) => (
            <label key={c.id} className="mr-4 inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={p.collectionIds.includes(c.id)}
                onChange={(e) =>
                  set(
                    'collectionIds',
                    e.target.checked ? [...p.collectionIds, c.id] : p.collectionIds.filter((x) => x !== c.id),
                  )
                }
              />
              {c.name}
            </label>
          ))}
        </fieldset>
        <Input
          label="Price (₹, GST inclusive)"
          type="number"
          min={0}
          step="1"
          required
          value={toRupees(p.price)}
          onChange={(e) => set('price', toPaise(e.target.value) ?? 0)}
        />
        <Input
          label="Compare-at price (₹)"
          hint="Shown struck through when higher than the price."
          type="number"
          min={0}
          value={toRupees(p.compareAtPrice)}
          onChange={(e) => set('compareAtPrice', toPaise(e.target.value))}
        />
        <Input
          label="Sale ends"
          type="datetime-local"
          value={p.saleEndsAt ? p.saleEndsAt.slice(0, 16) : ''}
          onChange={(e) => set('saleEndsAt', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
        />
        <Input
          label="Sort order"
          type="number"
          value={String(p.sortOrder)}
          onChange={(e) => set('sortOrder', Math.trunc(Number(e.target.value) || 0))}
        />
      </section>

      <section className="grid gap-4 border border-line p-5 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          Description
          <textarea
            rows={5}
            value={p.description}
            onChange={(e) => set('description', e.target.value)}
            className="border border-line bg-paper px-3 py-2 focus:border-ink focus:outline-none"
          />
        </label>
        <Input label="Fabric" value={p.fabric} onChange={(e) => set('fabric', e.target.value)} />
        <Input label="Fit" value={p.fit} onChange={(e) => set('fit', e.target.value)} />
        <Input label="Care" value={p.care} onChange={(e) => set('care', e.target.value)} />
        <Input label="SEO title" maxLength={70} value={p.seo.title ?? ''} onChange={(e) => set('seo', { ...p.seo, title: e.target.value || undefined })} />
        <Input
          label="SEO description"
          maxLength={170}
          value={p.seo.description ?? ''}
          onChange={(e) => set('seo', { ...p.seo, description: e.target.value || undefined })}
        />
      </section>

      <AvailabilityEditor
        value={{ availability: p.availability, comingSoon: p.comingSoon, presale: p.presale }}
        colours={p.colours}
        title={p.title}
        slug={p.slug}
        onChange={(v) => setP((cur) => ({ ...cur, ...v }))}
      />

      <section className="space-y-3 border border-line p-5">
        <h2 className="text-[11px] font-medium uppercase tracking-label">Sizes</h2>
        <div className="flex gap-4 text-sm">
          {SIZES.map((s) => (
            <label key={s} className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={p.sizes.includes(s)}
                onChange={(e) =>
                  set('sizes', SIZES.filter((x) => (x === s ? e.target.checked : p.sizes.includes(x))) as Size[])
                }
              />
              {s}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 border border-line p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-label">Colours</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              set('colours', [...p.colours, { id: `colour-${p.colours.length + 1}`, name: 'New colour', hex: '#888888', images: [] }])
            }
          >
            Add colour
          </Button>
        </div>
        {p.colours.map((c, i) => (
          <div key={i} className="space-y-3 border border-line p-4">
            <div className="grid items-end gap-3 md:grid-cols-4">
              <Input label="Name" value={c.name} onChange={(e) => setColour(i, { name: e.target.value })} />
              <Input
                label="Id"
                hint="Used in SKUs; avoid changing once sold."
                value={c.id}
                onChange={(e) => setColour(i, { id: slugify(e.target.value) || c.id })}
              />
              <label className="flex flex-col gap-1 text-sm">
                Swatch
                <input type="color" value={c.hex} onChange={(e) => setColour(i, { hex: e.target.value })} />
              </label>
              <Button
                variant="ghost"
                size="sm"
                disabled={p.colours.length === 1}
                onClick={() => set('colours', p.colours.filter((_, j) => j !== i))}
              >
                Remove colour
              </Button>
            </div>
            <MediaListEditor
              label={`${c.name} images (first is primary; drag to reorder)`}
              value={c.images}
              defaultAlt={titleWithColour(p.title, c.name)}
              onChange={(images) => setColour(i, { images })}
            />
          </div>
        ))}
      </section>

      <section className="space-y-2 border border-line p-5">
        <h2 className="text-[11px] font-medium uppercase tracking-label">Variants ({variants.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1">Colour</th>
                <th>Size</th>
                <th>SKU</th>
                <th>Price override (₹)</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={`${v.colourId}|${v.size}`} className="border-t border-line">
                  <td className="py-1">{p.colours.find((c) => c.id === v.colourId)?.name}</td>
                  <td>{v.size}</td>
                  <td className="font-mono text-xs">{v.sku}</td>
                  <td>
                    <input
                      aria-label={`Price override for ${v.sku}`}
                      type="number"
                      min={0}
                      className="w-28 border border-line px-2 py-1"
                      value={toRupees(v.priceOverride)}
                      onChange={(e) => setVariant(v.sku, { priceOverride: toPaise(e.target.value) })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur md:-mx-10 md:px-10">
        {moving > 0 && (
          <p role="status" className="w-full text-sm text-amber-800">
            {moving} open booking{moving === 1 ? '' : 's'} will move to the new sale date and be emailed when you save.
          </p>
        )}
        <Button type="submit" loading={saving}>
          {mode === 'create' ? 'Create product' : 'Save changes'}
        </Button>
        {mode === 'update' && (
          <>
            {p.status !== 'active' && (
              <Button variant="secondary" onClick={() => setStatus('active')}>
                Publish
              </Button>
            )}
            {p.status === 'active' && (
              <Button variant="secondary" onClick={() => setStatus('draft')}>
                Unpublish
              </Button>
            )}
            {p.status !== 'archived' && (
              <Button variant="ghost" onClick={() => setStatus('archived')}>
                Archive
              </Button>
            )}
          </>
        )}
        <span className="text-sm text-muted">Status: {p.status}</span>
        {msg && (
          <span role="status" className={msg.ok ? 'text-sm' : 'text-sm text-sale'}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
