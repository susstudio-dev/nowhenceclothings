# Nowhence: Phase 5 QA report

Date: 2026-10-17 · Reviewer: `qa-reviewer` · Nothing committed.

## 1. Command results (real output, final run after fixes)

| Command | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | exit 0, no errors. (Stale `.next/types` from the deleted placeholder page were removed first.) |
| `npm test` (`vitest run`) | `Test Files 27 passed (27)` · `Tests 206 passed (206)`. Run 3 more times in a row: same result each time. |
| `npx next build` | Compiled successfully; all routes listed (shop, admin, API, sitemap, robots, manifest); Middleware 39.5 kB. |
| `npx opennextjs-cloudflare build` | `Worker saved in .open-next\worker.js` · `OpenNext build complete.` · exit 0. Warns that OpenNext is not fully supported on Windows. |
| `npx next lint` | **Not configured.** It opens an interactive ESLint setup prompt. No ESLint config exists. |

Before the fixes, `npm test` showed `2 failed | 204 passed` (see F1).

## 2. End-to-end walk (`next dev -p 3100`, curl)

The first run had no secrets. The second run used throwaway env values (fake Razorpay keys, a local JWT secret and local owner credentials). No real secrets were used.

| Step | Request | Result |
|---|---|---|
| Pages | `/`, `/shop`, `/products/tee-heavyweight`, `/faq`, `/cart`, `/sitemap.xml` | 200 |
| Admin page, logged out | `/admin/orders` | 307 to login |
| Quote | `POST /api/checkout/quote` 2× `NWH-TEE-BON-S` | subtotal 499800, shipping 0 (over the 299900 free-shipping threshold), total 499800 paise |
| Sold-out quote | `NWH-TEE-BON-XS` | `issues:[{issue:"out_of_stock",available:0}]` |
| Checkout with a fake `"total":100` from the client | `POST /api/checkout` | Without keys: 503 `payments_unconfigured`. With fake keys: 502 "Payment provider is unavailable". The client total is ignored and the server prices from the catalogue. No order or Razorpay map was left behind. |
| Verify, bad signature | `POST /api/razorpay/verify` | 400 "Payment could not be verified." |
| Verify, correct HMAC, unknown order | | 404 "Order not found." |
| Webhook, bad signature | `POST /api/razorpay/webhook` | 400 `invalid signature` |
| Webhook, correct HMAC, unknown order | | 200 `{"result":"not_found"}` (logged, so Razorpay does not retry it forever) |
| Admin login | `POST /api/admin/auth/login` | 200 `{"ok":true}` |
| Admin orders page with cookie | `/admin/orders` | 200 |
| Admin status change, logged out | `PATCH /api/admin/orders/x` | 401 |
| Admin status change, cross-site Origin | | 403 `Bad origin` (F2) |
| Admin status change, logged in, missing order | | 404 |
| Security headers | `HEAD /` | CSP, HSTS (preload) and `X-Frame-Options: DENY` present |

**Not walked: a paid order through Razorpay test mode, and marking that order shipped.** This needs real `rzp_test_*` keys and a browser. The same path is covered by tests in `src/lib/commerce/orders.test.ts`: checkout, then verify and webhook racing to confirm one payment, oversell refund, amount mismatch, and lookup. Admin order status rules are covered in `src/lib/admin/orders.test.ts`. The QA scratch data (`payment-events/`, `audit/`) was deleted afterwards.

## 3. Security, money and stock review

| Check | Verdict |
|---|---|
| Client totals never trusted | OK. `lib/commerce/checkout.ts` builds the Razorpay amount from the server quote (`q.total`, line 86) and refuses the order if the Razorpay amount does not match (line 90). |
| Razorpay signature checked timing-safe | OK. `lib/commerce/razorpay.ts:31` compares byte by byte in constant time. It is used by verify (line 47) and the webhook (line 54). |
| Webhook idempotent | OK. Duplicate events are dropped by event id, and `confirmPayment` is safe to run twice (race test passes). The amount is checked against the order. |
| Every shared write uses CAS | OK. No plain `writeJson` or `writeText` calls outside `storage.ts`. Media uses `putMedia`. |
| Admin routes guarded on the server | OK. Every `api/admin/*` route uses `adminRoute` (role or capability check) except `auth/login`, which is public on purpose and checks the Origin. Pages sit behind middleware plus the layout guard. |
| No secrets committed | OK. `.dev.vars` and `.env*` are gitignored. Only `.dev.vars.example` with placeholders exists. A search for `rzp_live_/rzp_test_/re_` keys found nothing. |
| CSP present | OK, but `script-src 'unsafe-inline'` is needed for Next's inline scripts (no nonces). `img-src https:` is wide because of the placehold.co seed images. |

## 4. Findings

