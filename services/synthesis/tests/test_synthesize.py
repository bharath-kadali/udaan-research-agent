import json

from udaan_contracts import ClaimLineage, ValidatedClaim
from udaan_synthesis.synthesize import synthesize


class StubLLM:
    def __init__(self, response: str) -> None:
        self.response = response

    def complete(self, messages, *, system=None, json_schema=None, max_tokens=None) -> str:
        return self.response


def finding(claim_id: str, text: str, vector: list[float]) -> ValidatedClaim:
    return ValidatedClaim(
        claim_id=claim_id,
        project_id="p",
        document_doi=f"10.1/{claim_id}",
        claim_classification="FINDING",
        claim_text=text,
        source_quote=text,
        lineage=ClaimLineage(section="Results", page_number=1, structural_node_type="paragraph"),
        vector_embedding=vector,
    )


def test_detects_contradiction_and_surfaces_isolated_finding():
    # a and b share a topic vector (cluster together) but conflict; c is isolated.
    a = finding("a", "micro-caching reduced p99 latency by 40%", [1.0, 0.0, 0.0])
    b = finding("b", "micro-caching increased p99 latency by 15% under memory pressure", [1.0, 0.0, 0.0])
    c = finding("c", "cpu utilization scales linearly with cache volume", [0.0, 1.0, 0.0])

    llm = StubLLM(json.dumps({"polarity": "CONTRADICTION", "topicLabel": "Micro-caching latency"}))
    graph = synthesize([a, b, c], llm, project_id="p")

    assert graph.project_id == "p"
    by_size = sorted(graph.synthesis_graph, key=lambda cl: len(cl.claims))
    # the multi-claim cluster is flagged CONTRADICTION (not averaged away)
    assert by_size[-1].polarity == "CONTRADICTION"
    assert len(by_size[-1].claims) == 2
    # the lone finding is surfaced as THIN_EVIDENCE, not discarded
    assert by_size[0].polarity == "THIN_EVIDENCE"
    assert {ref.claim_id for cl in graph.synthesis_graph for ref in cl.claims} == {"a", "b", "c"}


def test_non_finding_claims_are_excluded():
    limitation = ValidatedClaim(
        claim_id="lim",
        project_id="p",
        document_doi=None,
        claim_classification="LIMITATION",
        claim_text="small sample size",
        source_quote="small sample size",
        lineage=ClaimLineage(section="Limitations", page_number=9, structural_node_type="paragraph"),
        vector_embedding=[1.0, 0.0],
    )
    graph = synthesize([limitation], StubLLM("{}"), project_id="p")
    assert graph.synthesis_graph == []
