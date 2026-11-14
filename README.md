# ZERO FLARE — FLAME EVIDENCE LAB

An AI-assisted scientific research dashboard over NASA Physical Sciences Informatics (PSI)
microgravity combustion evidence — built for the NASA Space Apps 2026 challenge
**Flame in Freefall** by the Zero Flare mission team.

[![CI & Deploy](https://github.com/OWNER/REPO/actions/workflows/deploy.yml/badge.svg)](../../actions)

> **Research decision support.** Not a certified spacecraft fire-protection system, and not a
> replacement for NASA crew procedures or qualified engineering review.

---

## What it is

| Section | What you get |
| --- | --- |
| **Mission** | Corpus stats, destination atmospheres (Earth → ISS → Moon → Mars), evidence-coverage matrix, ranked findings, honest "will NOT do" panel |
| **Investigations** | 25 NASA PSI combustion investigations; per-study workspace with EDA (histograms, XY exploration, condition comparison, correlation heatmap), raw tables, equipment, media, equations, evidence graph, gaps |
| **Compare** | Up to 4 investigations side by side — condition matrix, **comparability gate**, **shared measurable quantities** (min–max–mean ranges from recovered rows), evidence graph slice, gap discovery |
| **Scenarios** | Fire-safety lifecycle (Prevention → Detection → Prediction → Suppression), facility screening, guarded model playgrounds (FLEX extinction, CFI-G ignition), equation calculators, session shelf |
| **Media Library** | Official NASA mission videos (oEmbed-verified, privacy-enhanced embeds), curated research context videos, searchable authentic NASA imagery — all in experimental context |
| **Data & Sources** | Recovery ledger (SHA-256 vs manifest), recorded historical batches, curated source figures, source registry, NASA media catalogue |
| **Research Tools** | Model Studio (honest model cards + negative results), variable dictionary, 63-equation verified registry, AI evaluation, diagnostics |
| **CIR-1 copilot** | Context-aware research agent: 28 deterministic tools (BM25 evidence search, dataset queries, verified-equation calculations, live NTRS search), tool trace + citations in every reply |

## The honesty contract

- Numbers come from the SHA-256-verified recovered PSI tables or the verified equation registry —
  never from the LLM.
- The FLEX model refuses gravity > 0.02 g; CFI-G is labelled exploratory; SPICE stays a negative
  result; suppressants are never ranked.
- Measured vs calculated vs predicted values are labelled; missing data stays missing (em-dash,
  never zero-filled); negative results stay visible.
- The copilot shows its plan, tool trace and citations; external NTRS checks distinguish "gap in
  our index" from "no evidence in the field".

## Stack

- **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Recharts**
- Deterministic science layer shared by UI and agent (`src/lib/science`, `src/lib/data`)
- **Cloudflare Workers** deployment via **OpenNext** (`@opennextjs/cloudflare`)
- No database: the verified corpus is bundled generated JSON (`src/data/generated/`, rebuilt
  artifacts committed) — deployment-safe, no server filesystem or DB required.

```
data/raw/                     immutable NASA PSI CSVs + manifest (provenance)
models/                       model cards (FLEX extinction v2)
knowledge/                    source-document text index (BM25 leg of the agent)
src/data/generated/           corpus, tables, EDA, graph, media, figures, videos (build artifacts)
src/lib/science/              equations registry, guarded models, physics, comparability
src/lib/agent/                tool registry, agent core, env-configured LLM adapter
src/app/api/                  copilot · llm-status · external (NTRS) · selftest · qa-eval
src/components/flame/         design system + views (shell, mission, investigations, compare,
                              scenarios, media, data-sources, my-work, tools, copilot)
```

## Run locally

```bash
npm install
cp .env.example .env        # optional: add AI_API_KEY for live CIR-1 LLM mode
npm run dev                 # http://localhost:3000
```

Other scripts: `npm run build` · `npm run start` · `npm run lint`.

## AI key & secrets

The copilot's LLM mode is **env-configured and provider-agnostic** (OpenAI-compatible):

| Variable | Purpose | Where set |
| --- | --- | --- |
| `AI_API_KEY` | Chat-completions API key (server-only) | GitHub secret `AI_API_KEY` → synced to Cloudflare Worker secret by CI; locally in `.env` |
| `AI_BASE_URL` | Optional provider base URL (default `https://api.openai.com/v1`) | `.env` / Worker env |
| `AI_MODEL` | Optional model id (default `gpt-4o-mini`) | `GET /api/llm-status` reports mode only |

- Keys are **never** hardcoded, committed, returned by any API, or exposed to the client bundle.
- Without a key the copilot stays fully functional in a labelled deterministic mode (tools,
  calculations, retrieval, live NTRS) — the UI says so honestly via `/api/llm-status`.

## Deploy (Cloudflare Workers)

```bash
npx wrangler login        # one-time browser auth
npm run cf:deploy         # OpenNext build + wrangler deploy
npx wrangler secret put AI_API_KEY
```

CI (`.github/workflows/deploy.yml`) runs lint → typecheck → build on every PR, and on `main`
builds the OpenNext bundle, syncs `AI_API_KEY` from GitHub Secrets to a Worker secret, and runs
`wrangler deploy`.

### GitHub secrets to configure (one-time)

| Secret | Used for |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Deploy (Workers Scripts:Edit + KV:Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy target account |
| `AI_API_KEY` | CIR-1 live LLM mode (synced to Worker secret, never bundled) |

## Data provenance

All experimental tables were recovered from the NASA PSI public download endpoint
(psi.nasa.gov) and re-verified by SHA-256 against the project manifest; the raw CSVs ship in
`data/raw/` for full reproducibility. Source-document figures carry source-file + page + batch
provenance. Media: NASA Images and Video Library (credit NASA) and official NASA mission videos,
each oEmbed-verified. Literature: NASA NTRS (live API).