| # | Sev | Where | Finding | Fixed? |
|---|---|---|---|---|
| F1 | High (test integrity) | `src/lib/storage-cas.test.ts:19-25` | The cleanup deleted the whole `data/__test__/` folder while the commerce tests (which run in parallel) were still using it. The stock test then reported "4 sold of 3" and the payment-race test failed. The stock code was correct; the shared folder was the problem. | **Yes.** The test now uses its own `__test__/storage-cas/` subfolder and sidecar file. 206/206 pass, 4 runs in a row. |
| F2 | Medium | `src/middleware.ts` | Admin write APIs (other than auth) had no cross-site request protection beyond the `lax` cookie setting. | **Yes.** The middleware now also covers `/api/admin/:path*` and returns 403 for non-GET requests with a foreign `Origin`. Verified with curl. |
| F3 | Medium | `src/app/(shop)/layout.tsx` | The cart drawer was mounted twice: `CartButton` already renders `CartDrawer`, and the layout rendered it again (two dialogs, two focus traps). There were also two skip links, one in the layout and one in the `Header`. | **Yes.** The extra `CartDrawer` and skip link are removed. |
| F4 | Low (SEO) | `src/app/(shop)/layout.tsx` | Organization and WebSite structured data (JSON-LD) was not rendered on any page. | **Yes.** It is now rendered through `jsonLdScript` in the shop layout, so admin pages don't get it. |
| F5 | Medium | `components/ui/Image.tsx` `mediaSrcSet` | Image `srcset` lists `.avif` for every width, but admin uploads are usually WebP only, so those image links break. | **Fixed (WS-C).** Optional `MediaRef.formats` (absent = `['webp']`); `mediaSrcSet` (now in `components/ui/media-src.ts`, re-exported) skips formats not stored and the `<img>` fallback picks a stored format; `/api/admin/media` records the formats present at every width. Tests: `components/ui/Image.test.ts`. |
| F6 | Medium | commerce | Unpaid orders never expire (no job runs after `paymentWindowMinutes`). Cancelling or refunding in admin doesn't restock. Marking an order shipped doesn't send the shipped email. | **Fixed (WS-C)** in `lib/commerce/lifecycle.ts`. Expiry is lazy (admin list/detail, order tracking) plus a cron: `custom-worker.mjs` wraps the OpenNext worker with `scheduled()` (wrangler `triggers.crons` every 15 min) that POSTs `/api/admin/orders/expire` with `x-cron-secret`; needs the `CRON_SECRET` secret (owner action), otherwise only lazy expiry runs. Admin cancel/refund from paid/packed restocks once (CAS clears `stockCommittedAt`); status → shipped/refunded sends the email once. Tests: `lib/commerce/lifecycle.test.ts`. |
| F7 | Medium | API | No rate limiting on checkout, order tracking, notify or newsletter. | No. Use a Cloudflare WAF rate-limit rule (owner action). |
| F8 | Low | `lib/commerce/orders.ts` | If the server fails after marking an order paid but before reducing stock, the order is left `paid` without `stockCommittedAt`. Nothing flags it in admin. | **Fixed (WS-C).** Admin orders list shows a banner and a per-row "Stock not deducted" flag; the order page has a **Commit stock** button (`POST /api/admin/orders/[id]/commit-stock`, CAS claim, rolls back on oversell). Tests: `lib/commerce/lifecycle.test.ts`. |
| F9 | Low | tooling | ESLint is not configured, so `next lint` opens an interactive prompt. | **Config added (WS-C):** `eslint.config.mjs` (`next/core-web-vitals` + `next/typescript`) and devDeps `eslint`, `eslint-config-next`, `@eslint/eslintrc` in `package.json`. Not installed here (no `npm install` allowed), so the lint error count is still unknown: run `npm install && npm run lint`. |
| F10 | Low | `public/` | `/icon.png` is referenced by the manifest and the Organization data but doesn't exist. | **Yes (WS-F)**, see §6. |
| F11 | Info | a11y / perf | Not audited in a real browser (the Playwright connection failed). From the code: 44px touch targets, radio-based swatches and sizes, `aria-live` messages, reduced-motion support, and pages work without JavaScript. Shared JS is 103 kB first load; the product page is 129 kB. | Needs a Lighthouse pass |

## 5. Remaining owner actions
1. Put real Razorpay **test** keys and a webhook secret in `.dev.vars`, then do a browser checkout and mark the order shipped in admin.
2. Add a Cloudflare Cache Rule so the HTML edge-cache headers take effect, plus WAF rate limits for `/api/checkout*`, `/api/orders/track`, `/api/notify` and `/api/newsletter`.
3. The build machine needs network access for `next/font/google`. Otherwise, switch to `next/font/local`.
4. Answer the legal facts shown as `[[TBD]]` (entity name, GSTIN, address, jurisdiction, dates).
5. Run Lighthouse and axe on `/`, `/shop` and a product page. Run `npm install && npm run lint` (ESLint config added). Set `wrangler secret put CRON_SECRET` to enable the unpaid-order expiry cron.

## 6. WS-F + follow-ups (integration pass, 2026-10-17)

