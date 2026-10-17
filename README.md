# Nowhence

Premium unisex clothing — **nowhenceclothings.com**.

Next.js 15 on Cloudflare Workers (OpenNext), with Cloudflare R2 as the data store.

| Doc | Purpose |
|---|---|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | What we are building |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How: runtime, R2 key layout, types, source layout |
| [docs/PLAN.md](docs/PLAN.md) | Phases, workstreams, checklists |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Defaults chosen + open questions |
| [CLAUDE.md](CLAUDE.md) | Rules for agents working in this repo |
| [.claude/agents/](.claude/agents/) | One agent per workstream |

## Develop
```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev          # local, data/ folder as the store
npm test
npm run preview      # OpenNext + wrangler locally
npm run deploy       # Cloudflare
```
