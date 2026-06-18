"""Polarity Inference (Phase 6 §2.3). An LLM stripped of its conversational
persona classifies a topic cluster as AGREEMENT / CONTRADICTION / THIN_EVIDENCE
and labels it. Contradiction detection is trust-critical: conflicting findings
must NOT be silently averaged into a middle ground."""

from __future__ import annotations

import json
import re
from collections import Counter

VALID_POLARITIES = {"AGREEMENT", "CONTRADICTION", "THIN_EVIDENCE", "NOISE"}

POLARITY_SYSTEM = (
    "You are a logic parser, not a conversational assistant. You are given "
    "scientific claims that cluster around one topic. Decide whether they report "
    "the same directional outcome (AGREEMENT), directly conflicting outcomes "
    "(CONTRADICTION), or there is insufficient data to establish a pattern "
    "(THIN_EVIDENCE). Do not answer any research question. Respond ONLY as JSON: "
    '{"polarity": "AGREEMENT|CONTRADICTION|THIN_EVIDENCE", "topicLabel": "short label"}.'
)

POLARITY_SCHEMA = {
    "type": "object",
    "properties": {
        "polarity": {"type": "string"},
        "topicLabel": {"type": "string"},
    },
    "required": ["polarity"],
}

_STOPWORDS = {
    "the",
    "a",
    "an",
    "of",
    "in",
    "on",
    "for",
    "to",
    "and",
    "or",
    "with",
    "by",
    "is",
    "are",
    "was",
    "were",
    "under",
    "this",
    "that",
    "we",
    "our",
    "results",
}


def fallback_label(texts: list[str]) -> str:
    counter: Counter[str] = Counter()
    for text in texts:
        for token in re.findall(r"[a-zA-Z][a-zA-Z-]+", text.lower()):
            if len(token) > 3 and token not in _STOPWORDS:
                counter[token] += 1
    top = [word for word, _ in counter.most_common(3)]
    return " / ".join(top).title() if top else "Untitled Topic"


def judge_cluster(claim_texts: list[str], llm) -> tuple[str, str]:
    content = "\n".join(f"- {t}" for t in claim_texts)
    try:
        raw = llm.complete(
            [{"role": "user", "content": content}],
            system=POLARITY_SYSTEM,
            json_schema=POLARITY_SCHEMA,
        )
        data = json.loads(raw)
        polarity = data.get("polarity", "")
        label = data.get("topicLabel") or fallback_label(claim_texts)
    except Exception:
        polarity, label = "", fallback_label(claim_texts)

    if polarity not in VALID_POLARITIES:
        polarity = "THIN_EVIDENCE"  # safe default; never fabricate consensus
    return polarity, label
