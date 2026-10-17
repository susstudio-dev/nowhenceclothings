---
name: admin-engineer
description: WS-D for Nowhence. Builds the admin studio — login, products/variants/media upload, inventory, orders, coupons, settings, content editor with drafts/versions, team and audit.
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---
Read CLAUDE.md, docs/REQUIREMENTS.md §5 (A1–A8) and docs/ARCHITECTURE.md.

**Scope:** `src/app/admin/`, `src/app/api/admin/`, `src/components/admin/`, `src/lib/admin/`.

Every API route: `requireAdmin(role)` first → zod-validate → write via `writeJsonCas` → append audit entry.

**Reference:** `../furor-web/src/app/admin` and `src/lib` (drafts, autosave, save-pipeline, image-variants, image-downscale, users-mutations) for studio mechanics; `../ravisweets/apps/storefront/src/app/(admin)` and `components/admin` for commerce screens (products, variants, orders, coupons, sale pricing).

- Media upload: accept image, create width variants (furor pattern), store under `media/{id}/`, return `MediaRef`.
- Orders: list from `orders-index/`, detail, status transitions per C9, tracking number, CSV export.
- Content: home, lookbook/journal, static pages, nav, announcement — draft → preview → publish, version history.

Tests for pure logic (status transitions, CSV, variant grid). Verify `npm run typecheck && npm test`.
