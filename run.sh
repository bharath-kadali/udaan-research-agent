#!/usr/bin/env bash
#
# Start the full Udaan stack locally:
#   infra (Qdrant, Redis, MinIO) -> Python services (3,5,6) -> orchestrator API -> web UI
#
# Usage:  bash run.sh
# Stop:   Ctrl+C (stops app processes; infra is left running)
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/.logs"
mkdir -p "$LOG_DIR"
PIDS=()

cleanup() {
  echo ""
  echo "→ Stopping app processes..."
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  echo "  Infra (Qdrant/Redis/MinIO) left running. Stop it with:"
  echo "    docker compose -f infra/docker-compose.yml down"
}
trap cleanup EXIT INT TERM

# --- 1. Config ---------------------------------------------------------------
if [ ! -f infra/.env ]; then
  echo "→ Creating infra/.env from template"
  cp infra/.env.example infra/.env
fi
set -a; . infra/.env; set +a

# --- 2. Infra (official images) ---------------------------------------------
echo "→ Starting infra (Qdrant, Redis, MinIO)"
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d

# --- 3. First-run dependency install ----------------------------------------
if [ ! -d node_modules ]; then
  echo "→ Installing JS workspace deps (first run)"
  pnpm install
fi
for svc in ranking parsing synthesis; do
  if [ ! -d "services/$svc/.venv" ]; then
    echo "→ Syncing services/$svc (first run)"
    (cd "services/$svc" && uv sync)
  fi
done

# --- 4. Python services ------------------------------------------------------
echo "→ Starting Python services"
(cd services/ranking   && uv run python -m udaan_ranking)   >"$LOG_DIR/ranking.log"   2>&1 & PIDS+=($!)
(cd services/parsing   && uv run python -m udaan_parsing)   >"$LOG_DIR/parsing.log"   2>&1 & PIDS+=($!)
(cd services/synthesis && uv run python -m udaan_synthesis) >"$LOG_DIR/synthesis.log" 2>&1 & PIDS+=($!)

# --- 5. Orchestrator API + Web UI -------------------------------------------
echo "→ Starting orchestrator API + web UI"
pnpm --filter @udaan/orchestrator dev >"$LOG_DIR/orchestrator.log" 2>&1 & PIDS+=($!)
pnpm --filter @udaan/web dev           >"$LOG_DIR/web.log"          2>&1 & PIDS+=($!)

cat <<EOF

────────────────────────────────────────────────────────────
  Udaan is starting up
────────────────────────────────────────────────────────────
  Web UI            http://localhost:5173
  Orchestrator API  http://localhost:8080
  Ranking :8001   Parsing :8002   Synthesis :8003
  Qdrant            http://localhost:6333
  MinIO console     http://localhost:9001  (${MINIO_ROOT_USER:-minioadmin}/${MINIO_ROOT_PASSWORD:-minioadmin})

  Logs:  .logs/*.log
  LLM:   ensure 'ollama serve' is running and 'ollama pull ${LLM_MODEL:-qwen2.5:7b-instruct-q4_K_M}'
         (the pipeline degrades gracefully if it is not)

  Press Ctrl+C to stop the app processes.
────────────────────────────────────────────────────────────
EOF

wait
