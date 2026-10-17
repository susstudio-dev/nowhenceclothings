# Nowhence: shared contracts (frozen after Phase 0)

This is the API surface that every workstream builds on. You may **add** exports. Do not rename or change existing signatures. If a contract needs to change, raise it with the team rather than editing it.

## Storage: `src/lib/storage.ts` (server-only)

Under `next dev` and vitest, documents live in `data/` and media in `public/media/`. On Workers they live in R2 through the `CONTENT_BUCKET` binding.

| Export | Signature / purpose |
|---|---|
| `readJson<T>(key, schema)` | Returns `Promise<T \| null>`: null if the document is absent, and throws `DocValidationError` if it fails its schema. |
| `readJsonWithVersion<T>(key, schema)` | Returns `{ data, version } \| null`. |
| `writeJsonCas<T>(key, schema, mutate, { retries = 5, initial? })` | Reads with an etag, runs `mutate(current \| null)`, validates the result and writes it conditionally. It retries when another write lands first and throws `CasConflictError` once retries run out. `mutate` must be **pure** because it can run more than once. Throw inside it to abort. |
| `createJson<T>(key, schema, data)` | Creates the object only if it is absent and returns `false` if the key already exists. Use it for `orders/{id}.json`. |
| `snapshotVersion(doc, data)` | Writes `versions/{doc}/{ts}.json` and returns the key. |
| `putMedia(id, width, format, bytes)` | Writes `media/{id}/{w}.{avif\|webp\|jpg\|png}` and returns its public URL `/media/...`. |
| `readMedia(id, width, format)` | Used by the `/media/[...path]` route handler (WS-B builds this route). |
| `mediaKey`, `mediaUrl`, `MEDIA_CONTENT_TYPES` | Helpers. |
| `listKeys(prefix)`, `deleteKey(key)` | Return `{ key, uploadedAt }[]` and delete a key, respectively. |
| Low level (ported) | `readText`, `writeText`, `readDocWithVersion`, `writeDocIfMatch`, `readJSON`, `writeJSON`, `isRemoteStorage`, `storageMisconfigured`. Shared documents must use the typed helpers above, not these. |
| Errors | `DocValidationError(key, issues)`, `CasConflictError(key, attempts)`, `StorageUnavailableError`. |

## Schemas: `src/lib/schemas` (import from `@/lib/schemas`)

| File | Exports |
|---|---|
| `common.ts` | `Paise`, `IsoDate`, `Slug`, `Id`, `Email`, `Phone` (10 digits), `Pincode`, `SIZES`/`Size`, `MediaRef {id, alt, width, height, widths[], src?}`, `Seo`, `Address` |
| `catalogue.ts` | `CATALOGUE_KEY`, `CatalogueDoc {version, products, categories, collections, drops, sizeCharts}`, `Product`, `Colour`, `Variant {sku, colourId, size, priceOverride?, compareAtPriceOverride?}`, `Category`, `Collection`, `Drop`, `SizeChart`, `ProductStatus`. `CatalogueDoc` rejects duplicate SKUs and slugs and any unknown `colourId`/size. |
| `inventory.ts` | `INVENTORY_KEY`, `InventoryDoc = Record<sku, {stock, reserved, lowStockAt}>`, `available(level)` |
| `settings.ts` | `SETTINGS_KEY`, `SettingsDoc {shipping{flatFee, freeShippingThreshold, eta}, tax, store, orders{paymentWindowMinutes, returnWindowDays, maxQtyPerLine}, email{from, replyTo}}` |
| `coupons.ts` | `COUPONS_KEY`, `CouponsDoc`, `Coupon` (discriminated on `type`: `percent` {value 1-100, maxDiscount?}, `flat` {value paise}, `free_shipping`), `CouponCode` (normalised to upper case) |
| `order.ts` | `orderKey(id)`, `ordersIndexKey(date)`, `Order`, `OrderLine`, `OrderStatus`/`ORDER_STATUSES`, `ORDER_TRANSITIONS`, `canTransition`, `OrderNumber`, `newOrderNumber()` → `NWH-YYMMDD-XXXX`, `Tracking`, `OrderSummary`, `OrdersIndexDoc`, `summarize(order)`. An order also carries `stockCommittedAt?` and `emailsSent[]` as idempotency guards. |
| `site-content.ts` | `SITE_CONTENT_KEY`, `SITE_CONTENT_DRAFT_KEY` (`drafts/site-content.json`), `SiteContentDoc {announcement, nav{primary, footer}, home{blocks, seo}, pages{[slug]: Page}, lookbook[], journal[]}`, `Block` (`hero`, `richText`, `image`, `gallery`, `productGrid`, `featuredDrop`, `categoryTiles`, `story`, `quote`, `faq`, `newsletter`), `Page`, `Article`, `NavItem`, `Link`, `STATIC_PAGE_SLUGS` |
| `logs.ts` | `notifyKey(sku)`/`NotifyDoc`, `NEWSLETTER_KEY`/`NewsletterDoc`, `auditKey(date)`/`AuditDoc`/`AuditEntry`, `paymentEventsKey(date)`/`PaymentEventsDoc`/`PaymentEvent` (`eventId` is the idempotency key) |
| `users.ts` | `USERS_KEY`, `UsersDoc`, `User` (a single `role`), `RoleId` = `'owner' \| 'manager' \| 'editor'`, `ROLE_IDS`, `findByEmail` |

