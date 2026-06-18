"""Claim storage (Phase 5 §2.5 / §4). Qdrant in real runs; in-memory for
tests/no-infra. Qdrant client is lazily imported (optional `qdrant` extra)."""

from __future__ import annotations

import uuid
from typing import Protocol

from udaan_contracts import ValidatedClaim


class ClaimStore(Protocol):
    def upsert(self, claims: list[ValidatedClaim]) -> None: ...


class InMemoryClaimStore:
    def __init__(self) -> None:
        self.claims: list[ValidatedClaim] = []

    def upsert(self, claims: list[ValidatedClaim]) -> None:
        self.claims.extend(claims)


class QdrantClaimStore:
    """Stores claims as points with payload indexing on projectId / documentDoi /
    claimClassification (Phase 5 §4.1)."""

    def __init__(self, url: str, collection: str = "claims", dim: int = 384) -> None:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, VectorParams

        self.client = QdrantClient(url=url)
        self.collection = collection
        try:
            self.client.get_collection(collection)
        except Exception:
            self.client.create_collection(
                collection_name=collection,
                vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
            )

    def upsert(self, claims: list[ValidatedClaim]) -> None:
        from qdrant_client.models import PointStruct

        points = []
        for claim in claims:
            if claim.vector_embedding is None:
                continue
            point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, claim.claim_id))
            payload = claim.model_dump(by_alias=True, exclude={"vector_embedding"})
            points.append(PointStruct(id=point_id, vector=claim.vector_embedding, payload=payload))
        if points:
            self.client.upsert(collection_name=self.collection, points=points)
