# Nowhence — Decisions Log

Defaults chosen on 2026-10-17 so the build could proceed in parallel.
**Each one is reversible — override any by editing this file and telling the team.**

| # | Decision | Default | Why | Revisit if |
|---|---|---|---|---|
| D1 | Data store | R2 JSON documents (furor-web pattern), no SQL DB | Owner request; proven in furor-web | Orders exceed ~200/day or reporting needs SQL → add D1 |
| D2 | Hosting | Next.js 15 on Cloudflare Workers via OpenNext | Same as furor-web | — |
| D3 | Audience | Unisex, single size run XS–XXL | Owner: "it's unisex" | — |
| D4 | Catalogue model | Core line **plus** optional drops (`dropId`, `releaseAt`) | Catalogue question unanswered; supports both | Owner confirms only one model |
| D5 | Market | India only, INR, GST-inclusive prices | Razorpay, Indian brand | International launch |
| D6 | Payments | Razorpay (as Ravisweets) | Existing integration | — |
| D7 | Customer accounts | None in v1; guest checkout + order tracking by number+email | YAGNI | Repeat-customer demand |
| D8 | Email | Resend | Works from Workers via fetch | Owner prefers another provider |
| D9 | Returns | 7-day exchange/return, admin-managed | Common Indian D2C norm | Owner policy |
| D10 | Shipping | Flat fee, free above threshold (admin-set); fulfilment manual (tracking no. entered) | Simple start | Shiprocket integration wanted |
| D11 | Visual direction | Premium minimal-editorial: off-white/ink palette, one display serif + one grotesk, generous whitespace, large imagery | "Premium-sided" brand | Brand assets/guide arrive |
| D12 | Brand assets | Placeholders until real logo/photography supplied | None provided yet | Assets arrive |
| D13 | Package manager | npm (as furor-web), single app, no monorepo | Smaller than Ravisweets' monorepo | — |

| D14 | Owner-specific data | All editable in admin (REQUIREMENTS A9); no code change needed to fill the open questions below | Owner request 2026-10-17 | — |

## Open questions for the owner (all answerable from Admin → Settings)

1. Launch catalogue size and categories?
2. Logo, brand fonts, photography — when?
3. Return policy specifics and shipping fee / free-shipping threshold?
4. GSTIN and legal entity name (invoices, footer)?
5. Resend sending domain and from-address?
