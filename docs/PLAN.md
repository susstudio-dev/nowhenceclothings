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
- [ ] Scaffold Next.js 15 + OpenNext + Tailwind + Vitest (versions as furor-web)
- [ ] `wrangler.jsonc` → worker `nowhence`, bucket `nowhence-content`, `workers_dev:false`
- [ ] Port `storage.ts`, add `writeJsonCas` helper + tests
- [ ] zod schemas for every doc in ARCHITECTURE §2–3
- [ ] Port auth, password, roles, guard, audit, session claims from furor-web
- [ ] Seed `data/` with 8 placeholder products, 2 categories, 1 drop, settings
- [ ] Stub shared UI primitives so other agents compile
- [ ] `npm run typecheck && npm test && npm run build` green
**Exit:** contracts in ARCHITECTURE §5 exist and are frozen.

## WS-A — Design system · agent `design-system-engineer`
- [ ] Tokens: colour, type scale, spacing, radii, motion (D11)
- [ ] Fonts via `next/font`, logo placeholder wordmark
- [ ] Primitives in `components/ui` with states + a11y
- [ ] Header (nav, search, cart count), footer, announcement bar
- [ ] `docs/DESIGN.md` describing the system

## WS-B — Storefront · agent `storefront-engineer`
- [ ] Home (S1), Shop/collection with filters (S2), Product page (S3), Drops (S4)
- [ ] Search (S10), Lookbook/journal renderer (S8)
- [ ] Image component using R2 variants

## WS-C — Commerce · agent `commerce-engineer`
- [ ] `lib/commerce/pricing.ts` (C1, C3, C4, C5) + tests
- [ ] Cart store + drawer + page (S5)
- [ ] `/api/checkout` → create order + Razorpay order (C5, C6)
- [ ] `/api/razorpay/verify` + `/api/razorpay/webhook` idempotent (C6, C7)
- [ ] Stock decrement with CAS + oversell handling (C7)
- [ ] Checkout page + confirmation (S6), order tracking (S7)
- [ ] Resend emails (C8), notify-me + newsletter endpoints

## WS-D — Admin studio · agent `admin-engineer`
- [ ] Login, session, roles (A1), team (A7), audit (A8)
- [ ] Products + variants + media upload (A2), inventory (A3)
- [ ] Orders list/detail/status/CSV (A4)
- [ ] Coupons, sale pricing, settings (A5)
- [ ] Content editor with drafts/preview/versions (A6)

## WS-E — Content, SEO & legal · agent `content-seo-engineer`
- [ ] Static pages (S9) with placeholder copy in brand voice
- [ ] Metadata, OG, JSON-LD, sitemap, robots (S11)
- [ ] CSP + security headers, edge cache headers

## Phase 5 — Integration & QA · agent `qa-reviewer`
- [ ] Typecheck, lint, tests, OpenNext build green
- [ ] End-to-end walk: browse → cart → checkout (Razorpay test mode) → admin marks shipped
- [ ] Security review (auth, webhook, CAS, CSP), a11y + perf audit
- [ ] Write `docs/QA-REPORT.md` with findings + fixes

## Phase 6 — Launch (owner + engineer)
- [ ] Create R2 bucket, set secrets (`JWT_SECRET`, `ADMIN_OWNER_*`, `RAZORPAY_*`, `RESEND_API_KEY`)
- [ ] Attach `nowhenceclothings.com` route, Razorpay live keys + webhook URL
- [ ] Replace placeholder brand assets and catalogue
