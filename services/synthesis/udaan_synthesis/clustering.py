"""Statistical clustering (Phase 6 §2.2). CPU-bound, runs on claim vectors.

Base implementation is a deterministic greedy cosine-threshold clusterer (pure
Python, no deps) so the pipeline always works. With the `ml` extra, an
Agglomerative clusterer can be substituted; the greedy version is sufficient
for the micro-corpus sizes here.
"""

from __future__ import annotations

import math

DEFAULT_THRESHOLD = 0.6


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def greedy_cluster(vectors: list[list[float]], threshold: float = DEFAULT_THRESHOLD) -> list[list[int]]:
    """Assign each vector to the first cluster whose representative is within the
    cosine-similarity threshold, else start a new cluster. Deterministic."""
    clusters: list[list[int]] = []
    representatives: list[int] = []

    for i, vector in enumerate(vectors):
        best_cluster = -1
        best_sim = threshold
        for cluster_index, rep in enumerate(representatives):
            sim = cosine(vector, vectors[rep])
            if sim >= best_sim:
                best_sim = sim
                best_cluster = cluster_index
        if best_cluster == -1:
            representatives.append(i)
            clusters.append([i])
        else:
            clusters[best_cluster].append(i)

    return clusters
