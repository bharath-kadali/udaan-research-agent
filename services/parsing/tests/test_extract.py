import json

from udaan_parsing.chunking import Chunk
from udaan_parsing.extract import extract_claims


class StubLLM:
    def __init__(self, response: str) -> None:
        self.response = response

    def complete(self, messages, *, system=None, json_schema=None, max_tokens=None) -> str:
        return self.response


def test_quote_anchor_drops_unverifiable_and_invalid_claims():
    chunk = Chunk(
        text="Micro-caching reduced p99 latency by 40% in our experiments.",
        section="Results",
        page_number=6,
    )
    response = json.dumps({
        "claims": [
            # valid: quote is a verbatim substring
            {"claimText": "Micro-caching cut p99 latency ~40%", "sourceQuote": "reduced p99 latency by 40%", "claimClassification": "FINDING"},
            # dropped: quote not present in the chunk (hallucinated)
            {"claimText": "fabricated", "sourceQuote": "this sentence is not in the passage", "claimClassification": "FINDING"},
            # dropped: invalid classification
            {"claimText": "bad class", "sourceQuote": "Micro-caching", "claimClassification": "OPINION"},
        ]
    })

    claims = extract_claims(chunk, "proj_1", "10.1/x", StubLLM(response))

    assert len(claims) == 1
    assert claims[0].claim_classification == "FINDING"
    assert claims[0].source_quote in chunk.text
    assert claims[0].lineage.page_number == 6
    assert claims[0].lineage.section == "Results"


def test_unparseable_output_yields_no_claims():
    chunk = Chunk(text="a passage long enough to chunk", section="Body", page_number=1)
    assert extract_claims(chunk, "p", None, StubLLM("not json at all")) == []
