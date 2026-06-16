"""Claim source (Phase 6 §2.1). Fetches FINDING claims for a project. Qdrant in
real runs (lazy import, optional extra); in-memory for tests/no-infra."""

from __future__ import annotations

from typing import Protocol

from udaan_contracts import ValidatedClaim


class ClaimSource(Protocol):
    def fetch_findings(self, project_id: str) -> list[ValidatedClaim]: ...


class InMemoryClaimSource:
    def __init__(self, claims: list[ValidatedClaim]) -> None:
        self._claims = claims

    def fetch_findings(self, project_id: str) -> list[ValidatedClaim]:
        return [
            c for c in self._claims
            if c.project_id == project_id and c.claim_classification == "FINDING"
        ]


class QdrantClaimSource:
    def __init__(self, url: str, collection: str = "claims") -> None:
        from qdrant_client import QdrantClient

        self.client = QdrantClient(url=url)
        self.collection = collection

    def fetch_findings(self, project_id: str) -> list[ValidatedClaim]:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        flt = Filter(
            must=[
                FieldCondition(key="projectId", match=MatchValue(value=project_id)),
                FieldCondition(key="claimClassification", match=MatchValue(value="FINDING")),
            ]
        )
        points, _ = self.client.scroll(
            collection_name=self.collection, scroll_filter=flt, with_vectors=True, limit=10_000
        )
        claims: list[ValidatedClaim] = []
        for point in points:
            payload = dict(point.payload or {})
            payload["vectorEmbedding"] = point.vector
            claims.append(ValidatedClaim.model_validate(payload))
        return claims
