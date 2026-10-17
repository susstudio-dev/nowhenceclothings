'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StockRow } from '@/lib/admin/catalogue-mutations';
import { Button } from '@/components/ui';
import { adminFetch } from './api-client';

type Edit = { stock?: number; lowStockAt?: number };

export function InventoryTable({ rows, canEdit }: { rows: StockRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const dirty = Object.keys(edits).length;

  const update = (sku: string, patch: Edit) => setEdits((e) => ({ ...e, [sku]: { ...e[sku], ...patch } }));

  async function save() {
    setBusy(true);
    setMsg('');
    try {
      await adminFetch('/api/admin/inventory', {
        method: 'PATCH',
        body: { edits: Object.entries(edits).map(([sku, e]) => ({ sku, ...e })) },
      });
      setEdits({});
      setMsg('Saved');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const num = (v: string) => Math.max(0, Math.trunc(Number(v) || 0));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1">Product</th>
              <th>Colour</th>
              <th>Size</th>
              <th>SKU</th>
              <th>Stock</th>
              <th>Low at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const e = edits[r.sku] ?? {};
              const stock = e.stock ?? r.stock;
              const low = stock <= (e.lowStockAt ?? r.lowStockAt);
              return (
                <tr key={r.sku} className={`border-t border-line ${low ? 'bg-sale/5' : ''}`}>
                  <td className="py-1">{r.productTitle}</td>
                  <td>{r.colour}</td>
                  <td>{r.size}</td>
                  <td className="font-mono text-xs">{r.sku}</td>
                  <td>
                    <input
                      aria-label={`Stock for ${r.sku}`}
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={stock}
                      onChange={(ev) => update(r.sku, { stock: num(ev.target.value) })}
                      className="w-20 border border-line px-2 py-1"
                    />
                    {low && <span className="ml-2 text-xs text-sale">low</span>}
                  </td>
                  <td>
                    <input
                      aria-label={`Low-stock threshold for ${r.sku}`}
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={e.lowStockAt ?? r.lowStockAt}
                      onChange={(ev) => update(r.sku, { lowStockAt: num(ev.target.value) })}
                      className="w-16 border border-line px-2 py-1"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="sticky bottom-0 flex items-center gap-3 bg-paper py-3">
          <Button disabled={!dirty} loading={busy} onClick={save}>
            Save {dirty ? `${dirty} change${dirty > 1 ? 's' : ''}` : ''}
          </Button>
          {msg && <span role="status" className="text-sm">{msg}</span>}
        </div>
      )}
    </div>
  );
}
