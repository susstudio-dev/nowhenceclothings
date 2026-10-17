# Nowhence — Architecture

## 1. Runtime

```
Browser ──► Cloudflare Worker (Next.js 15 via OpenNext, nodejs_compat)
               │  app router pages (SSR), route handlers under /api
               ├─► R2 bucket `nowhence-content`   (binding CONTENT_BUCKET)
               │      data docs · orders · media · OpenNext cache (prefix)
               ├─► Razorpay API (fetch)
               └─► Resend API  (fetch)
Razorpay ──webhook──► /api/razorpay/webhook
```

`next dev` uses the local `data/` and `public/uploads/` folders; the storage
layer switches automatically (copied from furor-web `src/lib/storage.ts`).

## 2. R2 key layout (the "database")

| Key | Shape | Writers | Concurrency |
|---|---|---|---|
| `catalogue.json` | `{ version, products[], categories[], collections[], drops[] }` | admin | ETag CAS, versioned in `versions/catalogue/` |
| `inventory.json` | `{ [sku]: { stock, reserved, lowStockAt } }` | admin + order confirm | ETag CAS with retry (max 5) |
| `site-content.json` | home, nav, announcement, pages, lookbook, journal | admin | ETag CAS + drafts + versions |
| `settings.json` | shipping fee, free-ship threshold, store info, tax | owner | ETag CAS |
| `coupons.json` | `{ coupons[] }` incl. `usedCount` | admin + order confirm | ETag CAS |
| `orders/{orderId}.json` | one order | checkout, webhook, admin | per-object ETag CAS |
| `orders-index/{yyyy-mm}.json` | lightweight summaries for admin lists | order write | ETag CAS append |
| `notify/{sku}.json` | back-in-stock / drop emails | storefront | ETag CAS append |
| `newsletter.json` | signups | storefront | ETag CAS append |
| `users.json` | admin users (furor `users.ts`) | owner | ETag CAS |
| `audit/{yyyy-mm}.json` | admin write log | all admin writes | append |
| `payment-events/{yyyy-mm}.json` | Razorpay events | webhook | append |
| `media/{id}/{w}.{avif,webp}` | images | admin upload | immutable |
| `versions/{doc}/{ts}.json` | snapshots | admin | immutable |
| `_cache/…` | OpenNext incremental cache | OpenNext | — |

Rules:
- Every shared doc write goes through `writeJsonCas(key, mutate)` → read with etag →
  mutate → `put(onlyIf: etagMatches)` → retry on `null`.
- Each doc has a **zod schema** in `src/lib/schemas/`; reads validate, writes validate.
- Money = integer **paise**. IDs = `crypto.randomUUID()`; order numbers `NWH-YYMMDD-XXXX`.

## 3. Core types (src/lib/schemas)

```ts
Product { id, slug, title, description, categoryId, collectionIds[], dropId?,
  status: 'draft'|'active'|'archived', price, compareAtPrice?, saleEndsAt?,
  colours: { id, name, hex, images: MediaRef[] }[],
  sizes: ('XS'|'S'|'M'|'L'|'XL'|'XXL')[],
  variants: { sku, colourId, size, priceOverride? }[],
  fabric, care, fit, sizeChartId, seo, createdAt, updatedAt }
Drop { id, name, slug, releaseAt, heroMedia, description }
Order { id, number, email, phone, shippingAddress, lines[{sku, title, colour, size,
  qty, unitPrice}], subtotal, discount, shipping, total, couponCode?,
  status, razorpayOrderId, razorpayPaymentId?, tracking?, history[{at, status, by}],
  createdAt }
MediaRef { id, alt, width, height }
```

## 4. Source layout

```
src/
  app/
    (shop)/              storefront routes  — owner: storefront agent
    admin/               studio routes      — owner: admin agent
    api/checkout/ api/razorpay/ api/orders/  — owner: commerce agent
    api/admin/           admin API          — owner: admin agent
  components/ui/         design system primitives — owner: design-system agent
  components/shop/       storefront components   — storefront agent
  components/admin/      studio components       — admin agent
  lib/                   storage, cas, auth, schemas, pricing… — foundation agent
  lib/commerce/          pricing, stock, razorpay, email — commerce agent
data/                    local dev seed docs
```

## 5. Shared contracts (frozen after Phase 0)

- `src/lib/storage.ts` — `readJson`, `writeJsonCas`, `putMedia`, `listKeys`.
- `src/lib/schemas/*.ts` — zod schemas + inferred types above.
- `src/lib/auth.ts`, `src/lib/guard.ts` — `requireAdmin(role)`.
- `src/lib/catalogue.ts` — `getCatalogue()`, `getProductBySlug()`, `getStock(sku)`.
- `src/components/ui/*` — Button, Input, Select, Drawer, Dialog, Accordion, Price, Image.
- Design tokens in `tailwind.config.ts` + `src/app/globals.css`.

Agents may **add** to shared modules but must not change existing signatures.
