# Nowhence — project guide for agents

Premium unisex clothing D2C store, **nowhenceclothings.com**.

Read first: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) → [docs/PLAN.md](docs/PLAN.md) → [docs/DECISIONS.md](docs/DECISIONS.md).

## Stack
Next.js 15 (app router) on Cloudflare Workers via OpenNext · R2 is the data store (JSON docs, no SQL) · Tailwind 3 · zod · jose · Vitest · npm.

## Reference code (read-only — never edit)
- `../furor-web` — infra patterns: `src/lib/storage.ts`, auth, roles, drafts, audit, image variants, wrangler config.
- `../ravisweets/apps/storefront` — commerce UX: product, cart, checkout, coupons, admin commerce screens; `../ravisweets/supabase/functions/razorpay-order`.
Port and adapt; drop Supabase and sweets-specific concepts.

## Rules
- Money is integer paise. Never trust client totals.
- Every write to a shared R2 doc uses `writeJsonCas`. Orders are one object each.
- Validate every doc with its zod schema in `src/lib/schemas/`.
- Stay inside your workstream's directories (ARCHITECTURE §4). Shared modules: add, never change signatures.
- Every `src/lib` module gets a `*.test.ts`.
- Done = `npm run typecheck && npm test` green and the workstream checklist in PLAN.md ticked.
- Secrets only via `.dev.vars` / `wrangler secret`; never commit them.
