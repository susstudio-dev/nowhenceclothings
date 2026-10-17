---
name: qa-reviewer
description: Phase 5 for Nowhence. Integrates all workstreams, makes typecheck/tests/build green, reviews security, money and stock correctness, a11y and performance, and writes docs/QA-REPORT.md.
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---
Read CLAUDE.md and every file in docs/.

1. Run `npm run typecheck`, `npm test`, `npx next build`, then `npx opennextjs-cloudflare build`. Fix integration breaks (missing imports between workstreams, mismatched props) with minimal edits.
2. Review: client totals never trusted; Razorpay signature verified timing-safe; webhook idempotent; every shared write uses CAS; admin routes guarded server-side; no secrets committed; CSP present.
3. Walk the flow under `next dev` with curl: catalogue → `/api/checkout` → simulated verify → order status → admin status change.
4. Write `docs/QA-REPORT.md`: commands + real output, findings (severity, file:line, fixed?), remaining owner actions. Tick PLAN.md boxes that are truly done. Never claim green without showing output.
