/* eslint-disable */
/**
 * AUTO-GENERATED from schema/*.schema.json — do not edit by hand.
 * Regenerate: pnpm --filter @udaan/contracts gen
 */
/**
 * Phase 5 (Ingestion & Parsing) atomic output: a quote-anchored claim.
 */
export interface ValidatedClaim {
  claimId: string;
  projectId: string;
  documentDoi: string | null;
  claimClassification: "FINDING" | "HYPOTHESIS" | "LIMITATION" | "METHODOLOGY";
  claimText: string;
  /**
   * Exact, unmodified substring of the source chunk (verified deterministically).
   */
  sourceQuote: string;
  lineage: ClaimLineage;
  vectorEmbedding?: number[] | null;
}
export interface ClaimLineage {
  section: string;
  subSection?: string | null;
  pageNumber: number;
  structuralNodeType: string;
}
