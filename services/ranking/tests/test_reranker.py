from udaan_ranking.reranker import LexicalReranker


def test_lexical_prefers_the_relevant_document():
    r = LexicalReranker()
    scores = dict(r.rerank("micro caching tail latency", [
        "micro caching reduces tail latency in distributed systems",
        "a study of medieval cooking techniques",
    ]))
    assert scores[0] > scores[1]
    assert r.method == "LEXICAL_FALLBACK"


def test_lexical_handles_empty_documents():
    assert LexicalReranker().rerank("q", []) == []
