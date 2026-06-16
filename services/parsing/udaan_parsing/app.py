"""FastAPI surface for Phase 5. POST /ingest accepts a base64 PDF (the worker
fetches bytes from the object vault) and returns the extracted-claim summary."""

from __future__ import annotations

import base64

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field
from udaan_shared import create_embedding_provider, create_llm_provider, load_config, register_defaults

from .embeddings import register_sentence_transformers
from .ingest import ingest_document
from .parser import parse_pdf
from .store import ClaimStore, InMemoryClaimStore, QdrantClaimStore

register_defaults()
register_sentence_transformers()  # overrides "local" embedding if ML extra present

app = FastAPI(title="Udaan Parsing (Phase 5)")

_llm = None
_embed = None
_store: ClaimStore | None = None


def _deps():
    global _llm, _embed, _store
    if _llm is None:
        cfg = load_config()
        _llm = create_llm_provider(cfg)
        _embed = create_embedding_provider(cfg)
        try:
            _store = QdrantClaimStore(cfg.qdrant_url)
        except Exception:
            _store = InMemoryClaimStore()
    return _llm, _embed, _store


class IngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(alias="projectId")
    document_doi: str | None = Field(default=None, alias="documentDoi")
    pdf_base64: str = Field(alias="pdfBase64")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ingest")
def ingest(req: IngestRequest) -> dict:
    llm, embed, store = _deps()
    data = base64.b64decode(req.pdf_base64)
    claims = ingest_document(
        data, req.document_doi, req.project_id, parse=parse_pdf, llm=llm, embed=embed, store=store
    )
    return {
        "projectId": req.project_id,
        "claimsExtracted": len(claims),
        "claimIds": [c.claim_id for c in claims],
    }
