from udaan_synthesis.clustering import cosine, greedy_cluster


def test_cosine_basics():
    assert cosine([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert cosine([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert cosine([0.0, 0.0], [1.0, 0.0]) == 0.0


def test_greedy_groups_similar_and_separates_distinct():
    vectors = [[1.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]
    groups = greedy_cluster(vectors, threshold=0.6)
    assert len(groups) == 2
    assert sorted(len(g) for g in groups) == [1, 2]
