# Nowhence — Requirements

> **Brand:** Nowhence · **Domain:** nowhenceclothings.com
> **Positioning:** Premium, unisex, direct-to-consumer clothing label.
> **Date:** 2026-10-17 · **Status:** v1 baseline (defaults recorded in [DECISIONS.md](DECISIONS.md))

## 1. Goals

1. A storefront that *feels* premium: editorial imagery, restrained typography,
   fast (LCP < 2.0 s on 4G mobile), no template look.
2. Sell unisex apparel online in India with Razorpay checkout.
3. Owner runs catalogue, stock, orders, coupons and site content from an admin
   studio with no engineer in the loop.
4. Runs entirely on Cloudflare (Workers + R2). No Supabase, no SQL database.

## 2. Reference projects

| Take from | What |
|---|---|
| `../ravisweets` | Commerce feature set: catalogue, product page, cart, checkout, coupons, sale pricing, order flow, admin commerce screens, Razorpay order function, order emails. |
| `../furor-web` | Infrastructure: Next.js on Workers via OpenNext, **R2 as the data store** (`src/lib/storage.ts`, ETag compare-and-swap), JWT + PBKDF2 auth, roles, audit log, drafts/versions, image variants, edge cache headers, payment log. |

Do **not** carry over: Supabase, Medusa (`apps/backend`), festivals, nutrition,
veg marks, kitchen "worlds", corporate gifting, NRI pages.

## 3. Storefront — functional requirements

| ID | Requirement |
|---|---|
| S1 | **Home**: full-bleed campaign hero (image/video), featured drop, category tiles, editorial story block, newsletter signup. All content admin-editable. |
| S2 | **Shop / collection pages**: grid by category or collection; filters (size, colour, price), sort (new, price ↑↓); sold-out items stay visible, marked. |
| S3 | **Product page**: gallery (zoom, swipe on mobile), colour swatches, size selector XS–XXL with per-size stock, unisex size guide (chest/length/shoulder in cm + in, "model is 183 cm wearing M"), fabric & care, shipping/returns accordion, "complete the look", notify-me on sold-out sizes. |
| S4 | **Drops**: a product can belong to a drop with `releaseAt`; before release it shows a countdown and "notify me"; after, it is purchasable. |
| S5 | **Cart**: drawer + page, quantity edit, coupon entry, free-shipping threshold progress, persisted in `localStorage`. |
| S6 | **Checkout**: guest checkout (name, email, phone, address with PIN-code), shipping method, Razorpay payment, order confirmation page. |
| S7 | **Order lookup**: `/orders/track` by order number + email; no customer accounts in v1. |
| S8 | **Lookbook / journal**: editorial pages built from admin content blocks. |
| S9 | **Static pages**: About/story, Contact, FAQ, Size guide, Shipping, Returns & exchange, Privacy, Terms. |
| S10 | **Search**: client-side search over the catalogue document. |
| S11 | **SEO**: per-page meta, Open Graph, `Product` + `BreadcrumbList` JSON-LD, sitemap, robots; only `nowhenceclothings.com` crawlable. |
| S12 | **Accessibility**: WCAG 2.2 AA, keyboard navigable, reduced-motion respected. |

## 4. Commerce — functional requirements

| ID | Requirement |
|---|---|
| C1 | Prices in INR, tax-inclusive (GST), stored as integer paise. |
| C2 | Variants = colour × size, each with SKU, stock, optional price override. |
| C3 | Sale pricing: `compareAtPrice` per product/variant with optional end date. |
| C4 | Coupons: % off, flat off, free shipping; min order, expiry, usage limit. |
| C5 | Server re-computes every price, discount, shipping fee and stock check on order creation — client totals are never trusted. |
| C6 | Razorpay: server creates the Razorpay order; payment confirmed only via verified signature (client callback **and** webhook, idempotent). |
| C7 | Stock is decremented once on payment confirmation, with ETag compare-and-swap retry; oversell is rejected and refunded. |
| C8 | Order emails (confirmation, shipped, refunded) via Resend. |
| C9 | Order states: `pending_payment → paid → packed → shipped → delivered`, plus `cancelled`, `refunded`, `exchange_requested`. |

## 5. Admin studio — functional requirements

