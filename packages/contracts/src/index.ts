/**
 * Cross-phase contracts (TypeScript view).
 *
 * Types are generated from `schema/*.schema.json` via `pnpm gen`.
 * The Python (Pydantic) mirror lives in `python/udaan_contracts/models.py`.
 * Validate payloads against the schema at every phase boundary and queue job.
 *
 * Runtime JSON Schemas are exposed from `@udaan/contracts/schemas` so browser
 * consumers do not pull in the Node filesystem loader.
 */

export type {
  ResolutionStatus,
  ClaimClassification,
  ClusterPolarity,
} from "./generated/enums.js";

export type {
  CompiledDiscoveryManifest,
  TemporalBounds,
  SearchContext,
  Compilations,
  DiscoveryTelemetry,
} from "./generated/compiled-discovery-manifest.js";

export type { CandidatePaper } from "./generated/candidate-paper.js";

export type { PrioritizedIngestionIndex, RankedPaper } from "./generated/ranked-paper.js";

export type {
  ResolutionManifest,
  ResolutionManifestEntry,
  ResolutionSummary,
  MetadataSnapshot,
} from "./generated/resolution-manifest.js";

export type { ValidatedClaim, ClaimLineage } from "./generated/validated-claim.js";

export type { IngestResult } from "./generated/ingest-result.js";

export type {
  SynthesisGraph,
  SynthesisCluster,
  SynthesisClaimRef,
} from "./generated/synthesis-graph.js";

export type {
  ResearchBrief,
  BriefMetadata,
  BriefSection,
  BibliographyEntry,
} from "./generated/research-brief.js";
