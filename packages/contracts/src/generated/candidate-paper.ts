/* eslint-disable */
/**
 * AUTO-GENERATED from schema/*.schema.json — do not edit by hand.
 * Regenerate: pnpm --filter @udaan/contracts gen
 */
/**
 * The sole DTO allowed to exit Phase 2 (Open Graph Gateway) and enter Phase 3.
 */
export interface CandidatePaper {
  /**
   * UUID generated during normalization
   */
  internalId: string;
  /**
   * Nullable for pre-prints
   */
  doi: string | null;
  title: string;
  abstract: string;
  authors: string[];
  /**
   * ISO 8601 (YYYY-MM-DD)
   */
  publicationDate: string;
  citationCount: number;
  sourceProviders: string[];
  sourceUrls: string[];
}
