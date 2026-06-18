/* eslint-disable */
/**
 * AUTO-GENERATED from schema/*.schema.json — do not edit by hand.
 * Regenerate: pnpm --filter @udaan/contracts gen
 */
/**
 * Phase 5 (Ingestion & Parsing) /ingest response, consumed by the orchestrator pipeline.
 */
export interface IngestResult {
  projectId: string;
  claimsExtracted: number;
  claimIds: string[];
}