## Auth and admin: `src/lib`

| Module | Exports |
|---|---|
| `auth.ts` | `SESSION_COOKIE = 'nowhence_admin'`, `verifyCredentials(email, pw)`, `createSessionToken({uid, email, role, sv, brk?})`, `verifySessionToken`, `setSessionCookie`, `clearSessionCookie`, `getSession`, `recordAttempt(ip)`/`clearAttempts(ip)` (5 attempts per 10 minutes), `BREAK_GLASS_UID` |
| `guard.ts` | `requireAdmin(role = 'editor')`: for pages and server actions. It redirects to `/admin/login` or `/admin`. `requireCapability(cap)`. `getAdmin()`. `authorizeAdmin(role?, cap?)` for route handlers returns `{ok:true, admin}` or `{ok:false, response}` (401/403 JSON). |
| `roles.ts` | `Capability`, `ROLE_RANK`, `ROLE_LABELS`, `ROLE_CAPABILITIES`, `roleAtLeast`, `roleHas` |
| `admin-subject.ts` | `AdminSubject`, `resolveAdminFromClaims` (pure). The role comes from the store, not the token. |
| `users.ts` | `readUsers()` (returns null if the store can't be read), `getUserById`, `updateUsers(mutate)` (CAS) |
| `password.ts` | `hashPassword`, `verifyPassword` (PBKDF2, 50k iterations, using WebCrypto) |
| `session-claims.ts` | `SessionClaimsSchema` |
| `audit.ts` | `audit({actor, action, target?, detail?})`: best-effort and never throws. Appends to `audit/{yyyy-mm}.json`. `readAudit(limit)` returns the newest entries first. |

Capabilities:

- Owner has all of them.
- Manager has all except `users.manage` and `settings.write`.
- Editor has only `catalogue.write`, `content.write` and `media.write`.

## Read APIs

- **`catalogue.ts`:** `getCatalogue()`, `getActiveProducts()`, `getProductBySlug(slug, {includeDrafts?})`, `getProductById`, `findVariant(sku)` → `{product, variant, colour}`, `getInventory()`, `getStock(sku)` → units available as a `number`, `getStockLevel(sku)`, `isReleased(product, drops, now?)`.
- **`content.ts`:** `getSiteContent({draft?})`, `getSettings()`.
- **`money.ts`:** `formatPaise`, `rupeesToPaise`, `assertPaise`.

## UI: `src/components/ui` (stubs with their final props; WS-A styles them)

`Button {variant: primary|secondary|ghost|link, size, loading, fullWidth, iconLeft, iconRight}` · `Input {label, hint?, error?, hideLabel?}` · `Select {label, options[], placeholder?, error?}` · `Drawer {open, onClose, title, side?, footer?}` · `Dialog {open, onClose, title, description?, footer?}` · `Accordion {items[{id,title,content}], defaultOpen?}` · `Price {amount, compareAt?, size?}` (paise) · `Image {media: MediaRef, sizes?, priority?, alt?}` + `mediaSrcSet` · `cn()`.

Design tokens: the colours `paper`, `ink`, `muted`, `line`, `accent` and `sale` are CSS variables set in `globals.css`, and the font families are `display` and `sans`. WS-A may add tokens but should keep these names.

## Seed and scripts

- **Seed:** run `npm run seed` to regenerate `data/{catalogue,inventory,settings,coupons,site-content}.json`. It produces 8 products, 78 SKUs, 2 categories, 1 collection, the drop `drop-001` (releases 2026-11-15, with 2 products in it) and 3 coupons. The seed is checked by `schemas.test.ts`.
- **Admin password hash:** run `npm run hash-password -- '<pw>'`.
- **Tests:** they run against the real `data/` folder. Use the `__test__/` key prefix for scratch documents.

## Notes for other workstreams

- `src/app/page.tsx` is a placeholder. WS-B must **delete** it when it adds `src/app/(shop)/page.tsx`, because the two routes conflict.
- The `/media/[...path]` serving route doesn't exist yet. WS-B owns it, and admin uploads (WS-D) depend on it.
- There's no ESLint config yet (`next lint` prompts for one). The QA phase owns setting it up.
- `npm install` fails on npm 11 with an `edgesOut` error. `.npmrc` sets `legacy-peer-deps=true` to avoid it.
