/**
 * Local demo runner for Phase 1. Compiles a query end-to-end and prints the
 * manifest. Works without infra: if Ollama is unreachable, intent extraction
 * falls back to the deterministic tokenizer (degraded mode).
 *
 *   pnpm --filter @udaan/orchestrator dev "your research question since 2022"
 */

import { InMemoryQueryCache } from "./phases/query-orchestration/cache.js";
import { orchestrateQuery } from "./phases/query-orchestration/orchestrate.js";
import { OllamaLLMProvider } from "./providers/ollama.js";

const rawQuery =
  process.argv.slice(2).join(" ") ||
  "How does micro-caching impact p99 tail latency in distributed stateful architectures since 2022?";

const llm = new OllamaLLMProvider({
  ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
  model: process.env.LLM_MODEL ?? "qwen2.5:7b-instruct-q4_K_M",
});

const result = await orchestrateQuery(
  { userId: "cli", projectId: "cli-demo", rawQuery, timestamp: new Date().toISOString() },
  { llm, cache: new InMemoryQueryCache() },
);

console.log(JSON.stringify(result, null, 2));
