/* eslint-disable */
/**
 * AUTO-GENERATED from schema/*.schema.json — do not edit by hand.
 * Regenerate: pnpm --filter @udaan/contracts gen
 */
/**
 * Phase 3 (Cross-Encoder Re-Ranking) output, consumed by Phase 4.
 */
export interface PrioritizedIngestionIndex {
  projectId: string;
  totalProcessed: number;
  totalFiltered: number;
  rankedManifest: RankedPaper[];
}
export interface RankedPaper {
  rank: number;
  relevanceScore: number;
  internalId: string;
  doi: string | null;
  title: string;
  abstract: string;
  publicationDate: string;
}
