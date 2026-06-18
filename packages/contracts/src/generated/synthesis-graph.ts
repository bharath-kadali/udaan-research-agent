/* eslint-disable */
/**
 * AUTO-GENERATED from schema/*.schema.json — do not edit by hand.
 * Regenerate: pnpm --filter @udaan/contracts gen
 */
/**
 * Phase 6 (Cross-Source Synthesis & Polarity) output, consumed by Phase 7.
 */
export interface SynthesisGraph {
  projectId: string;
  synthesisGraph: SynthesisCluster[];
}
export interface SynthesisCluster {
  clusterId: string;
  generatedTopicLabel: string;
  polarity: "AGREEMENT" | "CONTRADICTION" | "THIN_EVIDENCE" | "NOISE";
  claims: SynthesisClaimRef[];
}
export interface SynthesisClaimRef {
  claimId: string;
  doi: string | null;
  text: string;
}
