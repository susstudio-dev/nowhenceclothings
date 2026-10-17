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

## WS-G + WS-H (2026-10-17)

Integrated WS-G (coming soon A10, presale A11) and WS-H (brand A12, perf). Nothing committed.

### Commands (real output)
| Command | Result |
|---|---|
| `npm run typecheck` | No errors (also re-run after the QA fixes below). |
| `npx vitest run` (from Git Bash `/d/...`) | `Test Files 34 failed (34)`, "Vitest failed to find the runner". This happens because the drive letter is lowercase, so vitest loads twice. It is a problem with how the shell was launched, not with the code. |
| `npx vitest run` (from `D:\...` via cmd) | `Test Files 34 passed (34)` · `Tests 267 passed (267)`. Three runs in a row were green. One earlier run had `2 failed / 265 passed`, which is the shared-data flake (F18). |
| `npm run lint` | WS-G added 2 unused `eslint-disable` directives, which gave 2 warnings. Fixed. Now `✔ No ESLint warnings or errors`. |
| `npx next build` | Exit 0. Shared first-load JS 103 kB; middleware 39.6 kB; `/coming-soon`, `/api/presale/access`, `/api/admin/launches/*` present. |
| `npx opennextjs-cloudflare build` | Exit 0, "OpenNext build complete." Re-run after the fixes. |

### Walk (`next dev -p 3100`, throwaway env, admin cookie from `POST /api/admin/auth/login` → 200; then `next start -p 3101`)
The leak scan used the 4 sharp image ids of the coming-soon polos (`seed-69961b8a…`, `seed-8c78da9a…`, `seed-f33c94ce…`, `seed-a23828af…`) and the hidden prices (349900/369900/₹3,499/₹3,699). Each page was fetched twice, as HTML and with `RSC: 1`.

| Check | Result |
|---|---|
| Production server (`next start`): `/`, `/coming-soon`, `/shop`, `/shop/tops`, `/collections/core`, `/search?q=polo`, two coming-soon PDPs, `/sitemap.xml`, `/journal`, `/lookbook`, `/robots.txt` | Every page `sharp:0 hiddenprice:0`. |
| Same scan under `next dev` | All 0 except `/shop/tops`. There, React's dev-only async debug info put the raw text of `catalogue.json` into the flight payload, because `generateMetadata` calls `getCatalogue()`. This doesn't happen in production (row above), but **don't demo secret products from `next dev` on a shared URL**. |
| Blurred id `seed-fc4d…` | Shown on `/coming-soon`, `/shop` and the PDP. |
| Coming-soon PDP | `<meta name="robots" content="noindex, follow">`, and no Product JSON-LD. |
| Sitemap | Only `polo-black-ring-embroidered` (the presale polo). None of the 4 coming-soon slugs. |
| Admin `PUT /api/admin/products/prod-polo-navy-rain-emboss` (showTitle false, hiddenTitle "Piece No. 7", badge "QA BADGE") | 200. Without a rebuild, "Rain Emboss" appears 0 times on `/`, `/coming-soon`, `/shop`, `/search`, the PDP and the sitemap. "Piece No. 7" and "QA BADGE" are shown on `/` (5), `/coming-soon` (5), `/shop` (5) and the PDP (3). |
| Admin `PUT /api/admin/settings` (launches.comingSoon.showPrice true, showInShop false) | 200. The cream polo price `369900` went from 0 to 3 on `/coming-soon`, and from 0 to 2 on the PDP. The polo dropped off `/shop` (4 mentions to 0). |
| Quote, coming-soon SKU `NWH-PRN-NAV-M` | `issues:[{"issue":"not_released"}]`, total 0. |
| Quote, presale ×1 | `preorder:true`, `unitPrice:329900`, `compareAtPrice:379900`, `preorder.shipBy:"2026-12-15"`. |
| Quote, mixed bag (presale + in-stock tee) | `issues:[{"sku":"NWH-TEE-BON-S","issue":"mixed_presale"}]`, `mixedPresale:true`. |
| Create, presale ×3 | `"Pre-orders are limited to 2 per customer." code presale_limit` |
| Create, mixed bag | `"Pre-order pieces ship later, so they need their own checkout…" code mixed_cart` |
| Create, presale ×2 / ×1 | Passed the presale checks and failed at Razorpay with 502 "Payment provider is unavailable" (fake keys). Afterwards the ledger `data/presale/prod-polo-black-ring-embroidered.json` had `"reservations": []`, so the units were released. |
| Admin sets cap 1, access `code`, accessCode `QA-SECRET-77` | PUT 200. Create with no code or a wrong code: `presale_access`. Right code, qty 2: `"Only 1 pre-order unit is left." code presale_cap`. Right code, qty 1: reached Razorpay (502). |
| `POST /api/presale/access` | `nope` → 403 "That code is not valid."; correct code → 200 `{"ok":true}`. |
| `QA-SECRET-77` in the HTML/RSC of `/`, `/shop`, `/coming-soon`, the presale PDP, `/drops`, `/sitemap.xml` | 0 everywhere. |
| Home brand | Header has `<svg viewBox="0 0 192 23" role="img" aria-label="Nowhence">`; icons are `/brand-default/icon-32.png`, `-192.png` and apple `-180.png`; `/icon.png` returns 302 to `/brand-default/icon-512.png`, which is 200; `--font-display:var(--font-jost)`. |
| Home meta description | **Was missing.** Fixed (F16). Now `<meta name="description" content="Nowhence makes considered unisex clothing. …">`. |

