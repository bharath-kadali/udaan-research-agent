"""Tests for QdrantClaimStore with a mocked qdrant client."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from udaan_contracts import ClaimClassification, ClaimLineage, ValidatedClaim
from udaan_parsing.store import QdrantClaimStore


def _claim(claim_id: str = "c1", doi: str | None = "10.1/x") -> ValidatedClaim:
    return ValidatedClaim(
        claim_id=claim_id,
        project_id="proj1",
        document_doi=doi,
        claim_classification=ClaimClassification.FINDING,
        claim_text="A finding about molecular binding affinity under controlled conditions.",
        source_quote="molecular binding affinity under controlled conditions",
        lineage=ClaimLineage(section="Results", page_number=2, structural_node_type="paragraph"),
        vector_embedding=[0.1, 0.2, 0.3],
    )


@patch("qdrant_client.QdrantClient")
def test_qdrant_store_upsert_sends_points(mock_client_cls: MagicMock) -> None:
    client = MagicMock()
    client.get_collection.side_effect = Exception("missing")
    mock_client_cls.return_value = client

    store = QdrantClaimStore("http://localhost:6333")
    store.upsert([_claim()])

    client.create_collection.assert_called_once()
    client.upsert.assert_called_once()
    points = client.upsert.call_args.kwargs["points"]
    assert len(points) == 1
    assert points[0].vector == [0.1, 0.2, 0.3]


@patch("qdrant_client.QdrantClient")
def test_qdrant_store_delete_document_claims(mock_client_cls: MagicMock) -> None:
    client = MagicMock()
    client.get_collection.return_value = {}
    mock_client_cls.return_value = client

    store = QdrantClaimStore("http://localhost:6333")
    store.delete_document_claims("proj1", "10.1/x")

    client.delete.assert_called_once()
