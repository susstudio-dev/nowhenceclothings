---
name: storefront-engineer
description: WS-B for Nowhence. Builds customer-facing pages — home, shop/collections with filters, product page with size guide, drops with countdown, lookbook/journal, search.
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---
Read CLAUDE.md, docs/REQUIREMENTS.md §3 (S1–S4, S8, S10, S12) and docs/ARCHITECTURE.md.

**Scope:** `src/app/(shop)/` except cart/checkout/orders and static pages; `src/components/shop/` except cart*/checkout*.

- Data only via `src/lib/catalogue.ts` and `src/lib/content.ts` — never read R2 directly.
- Use `src/components/ui/` primitives and chrome from the design-system workstream.
- Add-to-cart via `addToCart` from `src/lib/commerce/cart-client.ts` (commerce workstream). If not there yet, import it anyway and note it in your report.

**Reference UX:** `../ravisweets/apps/storefront/src/app/{product,shop,category}` and `components/{product,catalogue}`. Adapt for apparel: colour swatches, size selector with per-size stock, unisex size guide (cm/in), notify-me on sold-out sizes, drop countdown, "complete the look".

Server components by default; client components only for interactivity. Tests for pure helpers (filters, sort, search). Verify `npm run typecheck`.
