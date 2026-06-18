"""Cross-phase contracts (Pydantic view).

AUTO-GENERATED from schema/*.schema.json — do not edit by hand.
Regenerate: pnpm --filter @udaan/contracts gen

Re-exports the generated modules under udaan_contracts.generated.
"""

from udaan_contracts.generated.candidate_paper_schema import CandidatePaper
from udaan_contracts.generated.compiled_discovery_manifest_schema import (
    Compilations,
    CompiledDiscoveryManifest,
    DiscoveryTelemetry,
    SearchContext,
    TemporalBounds,
)
from udaan_contracts.generated.enums_schema import (
    ClaimClassification,
    ClusterPolarity,
    ResolutionStatus,
)
from udaan_contracts.generated.ingest_result_schema import IngestResult
from udaan_contracts.generated.ranked_paper_schema import PrioritizedIngestionIndex, RankedPaper
from udaan_contracts.generated.research_brief_schema import (
    BibliographyEntry,
    BriefMetadata,
    BriefSection,
    ResearchBrief,
)
from udaan_contracts.generated.resolution_manifest_schema import (
    MetadataSnapshot,
    ResolutionManifest,
    ResolutionManifestEntry,
    ResolutionSummary,
)
from udaan_contracts.generated.synthesis_graph_schema import (
    SynthesisClaimRef,
    SynthesisCluster,
    SynthesisGraph,
)
from udaan_contracts.generated.validated_claim_schema import ClaimLineage, ValidatedClaim

__all__ = [
    "BibliographyEntry",
    "BriefMetadata",
    "BriefSection",
    "CandidatePaper",
    "ClaimClassification",
    "ClaimLineage",
    "ClusterPolarity",
    "Compilations",
    "CompiledDiscoveryManifest",
    "DiscoveryTelemetry",
    "IngestResult",
    "MetadataSnapshot",
    "PrioritizedIngestionIndex",
    "RankedPaper",
    "ResearchBrief",
    "ResolutionManifest",
    "ResolutionManifestEntry",
    "ResolutionStatus",
    "ResolutionSummary",
    "SearchContext",
    "SynthesisClaimRef",
    "SynthesisCluster",
    "SynthesisGraph",
    "TemporalBounds",
    "ValidatedClaim",
]
