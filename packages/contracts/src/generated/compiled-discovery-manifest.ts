/* eslint-disable */
/**
 * AUTO-GENERATED from schema/*.schema.json — do not edit by hand.
 * Regenerate: pnpm --filter @udaan/contracts gen
 */
/**
 * Phase 1 (Query Orchestration) output, consumed by Phase 2.
 */
export interface CompiledDiscoveryManifest {
  projectId: string;
  searchContext: SearchContext;
  compilations: Compilations;
  telemetry?: DiscoveryTelemetry;
}
export interface SearchContext {
  originalQuery: string;
  temporalBounds?: TemporalBounds | null;
  coreConcepts: string[];
}
export interface TemporalBounds {
  startYear?: number;
  endYear?: number;
}
export interface Compilations {
  booleanStandard: string;
  openAlexFilter?: string | null;
  semanticScholarPayload?: {
    [k: string]: unknown;
  } | null;
}
export interface DiscoveryTelemetry {
  inputTokens?: number | null;
  classificationStatus?: string | null;
  degradedMode?: boolean | null;
}
