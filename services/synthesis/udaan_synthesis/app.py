"""FastAPI surface for Phase 6. POST /synthesize fetches a project's FINDING
claims and returns the SynthesisGraph."""

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field
from udaan_shared import create_llm_provider, load_config, register_defaults

from .source import ClaimSource, InMemoryClaimSource, QdrantClaimSource
from .synthesize import synthesize

register_defaults()

app = FastAPI(title="Udaan Synthesis (Phase 6)")

_llm = None
_source: ClaimSource | None = None


def _deps():
    global _llm, _source
    if _llm is None:
        cfg = load_config()
        _llm = create_llm_provider(cfg)
        try:
            _source = QdrantClaimSource(cfg.qdrant_url)
        except Exception:
            _source = InMemoryClaimSource([])
    return _llm, _source


class SynthesizeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: str = Field(alias="projectId")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/synthesize")
def synthesize_endpoint(req: SynthesizeRequest) -> dict:
    llm, source = _deps()
    claims = source.fetch_findings(req.project_id)
    graph = synthesize(claims, llm, project_id=req.project_id)
    return graph.model_dump(by_alias=True)
