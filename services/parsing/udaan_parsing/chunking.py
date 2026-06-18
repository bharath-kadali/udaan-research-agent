"""Context-preserving chunker (Phase 5 §2.2). Slices text along paragraph
boundaries, tracking the current section so each chunk carries lineage."""

from __future__ import annotations

import re
from dataclasses import dataclass

MIN_CHUNK_CHARS = 40
_HEADING_MAX_CHARS = 60

_SECTIONS = {
    "abstract": "Abstract",
    "introduction": "Introduction",
    "background": "Background",
    "related work": "Related Work",
    "methods": "Methods",
    "methodology": "Methods",
    "materials and methods": "Methods",
    "results": "Results",
    "evaluation": "Results",
    "discussion": "Discussion",
    "conclusion": "Conclusion",
    "conclusions": "Conclusion",
    "limitations": "Limitations",
}


@dataclass
class Chunk:
    text: str
    section: str
    page_number: int
    node_type: str = "paragraph"
    sub_section: str | None = None


def _detect_section(paragraph: str) -> str | None:
    if len(paragraph) > _HEADING_MAX_CHARS:
        return None
    key = re.sub(r"^[0-9.\s]+", "", paragraph).strip().lower().rstrip(":")
    return _SECTIONS.get(key)


def _split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def chunk_pages(pages: list[str], *, start_section: str = "Body") -> list[Chunk]:
    section = start_section
    chunks: list[Chunk] = []
    for page_index, page_text in enumerate(pages, start=1):
        for paragraph in _split_paragraphs(page_text):
            detected = _detect_section(paragraph)
            if detected is not None:
                section = detected
                continue
            if len(paragraph) >= MIN_CHUNK_CHARS:
                chunks.append(Chunk(text=paragraph, section=section, page_number=page_index))
    return chunks
