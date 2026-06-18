"""FastAPI surface for Phase 3. POST /rerank accepts the cross-encoder payload
and returns a PrioritizedIngestionIndex."""

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field
from udaan_contracts import CandidatePaper
from udaan_shared import create_rerank_provider, load_config

from .reranker import register as register_rerankers
from .service import Reranker, rerank_candidates

register_rerankers()

app = FastAPI(title="Udaan Ranking (Phase 3)")

_reranker: Reranker | None = None


def get_reranker() -> Reranker:
    """Lazily construct the configured reranker (so import doesn't require env)."""
    global _reranker
    if _reranker is None:
        _reranker = create_rerank_provider(load_config())
    return _reranker


class RerankRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(default="", alias="projectId")
    original_query: str = Field(alias="originalQuery")
    candidate_papers: list[CandidatePaper] = Field(alias="candidatePapers")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/rerank")
def rerank(req: RerankRequest) -> dict:
    result = rerank_candidates(
        req.original_query, req.candidate_papers, get_reranker(), req.project_id
    )
    return result.model_dump(by_alias=True)
