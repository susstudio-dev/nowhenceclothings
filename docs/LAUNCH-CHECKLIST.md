# Nowhence — Launch Checklist

Live at **https://nowhenceclothings.com** (Cloudflare Worker `nowhenceclothings`, R2 bucket `nowhence-content`, deployed from GitHub `susstudio-dev/nowhenceclothings`).

Verified live on 2026-10-17: all public pages 200, `www` → apex 308, CSP/HSTS/X-Frame-Options present, admin redirects to login.
Still open on live: `/terms` shows 10 `[[TBD]]` (settings not filled); no Cloudflare edge caching (`cf-cache-status` absent).

Tick each box as you go. Steps marked 🧑 need you (dashboard/keys); nothing here needs a code change.

---

## 1 · Secrets 🧑
Cloudflare dashboard → Workers & Pages → `nowhenceclothings` → Settings → Variables and Secrets → **Add → type: Secret**.

| Secret | Value | Required |
|---|---|---|
| `JWT_SECRET` | 32+ random chars (`openssl rand -base64 48`) | ✅ |
| `ADMIN_OWNER_EMAIL` | owner login email | ✅ |
| `ADMIN_OWNER_PASSWORD_HASH` | output of `npm run hash-password` (PBKDF2 — fits Workers CPU limit) | ✅ (preferred over `ADMIN_OWNER_INITIAL_PASSWORD`) |
| `RAZORPAY_KEY_ID` | `rzp_test_…` first, `rzp_live_…` at go-live | ✅ |
| `RAZORPAY_KEY_SECRET` | matching secret | ✅ |
| `RAZORPAY_WEBHOOK_SECRET` | the secret you type in step 2 | ✅ |
| `RESEND_API_KEY` | `re_…` | ✅ for order emails |
| `CRON_SECRET` | 32+ random chars | ✅ for unpaid-order expiry |

- [ ] All secrets set
- [ ] Admin login works at `/admin/login`

## 2 · Razorpay 🧑
Razorpay dashboard → Settings → Webhooks → **Add new webhook**
- URL: `https://nowhenceclothings.com/api/razorpay/webhook`
- Secret: same value as `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured`, `order.paid`
- [ ] Webhook added (test mode first)
- [ ] **Test checkout:** buy one item with test card `4111 1111 1111 1111` (any future expiry, any CVV) → confirmation page shows order `NWH-…`
- [ ] Order appears in Admin → Orders as **paid**; stock for that size dropped by 1
- [ ] Confirmation email received
- [ ] Mark it **shipped** with a tracking number → shipped email received
- [ ] Refund it in admin → stock restored
- [ ] Repeat webhook setup in **live** mode and swap to live keys

## 3 · Email (Resend) 🧑
- [ ] Add domain `nowhenceclothings.com` in Resend; add its SPF/DKIM DNS records in Cloudflare DNS
- [ ] Domain shows **Verified**
- [ ] Admin → Settings → Email: sender name, from (`orders@nowhenceclothings.com`), reply-to

## 4 · Cloudflare edge 🧑
**Caching rule** — Caching → Cache Rules → Create:
- When: hostname equals `nowhenceclothings.com` AND URI path does not start with `/admin` AND not `/api` AND not `/cart` AND not `/checkout` AND not `/orders`
- Then: Eligible for cache · Edge TTL: **use cache-control header** (the app sends `s-maxage=60, stale-while-revalidate=600`)
- [ ] Rule added; `curl -sI https://nowhenceclothings.com/ | grep cf-cache-status` shows `HIT` on the 2nd request

**Rate limiting** — Security → WAF → Rate limiting rules → Create:
| Path starts with | Limit |
|---|---|
| `/api/checkout` | 10 req / 1 min per IP → Block 10 min |
| `/api/orders/track` | 20 req / 1 min per IP |
| `/api/notify` and `/api/newsletter` | 5 req / 1 min per IP |
| `/api/admin/auth/login` | 5 req / 1 min per IP |
- [ ] Rules added

**Cron**
- [ ] Workers → `nowhenceclothings` → Settings → Triggers shows `*/15 * * * *`
- [ ] After `CRON_SECRET` is set: Logs show the scheduled run calling `/api/admin/orders/expire` with 200

## 5 · Store content 🧑 (Admin → Settings / Products)
The dashboard **Launch readiness** list shows what is missing; each item links to its tab.
- [ ] Brand: logo, favicon, fonts, colours
- [ ] Legal: legal company name, GSTIN, registered address, jurisdiction city, privacy + terms dates → `/terms` has no `[[TBD]]`
- [ ] Shipping fee + free-shipping threshold (defaults ₹99 / ₹2,999)
- [ ] Returns: window, returns/exchanges toggles, policy text
- [ ] Contact phone + address
- [ ] Replace the 8 placeholder products with the real range; upload photography via Media
- [ ] Home, lookbook and about content

## 6 · Search & analytics 🧑
- [ ] Google Search Console: add domain property, submit `https://nowhenceclothings.com/sitemap.xml`
- [ ] Cloudflare Web Analytics on (CSP already allows it)

## 7 · Engineering (in progress)
- [ ] Settings save conflict guard (F13), returns label (F14), lint warnings (F15)
- [ ] Lighthouse + axe audit of live `/`, `/shop`, product page — fixes from findings