Repeat-buyer cap (a second paid order from the same email) and cap exhaustion across separate orders could not be tested by curl without real Razorpay. Both are covered by `launches-server.test.ts`, including concurrent CAS writes. `data/` was restored from a backup afterwards.

### Findings
| # | Sev | Where | Finding | Fixed? |
|---|---|---|---|---|
| F16 | Medium | `src/app/(shop)/page.tsx` | Merge clash: WS-G's home page rewrite dropped WS-H's meta-description fallback and its placeholder-hero fallback. As a result the home page had **no** meta description (the page's `description: undefined` replaced the layout default). | **Yes.** Restored the `DEFAULT_DESCRIPTION` fallback and the `isPlaceholderMedia` → `DEFAULT_HERO_MEDIA` swap. Verified by curl. |
| F17 | Low | `shop/page.tsx`, `shop/[category]/page.tsx`, `collections/[slug]/page.tsx`, `drops/[slug]/page.tsx` | These pages passed raw `catalogue.drops` (which can include a drop's presale `accessCode`) to the listing components. The components are server components, so nothing reached the client, but it was one `'use client'` away from leaking. | **Yes.** They now pass `publicDrops(catalogue.drops)`. |
| F18 | Medium | tests/`src/lib/storage.ts` | Integration tests write the real `data/` folder (including `orders-index/2026-10.json` and `.meta`). Running them in parallel or alongside dev corrupts the file; one in four full runs here failed with 2 tests. | No. Suggested fix: a `DATA_DIR` env override pointed at a temp folder in `vitest.config.ts`. |
| F19 | Low | `/api/checkout/quote` | The quote doesn't flag qty above `perCustomerLimit` (×3 quoted clean). Only create rejects it, so the bag shows no warning until payment. | No. |
| F20 | Info | `public/media/seed-*` | Sharp originals of coming-soon products can be fetched by anyone who has the id (`/media/seed-69961b8ab6f5adc7/800.webp` → 200). The ids aren't leaked anywhere (scan above) and have 64 bits of randomness. | Accepted; same as WS-G open issue 3. |
| F21 | Info | dev only | The `next dev` flight payload carries raw file contents (see the walk table). | N/A in production. |
| F22 | Info | lint | 2 unused disable directives in `launches.ts` / `launches-server.ts`. | **Yes.** |

The engineers' open issues still stand: the Settings blur default isn't used by the generate button (WS-G 4), no rate limit on `/api/presale/access` (5, add it to the F7 WAF rules), no ship-by in emails (6), only the first ship date shown (7). The home page is cached `s-maxage=300` (WS-H 1), so launch-setting edits and date-based reveals can take up to 5 minutes to show on `/`. `npm run seed` drops the polos (WS-G 1).

### Remaining owner actions
1. Check in a browser: canvas blur generation in Admin → product → Availability, the checkout access-code field, the `/admin/launches` notify CSV and email, the footer logo size and the icon PNGs.
2. After any `npm run seed`, run `node scripts/seed-launch-polos.mjs`.
3. Keep slugs of hidden-title products neutral (the slug is public).
4. Do a real Razorpay test pre-order to confirm a repeat order from the same email is refused and the cap counts down.

## WS-I + WS-J (2026-10-17)

Integrated WS-I (A13 pre-booking with deposit) and WS-J (edge caching) plus the F18/F19/F20 and WS-G 4/6/7 fixes. No integration edits were needed. Nothing committed.

### Commands (real output, Git Bash from `D:/2027/...`)
| Command | Result |
|---|---|
| `npm run typecheck` | `tsc --noEmit`, no errors. |
| `npx vitest run` ×3 | Each run: `Test Files 40 passed (40)` · `Tests 316 passed (316)`. |
| `npm run lint` | `✔ No ESLint warnings or errors`. |
| `npx next build` | Exit 0. New routes: `/book/[slug]` 2.15 kB, `/pay/[token]` 1.74 kB, `/admin/bookings`, `/admin/bookings/[id]`, `/api/bookings`, `/api/pay/[token]`, `/api/admin/bookings/[id]`, `/api/admin/bookings/export`. Shared JS 103 kB, middleware 39.7 kB. |
| `npx opennextjs-cloudflare build` | Exit 0, "OpenNext build complete." |
| `npx wrangler deploy --dry-run` | Bundles `custom-worker.mjs` (which imports `src/lib/edge-cache.ts`); the output contains `x-nowhence-cache`. |
| `vitest run src/lib/edge-cache.test.ts` | 6/6 pass. These include the `nowhence_admin=tok` cookie leading to no caching, `not_nowhence_admin` still being cached, and `/admin`, `/api`, `/cart`, `/checkout`, `/orders`, `/book`, `/pay`, query strings, RSC requests and writes all bypassing the cache. |

### Walk (`next start -p 3102`, throwaway env, Razorpay/Resend HTTP stubbed by a `--require` preload in the scratchpad; `data/` backed up first and restored afterwards, `diff -rq` clean)
| Check | Result |
|---|---|
| `GET /book/polo-black-ring-embroidered` | 200. Shows "₹3,299 · ₹999 deposit today" and the policy text. |
| `POST /api/bookings` with injected `amount/deposit/total: 100` | 200 `deposit:99900`. The outbound Razorpay order had `amount:99900`, so the client values were ignored. The pay token is returned only in this response. |
| `POST /api/razorpay/verify` bad sig / good sig / repeat | 400 "Payment could not be verified." → 200 `result:"applied", status:"deposit_paid"` → 200 `result:"duplicate"`. Verify never returns the token. |
| Webhook `payment.captured` for a deposit: bad sig / good / replay | 400 `invalid signature` → `applied` → `duplicate`. The booking has 2 history entries, not 3. |
| Time travel via admin `PUT /api/admin/products/…` (saleStartsAt in the past) | PUT 200, but the **existing booking stayed `deposit_paid`**, because bookings freeze `terms.saleStartsAt` when they are made (F23). I then backdated `terms.saleStartsAt` in the booking docs directly. |
| `/pay/{token}`, priceLock `booking` | `balance_due`. Shows ₹3,299 − ₹999 = **₹2,300** (shipping free). `finalUnitPrice 329900`. |
| `/pay/{token}`, priceLock `sale` | `balance_due`. Live price ₹3,799 − ₹999 = **₹2,800**. `finalUnitPrice 379900`. |
| Wrong token: `GET /pay/AAAA…` | 404. |
| `POST /api/pay/{token}` with injected `amount:100` | `amount:230000`, matching the Razorpay order (server-computed). |
| Balance verify ×2 | `applied, completed, number NWH-261017-93LG` → `duplicate` (same order). Order `paid`, subtotal 329900, discount 99900, total 230000, note "Converted from booking … Deposit paid: ₹999.00." Inventory `NWH-PRE-BLA-M` went from 5 to **4**. |
| Expiry `refund` (sale 10 days ago) | `/pay` shows "Refunded". Razorpay `POST /v1/payments/pay_qa3/refund {"amount":99900}`; `refund.razorpayRefundId` was stored; emails `balance_due, expired, refunded`. |
| Expiry `manual` | "Expired", `needsReview:true`, no refund call. |
| `/admin/bookings` with cookie / without | 200, all 4 numbers listed / 307 to login. |
| `GET /api/admin/bookings/export` with cookie / without | 200 `text/csv`, `attachment; filename="nowhence-bookings-2026-10-17.csv"`, 16 columns / 401. Name `=HYPERLINK(...)` was exported as `'=HYPERLINK(...)` (formula-escaped). |
| Hidden products: `/book/polo-navy-rain-emboss`, `/book/polo-cream-diamond-back`, `/book/nope-xyz` | 404 each. Title, price and `seed-` id appear 0 times in HTML and RSC. `POST /api/bookings` with a coming-soon slug returns 404 `not_found`. |
| Cron `POST /api/admin/orders/expire` without `CRON_SECRET` | 404 (as designed). The sweep path is covered by `bookings-server.test.ts`. |

Not walked: an edge cache HIT/MISS on a real Worker (needs a deploy; `caches.default` is a no-op under `next start`), and the `/book`, `/pay` and admin booking UIs by eye.

### Findings
| # | Sev | Where | Finding | Fixed? |
|---|---|---|---|---|
| F23 | Medium | `src/lib/bookings-server.ts` `advanceBooking` / `Booking.terms` | Changing the product's `saleStartsAt` (or window) after bookings exist didn't affect existing bookings. | **Fixed.** Owner decision: open bookings follow the sale date. Product `PUT` and drop presale `PUT` diff the effective sale terms (`productsWithMovedSaleTerms`) and call `reapplySaleDates`: per-booking `writeJsonCas` via pure `reapplySaleTerms` (idempotent; history entry; audit `bookings_sale_date_moved`). balance_due with a future date goes back to deposit_paid (final price and balance email reset); admin-extended deadlines keep the later of extended and new computed. Paid customers get one `sale_date_moved` email per change (claimed with `saleDateEmailFor`; claim released when not sent, e.g. no Resend key). Product editor previews "N open bookings will move… and be emailed" (`POST /api/admin/products/{id}`). Tests in `bookings.test.ts`, `bookings-server.test.ts`, `bookings-email.test.ts`. Not done: unpaidOutcome changes still don't apply; no preview notice in the drop presale editor (LaunchesAdmin). |
| F24 | Low | `bookings-server.test.ts` | The webhook block used the real clock and would fail after 2026-11-15 (WS-I open 1). | **Fixed.** `vi.useFakeTimers({ toFake: ['Date'], now: BOOK_AT })` around the webhook test; payment-event cleanup uses `BOOK_AT`. |
| F25 | Low | refunds | Refunding a converted order refunds only the balance; the deposit is refunded from the booking (WS-I open 2). | No. Document for staff. |
| F26 | Info | `data/__test__/` | Empty dir left over from an earlier test run (from before F18). Runs no longer write to `data/`. | Harmless; delete it. |

F18, F19 and F20 from the previous section are fixed by the WS-J engineer; the 3 green runs above are the evidence for F18.

### Cloudflare rate-limit rule: add these paths (alongside the F7 rules and `/api/presale/access`)
- `POST /api/bookings` (creates a Razorpay order and holds presale units)
- `POST /api/pay/*` (balance Razorpay order)
- `GET /pay/*` (token lookup; the 256-bit token makes guessing infeasible, but each request hits R2)
- `POST /api/admin/bookings/*` (admin actions, already behind auth; optional)

### Remaining owner actions
1. Deploy, then publish home content or delete the empty `site-content.json` from R2 (WS-J 1).
2. Upload the 4 sharp polo folders from `data/media/` to R2 under `media/<id>/` (WS-J 2).
3. Add stock for `NWH-PRE-BLA-*` before 15 Nov 2026 10:00 IST; otherwise conversions are "stock not deducted".
4. Decide F23 and pin the test clock (F24) before 15 Nov.
5. Set `CRON_SECRET` so the sale-start emails go out even if nobody opens `/pay`.
6. Check `/book`, `/pay`, `/admin/bookings` and the QR panel in a browser, and do one real Razorpay test-mode deposit and refund.
7. After deploy, check that `curl -I https://nowhenceclothings.com/` gives `x-nowhence-cache: MISS` then `HIT`, and `BYPASS` with an admin cookie.

## Premium redesign + invoices (A14–A17), 2026-10-17

### Integration fixes
- `src/components/ui/index.ts`: added the 8 missing exports (ButtonLink, Badge, Swatch, SizeSelector, QuantityStepper, Skeleton, Toast, Sheet).
- `src/components/ui/Logo.tsx`: removed unused `cn` import (lint warning).

### Commands
| Command | Result |
|---|---|
| `npm install` | OK |
| `npm run typecheck` | clean (`tsc --noEmit`, no output) |
| `npx vitest run` ×3 (+1 after fixes) | each `Test Files 49 passed (49)` · `Tests 367 passed (367)` |
| `npm run lint` | 1 warning: `<img>` in `admin/(studio)/products/page.tsx:84` (admin thumbnails; acceptable) |
| `npx next build` | `✓ Compiled successfully`; shared JS 103 kB, middleware 39.7 kB (rebuilt after visual fixes) |
| `npx opennextjs-cloudflare build` | "OpenNext build complete." (run again after the fixes) |

### Walk (`next start -p 3490`, throwaway env, Razorpay/Resend stubbed with the `--require` preload; `data/` backed up first, restored afterwards, `diff -rq` clean)
Seller set to Karnataka (stateCode 29, GSTIN `29ABCDE1234F1Z5`) in the throwaway data only.

| Check | Result |
|---|---|
| `POST /api/checkout` tee M ×1, injected `amount:100,total:100`, delivery Karnataka | 201; Razorpay order `amount:259800` (₹2,499 + ₹99 shipping), client values ignored |
| Same, delivery Maharashtra | 201, `amount:259800` |
| `POST /api/razorpay/verify` (good HMAC) ×2 | `applied … status:"paid"` each |
| Invoice numbers | `NWH/26-27/0001` then `NWH/26-27/0002` (sequential) |
| `GET /api/admin/orders/{id}/invoice` | 200 `application/pdf` both. KA: tee taxable 2,380.00 @ 2.5+2.5% → CGST 59.50 / SGST 59.50; shipping taxable 94.29; total Rs. 2,598.00, words "Two Thousand Five Hundred Ninety Eight Only". MH: IGST 5% 119.00 + 4.71 = 123.71 |
| Admin PATCH refund (MH order) | status `refunded`; `?kind=credit_note` → 200 PDF `NWH/CN/26-27/0001`, IGST Rs. 123.71 |
| `GET /api/admin/invoices/ledger?fy=26-27` | CSV: 2 tax invoices, receipt voucher, 2 credit notes with negative values and reference to the original |
| Quick-buy deposit: `POST /api/bookings` ring polo M, injected `deposit:100,amount:100` | Razorpay order `amount:99900` (server deposit) |
| Deposit verify | `applied, deposit_paid`; `/pay/{token}` links receipt `NWH/RV/26-27/0001`; signed PDF link 200; tampered token 404; same token on another doc 404; voucher Rs. 999.00, no GST |
| Admin booking `refund` | Razorpay refund `amount:99900`; credit note `NWH/CN/26-27/0002` referencing the RV |
| `GET /api/pincode/560001` | 200 Bangalore / Karnataka (0.97 s, live India Post); `999999` → `{"found":false}`; `abc`/`000000` → 400. Upstream-down fallback is covered by `pincode.test.ts` (not forced live) |
| Coming-soon secrecy scan (17 pages × HTML and `RSC: 1`, incl. `/`, `/shop`, `/search?q=polo`, the 4 hidden PDPs, `/book/polo-navy-rain-emboss`, sitemap) | every page `sharp:0 price:0` |

Not walked: a real Razorpay modal (test keys) and real email delivery.

### Screenshots (`scratchpad/shots/qa/`, 390 and 1440, headless Chrome via CDP with forced-colors off)
home, home2 (after fixes), quick / quick2 (home presale quick-buy sheet open), shop, pdp (wing sleeve), pre / pdp2 (ring polo), soon, cart, checkout, drawer (bag drawer open after Add to bag), conf (order confirmation with invoice download), book, track, about, terms, login, dash, pedit, orders, bookings, settings.

### Visual findings
| # | Sev | Where | Finding | Fixed? |
|---|---|---|---|---|
| F27 | High (visual) | `src/components/ui/Image.tsx` | Seed `placehold.co` images rendered the product name in large bold Lato inside every card and category tile; the page read like a wireframe. | **Fixed.** placehold.co sources now render a quiet paper-deep plate with a 10px tracked "Photograph to follow" caption, same aspect ratio. Real photography still needed. |
| F28 | Medium | `src/components/ui/SizeSelector.tsx:40` | `auto-fill` grid left an empty grey cell after XXL in the quick-buy sheet and other wide columns. | **Fixed** (`auto-fit`). The `sizeGridClass` workaround in `quick-buy.ts` can now go. |
| F29 | Medium | `src/components/shop/ProductView.tsx:232` | Deposit product showed the presale terms "Pre-orders are paid in full today", which contradicts the ₹999 deposit. | **Fixed.** Deposit products show "Full booking terms are shown before you pay." |
| F30 | Low | `src/components/chrome/Footer.tsx` | Contact email broke mid-word ("nowhenceclothings.\ncom") on mobile. | **Fixed.** Contact spans both columns on mobile; `break-words`. |
| F31 | Low | cart drawer, confirmation thumbnails | These still use raw `<img>` so they show the placehold.co text in small. | No; goes away with real photography. |
| F32 | Low | `src/lib/schemas/common.ts:19` | The API `Phone` is strict 10 digits; `+91 …` normalisation happens only in the browser. | No; by design for the API, note for integrators. |
| F33 | Low | admin orders at 390 | Table scrolls horizontally; status/total are offscreen until you scroll. | No. |
| F34 | Low | Countdown | Still says "Releases" for the end of a presale (Build 1 open issue). | No. |

### Remaining owner actions
1. Settings → Legal: fill legal name, GSTIN, registered address and **state code** (without the state code every invoice falls back to IGST). There is no admin screen for `tax.slabs`, `tax.invoicePrefix`, `tax.defaultHsn` yet; defaults are 5% ≤ ₹2,500, 18% above, prefix NWH, HSN 6105.
2. `wrangler secret put INVOICE_LINK_SECRET` (≥16 chars), otherwise no customer download links.
3. Replace the placeholder catalogue photography (`placehold.co`) with real shots.
4. Do one Razorpay test-mode order, deposit, balance and refund in a browser.
5. Mount `ToastProvider` in the shop layout (admin has it).
