/** Phase 2 — Open Graph Gateway: local types. */

import type { CandidatePaper, CompiledDiscoveryManifest } from "@udaan/contracts";

/**
 * Strategy interface for an external academic graph (Phase 2 §2.1). Each
 * concrete adapter maps its provider's chaotic JSON into CandidatePaper records.
 */
export interface OpenGraphProvider {
  readonly name: string;
  search(manifest: CompiledDiscoveryManifest, signal?: AbortSignal): Promise<CandidatePaper[]>;
}

export interface AdapterResult {
  provider: string;
  ok: boolean;
  records: CandidatePaper[];
  error?: string;
}