### Commands (real output)
| Command | Result |
|---|---|
| `npm install` | OK; `package-lock.json` resynced with the new ESLint devDeps (F9). |
| `npm run typecheck` | No errors (WS-C's `Header.tsx` `brand` error was already fixed by WS-F). |
| `npx vitest run` | `Test Files 31 passed (31)` · `Tests 236 passed (236)` (235 + 1 new sender-name test). |
| `npm run lint` | Exit 0. **0 errors, 23 warnings** (unused `_x` destructure vars, 2 stale `eslint-disable` comments, 6 `jsx-a11y/alt-text` false positives on the custom `<Image media=…>` component, which takes alt from `media.alt`). | Update 2026-10-17: now 0 warnings, 0 errors (F15).
| `npx next build` | Exit 0. Shared first-load JS 103 kB; middleware 39.7 kB; `/icon.png` and `/manifest.webmanifest` dynamic routes present. |
| `npx opennextjs-cloudflare build` | Exit 0, "Worker saved in `.open-next\worker.js`", "OpenNext build complete." (`custom-worker.mjs` wraps it; not deployed, so the cron is still untested.) |

### Walk (`next dev -p 3100`, throwaway `JWT_SECRET` / owner creds, admin cookie from `POST /api/admin/auth/login` → 200)
| Step | Result |
|---|---|
| Dashboard readiness, initial settings | "Launch readiness · 8/17"; lists Favicon, Contact phone, Contact/studio address, Legal company name, GSTIN, Registered address, Jurisdiction city, Privacy policy date, Terms date, each linking to its settings tab. |
| Baseline `/` | `<style id="brand-vars">` sets only the default fonts (cormorant-garamond / inter-tight); `theme-color` `#f8f6f1`. |
| `PUT /api/admin/settings` (ink `#101820`, paper `#fdfcf8`, accent `#8a2b1d`, display font Playfair, legal name, jurisdiction Pune, returns 14 days, exchanges off, policy marker) | 200 |
| `/` right after, no rebuild | `--font-display:var(--font-playfair-display)`, `--c-ink:16 24 32;--c-paper:253 252 248;--c-accent:138 43 29` plus derived tones; `theme-color` `#fdfcf8`; Organization JSON-LD legal name updated. |
| `/returns` | "You have 14 days from delivery…", policy marker rendered from markdown; no exchange copy in the body once exchanges are off. |
| `/terms` | Legal name ×18, Pune ×8; `[[TBD]]` remains only for fields still empty (GSTIN, address, date), as intended. |
| Readiness after save | 10/17 (legal name and jurisdiction now filled). |
| PUT with ink `#dddddd` | 400 `Text on page (ink / paper) contrast is 1.32:1; needs 4.5:1`. |
| `/icon.png` | 200 `image/png` (F10 closed). |

`data/settings.json` was restored and the QA `data/audit/` scratch removed afterwards.

### Findings
| # | Sev | Where | Finding | Fixed? |
|---|---|---|---|---|
| F12 | Low | `src/lib/commerce/email.ts:118` | Saved email sender name was not used in the From header. | **Yes.** Now `from: emailFromHeader(settings.email)`; test added in `email.test.ts`. |
| F13 | Low | `src/app/api/admin/settings/route.ts` | Settings PUT was last-write-wins for stale forms. | **Fixed (2026-10-17).** `SettingsDoc.updatedAt` (default `''`) is stamped on every save; `SettingsForm` sends the value it loaded and the route returns 409 "Settings changed elsewhere — reload to see the latest" when the stored value differs (`isStaleSettingsWrite`). Tested in `src/app/api/admin/settings/route.test.ts`. |
| F14 | Info | `/returns` | Page title, SEO title, heading, footer label and PDP copy said "Returns & exchange" even with exchanges off. | **Fixed (2026-10-17).** `returnsLabel()` in `src/lib/static-pages.ts` derives Returns & exchange / Returns / Exchanges / Returns policy from settings; auto labels are swapped on the page, metadata and footer (custom labels kept). Tested in `static-pages.test.ts`. |
| F15 | Info | lint | 23 warnings, 0 errors. | **Fixed (2026-10-17).** Stale disable comments and an unused const removed; `no-unused-vars` ignores `_`-prefixed rest-omit names; `jsx-a11y/alt-text` scoped to DOM elements in `eslint.config.mjs` (custom `<Image>` takes alt from `media.alt`). `npm run lint`: no warnings or errors. |
| F9 | — | tooling | Now complete: deps installed, lockfile synced, lint runs non-interactively. | **Yes.** |
| F10 | — | `/icon.png` | Served by `src/app/icon.png/route.tsx`. | **Yes (WS-F).** |

### Remaining owner actions (updated)
1. `wrangler secret put CRON_SECRET` and deploy, then confirm the 15-minute cron hits `/api/admin/orders/expire` (untested here).
2. Fill the remaining readiness items in Admin → Settings (favicon, phone, addresses, GSTIN, policy dates) so no `[[TBD]]` remains.
3. Earlier items still open: real Razorpay test checkout in a browser, Cloudflare cache/WAF rate-limit rules (F7), Lighthouse/axe pass (F11).
