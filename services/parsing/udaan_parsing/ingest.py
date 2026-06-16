"""Phase 5 orchestration for one document:
parse -> chunk -> extract (quote-anchored) -> embed -> store.
Dependencies are injected so the pipeline is testable without ML/infra."""

from __future__ import annotations

from collections.abc import Callable

from udaan_contracts import ValidatedClaim

from .chunking import Chunk
from .extract import extract_claims


def ingest_document(
    pdf_bytes: bytes,
    document_doi: str | None,
    project_id: str,
    *,
    parse: Callable[[bytes], list[Chunk]],
    llm,
    embed,
    store,
) -> list[ValidatedClaim]:
    chunks = parse(pdf_bytes)

    claims: list[ValidatedClaim] = []
    for chunk in chunks:
        claims.extend(extract_claims(chunk, project_id, document_doi, llm))

    if claims:
        vectors = embed.embed([c.claim_text for c in claims])
        for claim, vector in zip(claims, vectors):
            claim.vector_embedding = [float(x) for x in vector]
        store.upsert(claims)

    return claims
