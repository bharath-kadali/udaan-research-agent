# CLAUDE.md

Guidance for working in this repository. Keep these conventions in mind on every task.

## Project

Udaan Research Agent — an AI Research Synthesis Engine that turns a research question into a fully-sourced, traceable research brief. The core guarantee is **zero-hallucination traceability**: every claim in the output traces to a real passage in a real paper.

Authoritative docs (read before implementing):
- `PROJECT.md` — product vision, the trust/volume problem, success criteria.
- `STACK.md` — finalized tech stack (polyglot TS + Python monorepo) and rationale.
- `IMPLEMENTATION.md` — the shared foundation every phase builds on (infra, contracts, providers, queue, config). **Wire into this; don't re-solve it per phase.**
- `Query-Orchestration.md`, `Graph-Gateway.md`, `Cross-Encoder-Re-Ranking.md`, `Full-Text-Resolution.md`, `Ingestion-And-Parsing.md`, `Cross-Source-Synthesis-And-Polarity-Detection.md`, `Generation-And-Citation-Weaving.md` — Phase 1–7 design docs.

## Working principle

Before performing a task, check whether a relevant **skill** is available and use it (e.g. `frontend-design` for UI, `claude-api` for Anthropic-provider work, `code-review`/`security-review` for diffs, `run`/`verify` to exercise the app).

## Git workflow

- **Branch per phase.** Implement each phase on its own branch off `main`, named for the phase — e.g. `phase-1-query-orchestration`, `phase-3-cross-encoder`. Do not implement directly on `main`.
- **Commit granularity.** Make a commit for each significant, self-contained change within a phase (a working unit — a contract added, a provider wired, a worker implemented). Avoid one giant per-phase commit; avoid trivial per-line commits.
- **Commit message style.** Clear, imperative subject + a short body explaining the *why*. **Do not include AI/tool attribution** — no `Co-Authored-By: Claude` trailer, and no references to Claude Code or any AI tool in commit messages or PR descriptions.
- **Don't commit or push unless asked.** When asked, never commit secrets or `.env`; keep `.env.example` only.

## Build order (from IMPLEMENTATION.md §8)

1. Foundation: monorepo + `infra/docker-compose.yml` + `.env` + `packages/contracts` + provider interfaces.
2. Vertical slice: Phase 1 → 2 → 3 (ranked paper list end-to-end).
3. Resolution + ingestion: Phase 4 → 5.
4. Synthesis + output: Phase 6 → 7 (trust-critical LLM steps).
5. UI: `packages/web` (SSE progress, citation rendering).

## Cross-cutting reminders

- **Config-driven, no hardcoded `localhost`** — all endpoints/credentials/models via env (12-factor); deploy is a config change.
- **Contracts are the source of truth** — define once in `packages/contracts`, generate TS + Pydantic, validate at every boundary.
- **Providers are swappable** — LLM/Embedding/Rerank behind interfaces; the Anthropic provider must not send `temperature`/`top_p` (use adaptive thinking).
- **Docker:** locally we *use* official images (Qdrant/Redis/MinIO via compose); services + Ollama run natively. Dockerfiles for our services are deploy-time only.
