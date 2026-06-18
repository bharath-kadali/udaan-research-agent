"""Swappable provider interfaces + registry (Python mirror of
packages/shared/src/providers.ts).

Concrete implementations register in the phase that first needs them. The
Anthropic LLM implementation must NOT send ``temperature``/``top_p`` (they 400
on Opus 4.8/4.7/Fable 5) — use adaptive thinking; local/Gemini/Groq use
temperature 0.
"""

from __future__ import annotations

from typing import Callable, Protocol

from .config import Config


class LLMProvider(Protocol):
    def complete(
        self,
        messages: list[dict[str, str]],
        *,
        system: str | None = None,
        json_schema: dict | None = None,
        max_tokens: int | None = None,
    ) -> str: ...


class EmbeddingProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class RerankProvider(Protocol):
    def rerank(self, query: str, documents: list[str]) -> list[tuple[int, float]]: ...


_llm_registry: dict[str, Callable[[Config], LLMProvider]] = {}
_embedding_registry: dict[str, Callable[[Config], EmbeddingProvider]] = {}
_rerank_registry: dict[str, Callable[[Config], RerankProvider]] = {}


def register_llm_provider(name: str, factory: Callable[[Config], LLMProvider]) -> None:
    _llm_registry[name] = factory


def register_embedding_provider(name: str, factory: Callable[[Config], EmbeddingProvider]) -> None:
    _embedding_registry[name] = factory


def register_rerank_provider(name: str, factory: Callable[[Config], RerankProvider]) -> None:
    _rerank_registry[name] = factory


def _resolve(registry: dict, name: str, kind: str):
    factory = registry.get(name)
    if factory is None:
        raise RuntimeError(f"No {kind} provider registered for '{name}'. Register it before use.")
    return factory


def create_llm_provider(config: Config) -> LLMProvider:
    return _resolve(_llm_registry, config.llm_provider, "LLM")(config)


def create_embedding_provider(config: Config) -> EmbeddingProvider:
    return _resolve(_embedding_registry, config.embedding_provider, "embedding")(config)


def create_rerank_provider(config: Config) -> RerankProvider:
    return _resolve(_rerank_registry, config.rerank_provider, "rerank")(config)
