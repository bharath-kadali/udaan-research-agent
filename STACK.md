# Technology Stack — Udaan Research Agent

This document is the **single source of truth for the technology stack** of the AI Research Synthesis Engine. It consolidates the technologies named across the Phase 1–7 architecture documents and finalizes the language, repository, runtime, and tooling decisions.

> For *how* these decisions are wired together across all phases — monorepo bootstrap, the `docker-compose` infra baseline, native service execution, the contracts boundary, provider interfaces, config, and the queue — see [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) (the shared foundation every phase builds on).

**Status:** Finalized · **Owner:** Vimal · **Last updated:** 2026-06-15

---

## 1. Headline Decision

The system is built as a **polyglot monorepo**, designed to **run locally today but deploy later with config-only changes**:

- **TypeScript** owns the orchestration spine — the I/O- and coordination-heavy phases.
- **Python** owns the ML phases — driven by hard dependencies (Docling, SciPy/HDBSCAN, sentence-transformers) that have no credible TypeScript equivalent.
- **Cross-phase data contracts are defined once** and code-generated into both languages, so the TS↔Python boundary cannot silently drift.

Pure TypeScript was rejected: **Docling (Phase 5) is Python-only and is the linchpin of the zero-hallucination/quote-anchoring guarantee**, and HDBSCAN/SciPy clustering (Phase 6) has no real TS equivalent. A single-language fallback, if ever needed, would be Python — not TypeScript.

---

## 2. Deployment Portability Principle (Local Now → Deployable Later)

The system runs entirely on a local machine today. There is **no production deployment**, but every choice is made so that deploying later is a **configuration change, not a rewrite**:

- **12-factor config.** All service URLs, credentials, paths, model names, and ports come from environment variables. **No hardcoded `localhost`** anywhere.
- **Local components mirror their production API.** Object storage uses **MinIO** (S3 API) locally so a future move to AWS S3 / GCS is an endpoint + credential swap.
- **Swappable providers behind interfaces.** Embeddings, object storage, and LLM access sit behind interfaces so the local implementation can be replaced by a hosted one via config.
- **The queue topology is deployment-shaped.** The same worker code runs as 1 worker per stage locally or N scaled workers in a deployed environment.

> See memory: `deployment-portability-constraint`.

---

## 3. Language Ownership by Phase

| Phase | Name | Language | Primary reason |
| --- | --- | --- | --- |
| **1** | Query Orchestration & Translation | **TypeScript** | Async LLM call + query compilation; I/O bound |
| **2** | Open Graph Gateway | **TypeScript** | Concurrent API fan-out, circuit breakers, dedup |
| **3** | Cross-Encoder Re-Ranking | **Python** | sentence-transformers / cross-encoder models |
| **4** | JIT Full-Text Resolution | **TypeScript** | Async streaming downloads → object storage |
| **5** | Ingestion & Parsing | **Python** | **Docling** (Python-only), claim-extraction workers |
| **6** | Synthesis & Polarity Detection | **Python** | SciPy/NumPy + HDBSCAN/Agglomerative clustering |
| **7** | Constrained Generation & Citation Weaving | **TypeScript** | Regex citation weaving, deterministic sentence filtering |

> Phase 3 *could* run in TS via ONNX Runtime's Node binding, but it lives with the other Python ML code for cohesion and shared model-loading infrastructure.

---

## 4. Component Inventory

### 4.1 Languages & Runtimes
- **TypeScript** on **Node.js 20 LTS** — orchestration, gateway, resolution, generation, web API.
- **Python 3.11+** — parsing, ranking, synthesis ML services.

### 4.2 Models & AI

**Hardware baseline (dev machine):** RTX 3070 Ti Laptop — **8GB VRAM** (~7.5GB usable, compute 8.6 / Ampere), i7-12650H (16 threads), 24GB RAM. The 8GB VRAM is the binding constraint: only ~one model fits at a time. The BullMQ queue runs phases **sequentially**, so each stage's model loads → runs → unloads (Ollama handles this on idle) — embedder, re-ranker, and generative LLM never coexist.

All model access sits behind provider interfaces (`EmbeddingProvider`, LLM provider), so local ↔ free-API ↔ paid swaps are a config change, consistent with §2.

**Tier 1 — Local (offline, fits 8GB):**
| Phase | Task | Model | Footprint | Runtime |
| --- | --- | --- | --- | --- |
| 5 | Embeddings | `BAAI/bge-base-en-v1.5` (768-dim) | ~0.4 GB | sentence-transformers |
| 3 | Re-rank | `BAAI/bge-reranker-base` (`-large` only if GPU idle) | ~1.1 GB FP16 | sentence-transformers / ONNX |
| 1 | Query intent | reuse the 7B, or `Qwen2.5-3B-Instruct` Q4 | ~2 GB | Ollama |
| 5/6/7 | Extraction, polarity, generation | **`Qwen2.5-7B-Instruct` (Q4_K_M)** — one model serves all three | ~4.7 GB | Ollama / llama.cpp |

