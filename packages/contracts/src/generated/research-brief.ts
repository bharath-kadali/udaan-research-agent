/* eslint-disable */
/**
 * AUTO-GENERATED from schema/*.schema.json — do not edit by hand.
 * Regenerate: pnpm --filter @udaan/contracts gen
 */
/**
 * Phase 7 (Constrained Generation & Citation Weaving) output: the final deliverable.
 */
export interface ResearchBrief {
  projectId: string;
  metadata: BriefMetadata;
  sections: BriefSection[];
  bibliography: {
    [k: string]: BibliographyEntry;
  };
}
export interface BriefMetadata {
  totalClaims: number;
  sectionsGenerated: number;
  /**
   * True if any stage ran on a low-quality fallback implementation.
   */
  degraded: boolean;
  /**
   * Stages that used a fallback (e.g. embedding, rerank, clustering, parsing).
   */
  degradedStages: string[];
}
export interface BriefSection {
  heading: string;
  bodyText: string;
}
export interface BibliographyEntry {
  claimId: string;
  doi: string | null;
  text: string;
}
