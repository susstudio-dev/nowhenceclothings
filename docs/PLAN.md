# Nowhence — Build Plan

Phases run as parallel workstreams once the shared foundation exists.
Each workstream has a dedicated agent in `.claude/agents/`.

```
Phase 0  Foundation (blocking) ──┬─► WS-A Design system & brand
                                 ├─► WS-B Storefront
                                 ├─► WS-C Commerce (cart→checkout→Razorpay→orders→email)
                                 ├─► WS-D Admin studio
                                 └─► WS-E SEO, content seed & legal pages
                                          │
Phase 5  Integration & QA  ◄─────────────┘  (qa-reviewer)
```

## Phase 0 — Foundation · agent `foundation-engineer`
- [x] Scaffold Next.js 15 + OpenNext + Tailwind + Vitest (versions as furor-web)
- [x] `wrangler.jsonc` → worker `nowhence`, bucket `nowhence-content`, `workers_dev:false`
- [x] Port `storage.ts`, add `writeJsonCas` helper + tests
- [x] zod schemas for every doc in ARCHITECTURE §2–3
- [x] Port auth, password, roles, guard, audit, session claims from furor-web
- [x] Seed `data/` with 8 placeholder products, 2 categories, 1 drop, settings
- [x] Stub shared UI primitives so other agents compile
- [x] `npm run typecheck && npm test && npm run build` green
**Exit:** contracts in ARCHITECTURE §5 exist and are frozen. Reference: [CONTRACTS.md](CONTRACTS.md).

## WS-A — Design system · agent `design-system-engineer`
- [x] Tokens: colour, type scale, spacing, radii, motion (D11)
- [x] Fonts via `next/font`, logo placeholder wordmark
- [x] Primitives in `components/ui` with states + a11y
- [x] Header (nav, search, cart count), footer, announcement bar
- [x] `docs/DESIGN.md` describing the system

## WS-B — Storefront · agent `storefront-engineer`
- [x] Home (S1), Shop/collection with filters (S2), Product page (S3), Drops (S4)
- [x] Search (S10), Lookbook/journal renderer (S8)
- [x] Image component using R2 variants (`/media/[...path]` route serving R2 variants)

## WS-C — Commerce · agent `commerce-engineer`
- [x] `lib/commerce/pricing.ts` (C1, C3, C4, C5) + tests
- [x] Cart store + drawer + page (S5)
- [x] `/api/checkout` → create order + Razorpay order (C5, C6)
- [x] `/api/razorpay/verify` + `/api/razorpay/webhook` idempotent (C6, C7)
- [x] Stock decrement with CAS + oversell handling (C7)
- [x] Checkout page + confirmation (S6), order tracking (S7)
- [x] Resend emails (C8), notify-me + newsletter endpoints

## WS-D — Admin studio · agent `admin-engineer`
- [x] Login, session, roles (A1), team (A7), audit (A8)
- [x] Products + variants + media upload (A2), inventory (A3)
- [x] Orders list/detail/status/CSV (A4)
- [x] Coupons, sale pricing, settings (A5)
- [x] Content editor with drafts/preview/versions (A6)

## WS-E — Content, SEO & legal · agent `content-seo-engineer`
- [x] Static pages (S9) with placeholder copy in brand voice
- [x] Metadata, OG, JSON-LD, sitemap, robots (S11)
- [x] CSP + security headers, edge cache headers

## Phase 5 — Integration & QA · agent `qa-reviewer`
- [ ] Typecheck, lint, tests, OpenNext build green
- [ ] End-to-end walk: browse → cart → checkout (Razorpay test mode) → admin marks shipped
- [ ] Security review (auth, webhook, CAS, CSP), a11y + perf audit
- [x] Write `docs/QA-REPORT.md` with findings + fixes

## WS-F — Owner customisation (A9) · agent `admin-engineer`
- [x] Settings schema: brand (logo, favicon, wordmark, fonts, colours), returns policy, legal (address, jurisdiction, dates), email sender name
- [x] Admin Settings tabs: Brand · Shipping · Returns · Legal · Email, with live preview + contrast check
- [x] Media library page (upload, alt text, reuse)
- [x] Storefront chrome, fonts, colours, favicon read from settings (CSS variables, no rebuild)
- [x] Static/legal pages read from settings + editable markdown; remove hard-coded copy in `src/lib/static-pages.ts`
- [x] Launch-readiness checklist on admin dashboard
- [x] Tests + typecheck green

## WS-G — Coming soon + presale (A10, A11) · agent `commerce-engineer`
- [x] Schema: availability, comingSoon, presale on product/drop + Settings → Launches defaults (additive, old data parses)
- [x] Admin: product "Availability" tab, Settings → Launches, blurred-variant generation, notify-list view + "email list"
- [x] Storefront: blurred cards/page, badges, countdown, `/coming-soon`, home section, pre-order CTA, access code gate
- [x] Checkout: presale cap + per-customer limit via CAS, no mixed carts, `preorder` flag, auto-switch at dates
- [x] Orders: preorder filter + ship-by
- [x] Seed: 5 polos from `assets/photography`
- [x] Tests + typecheck green

## WS-H — Brand pass + perf (A12, audit findings) · agent `design-system-engineer`
- [x] Logo SVGs as default wordmark/favicon/app icon; Jost added; monochrome defaults
- [x] Home hero from photography; home meta description fallback
- [x] Font loading (fewer weights, adjustFontFallback), modern browserslist, home caching
- [x] Typecheck/tests/build green

## WS-I — Pre-booking with deposit (A13) · agent `commerce-engineer`
- [x] Schema: presale paymentMode full|deposit, deposit config, Booking doc `bookings/{id}.json` + index (additive)
- [x] `/book/{slug}` page (code gate) → deposit Razorpay order → verify/webhook → booking + email with `/pay/{token}`
- [x] Sale-start transition (request-time + cron) → balance_due emails; `/pay/{token}` balance checkout → normal paid order
- [x] Expiry per configured outcome; deposit refunds via Razorpay refund API
- [x] Admin: product pre-booking settings, booking link copy + QR, Bookings list/detail/actions/CSV
- [x] Tests (deposit/balance math, cap CAS, token unguessable, transitions, idempotent webhooks) + QA — tests in `bookings*.test.ts`, `qr.test.ts`; QA pass 2026-10-17 (QA-REPORT "WS-I + WS-J")

## WS-J — Edge caching for Worker responses · agent `qa-reviewer`
- [x] `custom-worker.mjs`: Cache API for anonymous GET of public pages honouring `s-maxage`; bypass admin cookie, cart/checkout/api; purge on admin publish

## Phase 6 — Launch (owner + engineer)
- [ ] Create R2 bucket, set secrets (`JWT_SECRET`, `ADMIN_OWNER_*`, `RAZORPAY_*`, `RESEND_API_KEY`)
- [ ] Attach `nowhenceclothings.com` route, Razorpay live keys + webhook URL
- [ ] Replace placeholder brand assets and catalogue
