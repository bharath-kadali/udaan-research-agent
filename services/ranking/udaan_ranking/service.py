"""Phase 3 core: turn a candidate pool + query into a PrioritizedIngestionIndex.
Pure and provider-agnostic so it is testable without ML deps or HTTP."""

from __future__ import annotations

from typing import Protocol

from udaan_contracts import CandidatePaper, PrioritizedIngestionIndex, RankedPaper

from .scoring import stratify
from .sequence import build_documents


class Reranker(Protocol):
    method: str

    def rerank(self, query: str, documents: list[str]) -> list[tuple[int, float]]: ...


def rerank_candidates(
    original_query: str,
    candidates: list[CandidatePaper],
    reranker: Reranker,
    project_id: str = "",
) -> PrioritizedIngestionIndex:
    documents = build_documents(candidates)
    scored = reranker.rerank(original_query, documents)
    method = getattr(reranker, "method", "CROSS_ENCODER")
    ranked_pairs = stratify(scored, apply_floor=(method == "CROSS_ENCODER"))

    manifest: list[RankedPaper] = []
    for rank, (idx, score) in enumerate(ranked_pairs, start=1):
        c = candidates[idx]
        manifest.append(
            RankedPaper(
                rank=rank,
                relevance_score=round(score, 4),
                internal_id=c.internal_id,
                doi=c.doi,
                title=c.title,
                abstract=c.abstract,
                publication_date=c.publication_date,
            )
        )

    return PrioritizedIngestionIndex(
        project_id=project_id,
        total_processed=len(candidates),
        total_filtered=len(manifest),
        ranked_manifest=manifest,
    )
