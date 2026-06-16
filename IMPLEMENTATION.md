# Implementation Foundation — Udaan Research Agent

This document defines the **cross-cutting foundation** that every phase (1–7) builds on. The phase design docs describe *what* each stage does; this describes the *shared scaffolding* they all plug into — monorepo layout, local infra, native vs. containerized execution, the contracts boundary, swappable providers, config, and the queue.

Read this alongside [`STACK.md`](./STACK.md) (decisions + rationale). When implementing any phase, wire it into the foundation here rather than re-deciding these concerns per phase.

**Status:** Finalized foundation · **Last updated:** 2026-06-16

---

## 0. The shared layer (every phase depends on this)

```
┌──────────────────────────── runs natively on host ────────────────────────────┐
│  packages/web (Vite)   packages/orchestrator (TS: P1,P2,P4,P7 + BullMQ workers) │
│  services/ranking (P3)  services/parsing (P5)  services/synthesis (P6)  [Python]│
│  Ollama (local LLM, GPU)                                                         │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                   │  (config-driven URLs, no hardcoded host)
┌──────────────────────────── docker-compose (infra only) ────────────────────────┐
│  Qdrant (vectors)      Redis (cache + BullMQ)      MinIO (S3-compatible vault)   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **Infra** = official images, *used* via docker-compose (pulled, not built).
- **Our services + Ollama** = run **natively** for local dev (GPU access; see `STACK.md` → Docker image strategy).
- Everything talks over **config-driven URLs** — no hardcoded `localhost`, so deploy is a config change.

---

## 1. Monorepo bootstrap (one-time)

```
udaan/
├─ packages/                 # TypeScript (pnpm workspaces + Turborepo)
│  ├─ contracts/             # schema source of truth → TS types + Python pydantic
│  ├─ orchestrator/          # Phases 1, 2, 4, 7 + BullMQ workers + web API (SSE)
│  ├─ web/                   # React + Vite UI
│  └─ shared/                # logging, telemetry, config loader
├─ services/                 # Python (uv) — each a FastAPI worker pool
│  ├─ ranking/               # Phase 3 — cross-encoder
│  ├─ parsing/               # Phase 5 — Docling + embeddings + extraction
│  └─ synthesis/             # Phase 6 — clustering + polarity
├─ infra/
│  ├─ docker-compose.yml     # Qdrant + Redis + MinIO
│  └─ .env.example           # copy → .env (12-factor config)
├─ IMPLEMENTATION.md / STACK.md / PROJECT.md / <phase docs>
```

Bootstrap commands (run once):
- TS: `pnpm init` at root, add workspaces, `pnpm add -D turbo`.
- Python: `uv init` in each `services/*`, add `fastapi`, `uvicorn`, `pydantic`.
- Ollama: install on host, `ollama pull qwen2.5:7b-instruct-q4_K_M`.

---

## 2. Local infra baseline — `infra/docker-compose.yml`

The **only** Docker artifact needed for local dev. Ports/credentials come from `.env`.

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "${QDRANT_HTTP_PORT:-6333}:6333"
      - "${QDRANT_GRPC_PORT:-6334}:6334"
    volumes:
      - qdrant_data:/qdrant/storage

  redis:
    image: redis:7-alpine
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "${MINIO_API_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes:
      - minio_data:/data

volumes:
  qdrant_data:
  redis_data:
  minio_data:
```

Start the stack: `docker compose -f infra/docker-compose.yml up -d`.

---

## 3. Configuration — `infra/.env.example` (12-factor)

Every endpoint/credential/model is an env var. Copy to `.env`; nothing hardcodes `localhost`.

```bash
# --- Infra (local docker-compose; swap host/creds at deploy) ---
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000      # MinIO now → real S3/GCS endpoint at deploy
S3_BUCKET=research-vault
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# --- Providers (tiered, swappable — see STACK.md §4.2) ---
LLM_PROVIDER=ollama                    # ollama | gemini | groq | anthropic
EMBEDDING_PROVIDER=local               # local | cohere
RERANK_PROVIDER=local                  # local | cohere

OLLAMA_URL=http://localhost:11434
LLM_MODEL=qwen2.5:7b-instruct-q4_K_M
EMBEDDING_MODEL=BAAI/bge-base-en-v1.5
RERANK_MODEL=BAAI/bge-reranker-base

# API keys (only the ones your selected providers need)
GEMINI_API_KEY=
GROQ_API_KEY=
ANTHROPIC_API_KEY=
COHERE_API_KEY=

# --- Cross-service URLs (config-driven, no hardcoded host) ---
RANKING_SERVICE_URL=http://localhost:8001
PARSING_SERVICE_URL=http://localhost:8002
SYNTHESIS_SERVICE_URL=http://localhost:8003
```

---

## 4. The contracts boundary (schema-first, both languages)

The phase docs promise strict, immutable inter-phase contracts. To honor that across TS↔Python:

1. Define each contract **once** in `packages/contracts/` (JSON Schema).
2. Generate **TS interfaces** (`CandidatePaper`, `ResolutionStatus`, `ClusterPolarity`, …) and **Python Pydantic** models from it.
3. **Validate at every boundary** — each HTTP call and BullMQ job payload validates against the schema, so TS/Python drift fails loudly instead of corrupting traceability.

Every phase consumes/produces a contract type from here — never hand-rolls a parallel definition.

---

## 5. Swappable providers (the tier system)

LLM, embedding, and rerank access sit behind interfaces so local ↔ free-API ↔ paid is a config flip (`LLM_PROVIDER`, etc.). Implement once in `packages/shared` (TS) and a mirror in `services/*` (Python).

```
EmbeddingProvider          LLMProvider               RerankProvider
 ├─ LocalST  (bge-base)     ├─ Ollama  (Qwen2.5-7B)    ├─ LocalCE (bge-reranker-base)
 └─ Cohere   (embed-v3)     ├─ Gemini  (2.0 Flash)     └─ Cohere  (rerank-v3.5)
                            ├─ Groq    (Llama 3.3 70B)
                            └─ Anthropic (Opus 4.8 / Haiku 4.5)
```

> **Provider caveat baked into the interface:** the Anthropic provider must **not** send `temperature`/`top_p` (400 on Opus 4.8/4.7/Fable 5) — use adaptive thinking. Local/Gemini/Groq use `temperature: 0`. See Phase 7 §4.1.

---

## 6. Pipeline execution — BullMQ on Redis

Phases run as an async worker pipeline: `discovery → rank → resolve → parse → synth → gen`. One worker per stage locally; scale workers at deploy with no code change. The queue's sequential execution is what lets the **single 8GB GPU** serve one model at a time (rerank, then embed/extract, then polarity) without contention.

---

## 7. Per-phase wiring checklist

When you implement a phase, you are *not* re-solving the foundation — you wire into it. Each phase touches this shared layer as follows:

| Phase | Lang | Infra it uses | Provider(s) | Contract in → out |
| --- | --- | --- | --- | --- |
| 1 Query Orchestration | TS | Redis (cache) | LLM (intent) | rawQuery → CompiledDiscoveryManifest |
| 2 Graph Gateway | TS | — | — | Manifest → CandidatePaper[] |
| 3 Cross-Encoder | Py | GPU | Rerank | CandidatePaper[] → RankedManifest |
| 4 Full-Text Resolution | TS | MinIO (S3) | — | RankedManifest → ResolutionManifest |
| 5 Ingestion & Parsing | Py | GPU, Qdrant | Embedding, LLM | ResolutionManifest → ValidatedClaim[] |
| 6 Synthesis & Polarity | Py | Qdrant, GPU | LLM (polarity) | claims → SynthesisGraph |
| 7 Generation | TS | — | LLM (generation) | SynthesisGraph → ResearchBrief |

Every row also inherits: env-driven config (§3), a generated contract type (§4), provider selection (§5), and a BullMQ stage (§6).

---

## 8. Recommended build order

1. **Foundation:** infra compose (§2) + `.env` (§3) + `contracts` package (§4) + provider interfaces (§5). *Do this before any phase.*
2. **Vertical slice:** Phase 1 → 2 → 3 to get a ranked paper list end-to-end (validates the TS↔Python↔queue path early).
3. **Resolution + ingestion:** Phase 4 → 5 (MinIO + Docling + Qdrant).
4. **Synthesis + output:** Phase 6 → 7 (the trust-critical LLM steps; wire the Anthropic provider here).
5. **UI:** `packages/web` with SSE progress, last (the API surface is stable by then).
