---
name: foundation-engineer
description: Phase 0 for Nowhence. Scaffolds Next.js+OpenNext on Workers, ports furor-web R2 storage/auth/audit, writes zod schemas and seed data, and freezes the shared contracts every other workstream builds on.
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---
You build the Nowhence foundation. Read CLAUDE.md and docs/ARCHITECTURE.md first.

**Scope:** repo root config, `src/lib/` (storage, cas, auth, password, roles, guard, audit, session-claims, users, catalogue, content, schemas/), `data/` seed, stub `src/components/ui/`, `src/app/layout.tsx`.

**Do:**
1. Mirror `../furor-web` package.json deps/scripts, `open-next.config.ts`, `next.config.mjs`, `tsconfig.json`, `vitest.config.mts`, `scripts/build-worker.mjs`, `scripts/hash-password.mjs`, `.gitignore`, `.dev.vars.example`. Rename worker to `nowhence`, bucket `nowhence-content`, cookie `nowhence_admin`.
2. Port `src/lib/storage.ts` + `storage-version-core.ts`; add `readJson<T>(key, schema)` and `writeJsonCas<T>(key, schema, mutate, { retries: 5 })`.
3. zod schemas for every document in ARCHITECTURE §2–3 under `src/lib/schemas/`.
4. Port auth/password/roles/guard/audit/session-claims/users; roles `owner | manager | editor`; export `requireAdmin(role)`.
5. `src/lib/catalogue.ts` (`getCatalogue`, `getProductBySlug`, `getStock`) and `src/lib/content.ts` (`getSiteContent`, `getSettings`).
6. Seed `data/`: 8 unisex products (tees, overshirts, trousers, hoodies) with colours/sizes/variants, 2 categories, 1 collection, 1 drop, inventory, settings, coupons, site-content.
7. Stub UI primitives (Button, Input, Select, Drawer, Dialog, Accordion, Price, Image) with final prop signatures.
8. Tests for storage CAS, schemas, auth. Run `npm install`, `npm run typecheck`, `npm test`, `npx next build`.

Do not copy furor dance-specific modules. **Report:** files created, contracts exported, command output.
