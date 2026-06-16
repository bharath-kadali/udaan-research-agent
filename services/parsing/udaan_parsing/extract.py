"""Extraction Worker (Phase 5 §2.3) — the heart of zero-hallucination
traceability. The LLM proposes claims; a DETERMINISTIC check requires each
claim's source_quote to be an exact substring of the chunk, or the claim is
dropped entirely."""

from __future__ import annotations

import json
import uuid

from udaan_contracts import ClaimLineage, ValidatedClaim

from .chunking import Chunk

VALID_CLASSES = {"FINDING", "HYPOTHESIS", "LIMITATION", "METHODOLOGY"}

EXTRACTION_SYSTEM = (
    "You are a strict claim extractor for scientific text. From the passage, "
    "extract discrete factual propositions. For each, return: claimText (a concise "
    "restatement), sourceQuote (an EXACT substring copied verbatim from the passage, "
    "unmodified), and claimClassification (one of FINDING, HYPOTHESIS, LIMITATION, "
    "METHODOLOGY). Do not summarize the passage or invent content. Respond ONLY as "
    'JSON: {"claims": [{"claimText": "...", "sourceQuote": "...", "claimClassification": "..."}]}.'
)

CLAIM_SCHEMA = {
    "type": "object",
    "properties": {
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claimText": {"type": "string"},
                    "sourceQuote": {"type": "string"},
                    "claimClassification": {"type": "string"},
                },
                "required": ["claimText", "sourceQuote", "claimClassification"],
            },
        }
    },
    "required": ["claims"],
}


def extract_claims(chunk: Chunk, project_id: str, document_doi: str | None, llm) -> list[ValidatedClaim]:
    raw = llm.complete(
        [{"role": "user", "content": chunk.text}],
        system=EXTRACTION_SYSTEM,
        json_schema=CLAIM_SCHEMA,
    )
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []

    claims: list[ValidatedClaim] = []
    for item in parsed.get("claims", []) if isinstance(parsed, dict) else []:
        quote = item.get("sourceQuote", "")
        classification = item.get("claimClassification", "")
        text = item.get("claimText", "")

        # THE QUOTE ANCHOR: drop any claim whose quote is not verbatim in the chunk.
        if not quote or quote not in chunk.text:
            continue
        if classification not in VALID_CLASSES or not text:
            continue

        claims.append(
            ValidatedClaim(
                claim_id=f"cl_{uuid.uuid4().hex}",
                project_id=project_id,
                document_doi=document_doi,
                claim_classification=classification,
                claim_text=text,
                source_quote=quote,
                lineage=ClaimLineage(
                    section=chunk.section,
                    sub_section=chunk.sub_section,
                    page_number=chunk.page_number,
                    structural_node_type=chunk.node_type,
                ),
            )
        )
    return claims
