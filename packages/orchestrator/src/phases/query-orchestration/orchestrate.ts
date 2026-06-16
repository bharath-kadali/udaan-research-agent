/**
 * Phase 1 entrypoint: compiles a natural-language research query into a
 * CompiledDiscoveryManifest for Phase 2.
 *
 *   guard -> cache lookup -> intent extraction -> lexical compilation -> manifest
 */

import type { CompiledDiscoveryManifest } from "@udaan/contracts";
import type { LLMProvider } from "@udaan/shared";
import { buildCompilations } from "./compiler.js";
import { guard } from "./guard.js";
import { extractIntent } from "./intent.js";
import { queryHash, type QueryCache } from "./cache.js";
import type { ResearchQueryRequest } from "./types.js";

export interface OrchestrateDeps {
  llm: LLMProvider;
  cache: QueryCache;
}

export type OrchestrateResult =
  | { status: "ok"; manifest: CompiledDiscoveryManifest; cached: boolean }
  | { status: "rejected"; reason: string };

export async function orchestrateQuery(
  request: ResearchQueryRequest,
  deps: OrchestrateDeps,
): Promise<OrchestrateResult> {
  const checked = guard(request.rawQuery);
  if (!checked.ok) {
    return { status: "rejected", reason: checked.reason ?? "REJECTED" };
  }

  const key = queryHash(checked.sanitized);
  const cached = await deps.cache.get(key);
  if (cached) {
    return { status: "ok", manifest: cached, cached: true };
  }

  const intent = await extractIntent(checked.sanitized, deps.llm);
  const manifest: CompiledDiscoveryManifest = {
    projectId: request.projectId,
    searchContext: {
      originalQuery: checked.sanitized,
      temporalBounds: intent.temporalBounds,
      coreConcepts: intent.coreConcepts,
    },
    compilations: buildCompilations(intent, checked.sanitized),
    telemetry: {
      inputTokens: checked.sanitized.split(/\s+/).length,
      classificationStatus: intent.degraded ? "DEGRADED_FALLBACK" : "VALIDATED_RESEARCH_INTENT",
      degradedMode: intent.degraded,
    },
  };

  await deps.cache.set(key, manifest);
  return { status: "ok", manifest, cached: false };
}