| ID | Requirement |
|---|---|
| A1 | Login (email + password, PBKDF2), roles: `owner`, `manager`, `editor`. |
| A2 | Products: create/edit/archive, variants grid, image upload to R2 with auto variants (AVIF/WebP, multiple widths), drag reorder, alt text. |
| A3 | Inventory: per-variant stock edit, low-stock list. |
| A4 | Orders: list + filter by status, detail view, change status, add tracking number, mark refunded, CSV export. |
| A5 | Coupons and sale pricing editor. |
| A6 | Content: home, lookbook/journal, static pages, navigation, announcement bar — with draft → preview → publish and version history (furor pattern). |
| A7 | Team: invite/remove users, assign roles (owner only). |
| A8 | Audit log of every admin write. |
| A9 | **Everything owner-specific is editable in admin — nothing hard-coded:** (a) launch range via Products/Categories/Collections/Drops; (b) **Brand**: logo (SVG/PNG upload, light + dark), favicon, wordmark text, display + body font chosen from a curated `next/font` list, ink/paper/accent colours (contrast-checked); (c) **Photography**: media library (upload, alt text, reuse across products/content); (d) **Shipping**: flat fee, free-shipping threshold, ETA copy; (e) **Returns**: window days, exchange/return allowed, policy text; (f) **Legal**: legal company name, GSTIN, registered address, jurisdiction city, policy "last updated" dates; (g) **Email**: from-address, reply-to, sender name. Static/legal pages render from these settings + admin-editable markdown, so `[[TBD]]` disappears once filled. Settings show a "launch readiness" checklist of empty required fields. |
| A10 | **Coming soon (admin-configurable).** Product `availability`: `available` · `coming_soon` · `presale` · `sold_out`. Per product (falling back to global defaults in Settings → Launches): blur images on/off, blur strength, show/hide title, show/hide price, teaser text, badge text, reveal date (auto-switch to presale or available), notify-me on/off, show in shop grid / home "Coming soon" section / `/coming-soon` page. **Secrecy:** while blurred, the storefront only ever receives a pre-blurred image variant (generated in the admin's browser on upload or on toggle and stored in R2) — never the sharp original, so it can't be un-blurred via devtools. |
| A11 | **Presale (admin-configurable)** per product or drop: enabled, start/end, presale price (optional), total presale cap and per-customer limit, estimated ship date + copy, access = public · access-code · waitlist-only (email on notify list), terms text, "Pre-order" CTA label, auto-switch to available at end. Full payment up front via Razorpay. Presale orders are flagged `preorder` with ship-by date, filterable in Admin → Orders; presale units count against the presale cap, not inventory. Carts cannot mix presale and in-stock items (clear message). Admin can email the notify list when a presale opens (Resend). |
| A13 | **Pre-booking with deposit (admin-configurable)** — extends A11 with presale payment mode `full` · `deposit`. Per product (and drop): enable pre-booking, **deposit amount** (fixed ₹ or % of price), booking window open/close, booking cap + per-customer limit, sale start date, **balance window** (days after sale start to pay), price lock (final price fixed at booking vs price at sale start), deposit refundable yes/no + policy text, unpaid-balance outcome (forfeit / auto-refund / admin decides).<br>**Booking link:** each pre-bookable product has a shareable link `/book/{slug}` (optional `?code=` for private access) plus a "copy link" + QR in admin. Customer picks colour/size → pays deposit via Razorpay → gets a booking `NWB-…` and a private **balance link** `/pay/{bookingToken}` (unguessable token).<br>**Sale start:** at sale start (request-time check + cron) the booking becomes `balance_due`; the customer is emailed the balance link (admin can resend / send reminders). Balance = final price − deposit (+ shipping), server-computed; paying it converts the booking into a normal paid order (stock committed, fulfilment as usual). After the balance window → booking `expired` → handled per the configured outcome.<br>**Admin → Bookings:** list/filter (deposit_paid, balance_due, completed, expired, refunded, cancelled), totals of deposits collected, resend link, extend deadline, cancel + refund deposit, CSV export. Size/colour reserved against the booking cap at deposit time. |
| A12 | **Brand defaults from owner assets** (`assets/brand/logo`, `assets/photography`): SVG wordmark in header/footer, symbol as favicon/app icon, white logo on dark imagery; monochrome UI (ink `#0B0B0B`, paper `#F4F4F2`, grey accent) so the earthy product colours carry; Jost display + Inter Tight body. All still overridable in Settings → Brand. |

## 6. Non-functional requirements

- **Platform**: Cloudflare Workers (OpenNext) + one R2 bucket `nowhence-content`.
- **Performance**: LCP < 2.0 s mobile; JS < 150 KB gz on product page; images served as AVIF/WebP at right width.
- **Security**: CSP, secrets via `wrangler secret`, admin routes guarded server-side, webhook signature verification, rate-limited login, no PII in logs.
- **Reliability**: all R2 writes to shared documents use ETag CAS; orders are one object each.
- **Testing**: Vitest unit tests for every `src/lib` module; build + typecheck green.
- **Dev parity**: `next dev` uses local `data/` folder exactly like furor.

## 7. Out of scope for v1

Customer accounts, wishlist, international shipping/multi-currency, reviews,
gift cards, loyalty, marketplace integrations, POS. (See DECISIONS.md.)