> A 4-bit 7B is adequate for extraction/tagging but weaker on Phase 6 polarity reasoning and Phase 7 no-hallucination synthesis — the trust-critical steps. A 14B won't fit 8GB without slow CPU offload, so prefer Tier 2/3 for those two phases.

**Tier 2 — Free over the internet (rate-limited; behind the same interfaces):**
- **Google AI Studio (Gemini 2.0 Flash)** — Phase 1 intent + Phase 5 extraction (matches the doc's original "Gemini 1.5 Flash" intent). Note: free tier may use data for training; source papers are public, so low-risk.
- **Groq (Llama 3.3 70B)** — Phases 6/7; 70B-class quality at $0, far better than a local 7B.
- **Cohere trial (`rerank-v3.5` + `embed-v3`)** — offloads Phase 3 rerank and Phase 5 embeddings off the GPU.
- **OpenRouter `:free` variants** — overflow/experimentation.

The whole pipeline can run at **$0** (local embed/rerank + Gemini Flash extraction + Groq Llama-70B polarity/generation).

**Tier 3 — Paid premium (recommended for trust-critical Phases 6 & 7):**
- **Claude Opus 4.8** (`claude-opus-4-8`, $5/$25 per 1M) — strongest for constrained, citation-faithful generation. Use adaptive thinking; Phases 6/7 run at `temperature = 0`.
- **Claude Haiku 4.5** (`claude-haiku-4-5`, $1/$5 per 1M) — cheaper tier for high-volume Phase 5 claim extraction.

On ~15–20 papers/query the token volume is modest, making Tier 3 affordable for the steps where a fabricated claim is the core failure mode.

### 4.3 Document Processing (Python)
- **Docling (IBM)** — layout-aware PDF parsing.
- **DocLayNet** — underlying layout model (two-column/reading-order resolution).
- **TableFormer** — table reconstruction into structured grids.

### 4.4 ML Inference & Numerics (Python)
- **ONNX Runtime / NVIDIA TensorRT** — compiled execution graphs for the re-ranker.
- **FP16 / INT8 quantization** — memory-bandwidth reduction.
- **SciPy / NumPy** — CPU-bound clustering (Agglomerative Hierarchical, HDBSCAN).
- Reference GPU profile: **RTX 3070 Ti (8GB VRAM)** — GPU reserved for transformer inference; clustering kept on CPU. Note: the local embedding model, cross-encoder, and polarity LLM share this VRAM budget.

### 4.5 Data Stores & Infrastructure
- **Qdrant** — vector DB; HNSW index, INT8 scalar quantization, payload indexes on `projectId` / `documentDoi` / `claimClassification`. Runs as a local container.
- **Redis** — query-hash cache (Phase 1, 24h TTL) **and** the backbone for the job queue.
- **MinIO** — local **S3-compatible** object storage for the immutable PDF vault (Phase 4). `storagePointer` stays an `s3://` URI; deploys to real S3/GCS via config.

### 4.6 Pipeline Execution / Queue
- **BullMQ** (on Redis) — job queue driving the phases as an async worker pipeline (`discovery → rank → resolve → parse → synth → gen`). Resumable and observable; same code runs 1 worker per stage locally or N scaled workers when deployed. Matches the "async worker pool" design language in the phase docs.

### 4.7 Web UI
- **React + Vite**, as an in-monorepo TypeScript package, importing the generated contract types directly.
- **Real-time progress** streamed from the orchestrator over **SSE (or WebSocket)** so the user sees phase-by-phase progress (1/7 … 7/7) during multi-minute runs rather than a blank spinner.
- Hosts the **Phase 4 paywall intercept** (drag-and-drop upload of paywalled PDFs) and renders the final brief with interactive `[1][2]` citations.

### 4.8 External APIs
- **Discovery (Phase 2):** OpenAlex, Semantic Scholar, Crossref.
- **Full-text resolution (Phase 4):** Unpaywall, arXiv, PubMed Central (PMC).

---

## 5. Repository Structure (Monorepo)

```text
udaan/
├─ packages/                 # TypeScript workspaces
│  ├─ contracts/             # schema source of truth → generates TS + Python types
│  ├─ orchestrator/          # Phases 1, 2, 4, 7 + BullMQ workers + web API (SSE)
│  ├─ web/                   # React + Vite frontend (real-time progress, paywall upload)
│  └─ shared/                # logging, telemetry, config, common utils
├─ services/                 # Python services (each a discrete worker pool)
│  ├─ parsing/               # Phase 5 — Docling ingestion, claim extraction, local embeddings
│  ├─ ranking/               # Phase 3 — cross-encoder re-ranking
│  └─ synthesis/             # Phase 6 — clustering + polarity inference
├─ infra/                    # docker-compose (Qdrant, Redis, MinIO), env templates
└─ STACK.md / PROJECT.md / <phase docs>
```

---

## 6. The Contracts Boundary (Critical)

The phase docs promise **strict, immutable interface contracts** between phases. To honor that across two languages:

- **Define each contract once** (`packages/contracts/`) using a language-neutral schema — **JSON Schema** is the default choice (alternatives: Protobuf, or Pydantic-as-source).
- **Generate downstream types:**
  - TypeScript `interface`s (e.g. `CandidatePaper`, `ResolutionStatus`, `ClusterPolarity`) — also imported directly by the `web` package.
  - Python **Pydantic** models for the ML services.
- **Validate at every boundary** — the same schema validates payloads on both sides and on every queue job, so a drift between TS and Python fails loudly instead of silently corrupting traceability.

Cross-service transport between the TS orchestrator and Python services is **HTTP/JSON** with **config-driven service URLs** (no hardcoded host) — the Python phases are already designed as standalone worker pools.

---

## 7. Tooling

| Concern | TypeScript side | Python side |
| --- | --- | --- |
| Package management | **pnpm** workspaces | **uv** (or Poetry) |
| Build / task runner | **Turborepo** | per-service scripts, orchestrated by Turbo tasks |
| Lint / format | ESLint + Prettier | Ruff (lint + format) |
| Type checking | `tsc` strict mode | mypy / Pydantic runtime validation |
| Testing | Vitest | pytest |
| Frontend | React + Vite | — |
| Job queue | BullMQ (Redis) | workers consume via HTTP from orchestrator |
| Schema codegen | from `packages/contracts/` | from `packages/contracts/` |
| Containerization | Docker (deploy-time images — see note) | Docker (deploy-time images — see note) |
| Local orchestration | **docker-compose** — infra only (Qdrant, Redis, MinIO) | services + Ollama run natively |

**Docker image strategy.** Locally we **use** official images for stateless infra (Qdrant, Redis, MinIO) via `docker-compose` — pulled, not built. Our own services (TS orchestrator/web, Python ML) and **Ollama run natively on the host**, *not* in containers: the GPU-bound work (Ollama, sentence-transformers/torch) needs direct access to the RTX 3070 Ti, and GPU passthrough into Docker on Windows requires the NVIDIA Container Toolkit + WSL2 — avoidable friction on a single dev machine. **Dockerfiles for our own services are authored at deploy time** (the §2 portability path), not required to run locally; the infra images carry over to deployment unchanged.

---

## 8. Finalized Decisions Log

| Decision | Choice | Notes |
| --- | --- | --- |
| Repository model | Polyglot monorepo | TS spine + Python ML services |
| Object storage | **MinIO** (S3 API) | filesystem rejected — keeps Phase 4 streaming intact; deploys to S3/GCS via config |
| Pipeline execution | **Redis + BullMQ** queue | resumable, observable, scales workers without code change |
| Embeddings | **Local sentence-transformers** | behind `EmbeddingProvider` interface; swappable to API |
| Interface | **Local web UI** (React + Vite) | in-monorepo, real-time SSE/WebSocket progress |
| Cross-service transport | **HTTP/JSON** | config-driven URLs; gRPC unnecessary at this scale |
| Cloud provider | None (local) | designed for config-only deploy later |
| Data stores | Qdrant + Redis (local containers) | via docker-compose |

### Resolved during implementation
- **Web API framework:** **Fastify** (orchestrator HTTP/SSE surface).
- **Python service framework:** **FastAPI + uvicorn** (ranking, parsing, synthesis).
- **Embedding model:** default **`BAAI/bge-base-en-v1.5`** (768-dim), behind the `EmbeddingProvider` interface; hashing fallback when the `ml` extra is absent.
- **PDF parsing fallback:** **pypdf** (base) with Docling as the `ml` extra.
- **Frontend:** **React + Vite** (`packages/web`), real-time SSE progress.

---

## 9. Rationale Summary

- **Monorepo** — phases share strict contracts and a single release/versioning story; keeps the schema source of truth adjacent to all consumers (TS, Python, and the web UI).
- **Polyglot** — best-tool-per-phase; Python ML dependencies (Docling especially) are non-negotiable, while TS excels at the async I/O orchestration that surrounds them.
- **Schema-first contracts** — the only safe way to span two languages without breaking the "every claim is traceable" guarantee the entire product is built on.
- **Deploy-portable from day one** — MinIO, queue-based workers, swappable providers, and env-based config mean local→cloud is configuration, not rework.
