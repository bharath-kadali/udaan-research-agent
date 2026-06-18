/* eslint-disable */
/**
 * AUTO-GENERATED from schema/*.schema.json — do not edit by hand.
 * Regenerate: pnpm --filter @udaan/contracts gen
 */
/**
 * Phase 4 (JIT Full-Text Resolution) output, consumed by Phase 5.
 */
export interface ResolutionManifest {
  projectId: string;
  resolutionSummary: ResolutionSummary;
  manifest: ResolutionManifestEntry[];
}
export interface ResolutionSummary {
  totalRequested: number;
  successfullyResolved: number;
  paywalled: number;
}
export interface ResolutionManifestEntry {
  internalId: string;
  doi: string | null;
  status: "PENDING" | "RESOLVED_CACHE" | "RESOLVED_DOWNLOAD" | "PAYWALLED" | "FAILED_CORRUPTED";
  storagePointer: string | null;
  metadataSnapshot: MetadataSnapshot;
}
export interface MetadataSnapshot {
  title: string;
}
