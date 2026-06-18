from udaan_contracts import CandidatePaper
from udaan_ranking.reranker import LexicalReranker
from udaan_ranking.service import rerank_candidates


def make(internal_id: str, title: str, abstract: str) -> CandidatePaper:
    return CandidatePaper(
        internal_id=internal_id,
        doi=None,
        title=title,
        abstract=abstract,
        authors=["Smith, J."],
        publication_date="2023-01-01",
        citation_count=0,
        source_providers=["OpenAlex"],
        source_urls=[],
    )


def test_rerank_orders_by_relevance_and_builds_manifest():
    relevant = make(
        "a",
        "Micro-caching and tail latency",
        "micro caching reduces p99 tail latency in distributed stateful systems",
    )
    irrelevant = make(
        "b", "Cooking", "a long unrelated abstract about medieval cooking techniques and recipes"
    )

    index = rerank_candidates(
        "micro caching tail latency", [irrelevant, relevant], LexicalReranker(), "proj_1"
    )

    assert index.project_id == "proj_1"
    assert index.total_processed == 2
    assert index.ranked_manifest[0].rank == 1
    assert index.ranked_manifest[0].internal_id == "a"
    assert index.ranked_manifest[0].relevance_score >= index.ranked_manifest[1].relevance_score
