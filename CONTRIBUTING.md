# Contributing to Udaan Research Agent

Thanks for contributing! This guide covers local setup, conventions, and the
review/merge workflow.

## Prerequisites

- **Node.js 20+** and **pnpm**
- **uv** (Python package manager) and **Python 3.11+**
- **Docker** (for Qdrant, Redis, MinIO)
- **Ollama** (optional, for the local LLM)

## Local setup

```bash
# one command brings up infra + services + API + web (Git Bash on Windows)
bash run.sh
```

Or manually:

```bash
docker compose -f infra/docker-compose.yml up -d
cp infra/.env.example infra/.env
pnpm install
(cd services/ranking && uv sync) && (cd services/parsing && uv sync) && (cd services/synthesis && uv sync)
pnpm --filter @udaan/orchestrator dev   # API :8080
pnpm --filter @udaan/web dev            # UI  :5173
```

The pipeline runs without the heavy ML stack via deterministic fallbacks. For
the real models: `uv sync --extra ml --extra qdrant` per service, and
`ollama pull` the configured model.

## Tests

```bash
pnpm --filter @udaan/orchestrator test          # TypeScript (vitest)
(cd services/ranking && uv run pytest)          # Python (pytest)
(cd services/parsing && uv run pytest)
(cd services/synthesis && uv run pytest)
```

Please add or update tests with any change. Cross-phase data shapes live in
`packages/contracts` (schema-first → TS + Pydantic) — change the schema, not
just one language view.

## Branches & commits

- **Branch per unit of work**, named for it — e.g. `feat-bullmq-worker`,
  `fix-rerank-timeout`. Don't commit directly to `main`.
- **Commit granularity:** one commit per self-contained, working change (a
  contract added, a provider wired). Avoid one giant commit; avoid trivial
  per-line commits.
- **Commit messages:** clear imperative subject + a short body explaining the
  *why*. Keep messages free of tool/assistant attribution.
- **Never commit secrets or `.env`** — only `.env.example`.

## Pull requests

- Open a PR against `main`, fill in the PR template, and link any related issue.
- Keep PRs focused and reviewable; ensure tests + typecheck pass locally.
- A maintainer review is required before merge.

### Stacked PRs

If you stack branches (each based on the previous), **merge strictly
bottom-up**: only merge a PR after the one below it has merged and GitHub has
retargeted this PR's base to `main`. Merging out of order leaves `main`
incomplete and creates confusing diffs. When in doubt, keep stacks shallow or
PR each unit directly to `main`.

## Code style

Linting/formatting (ESLint/Prettier for TS, Ruff for Python) is being
introduced — run available `lint`/`format` scripts before pushing once they
land. Match the surrounding code's conventions in the meantime.

## Reporting bugs / requesting features

Use the issue templates under **New issue**. Include enough context (repro
steps, affected files, expected vs. actual) for someone to pick it up cold.
