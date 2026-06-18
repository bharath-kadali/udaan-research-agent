/**
 * Lexical Query Compiler (Phase 1 §2.3).
 *
 * Converts isolated sub-concepts into target-specific query abstractions:
 *  - multi-layered Boolean strings (with synonym expansion),
 *  - an OpenAlex filter,
 *  - a Semantic Scholar payload.
 */

import type { Compilations } from "@udaan/contracts";
import type { ExtractedIntent } from "./types.js";

/** Small built-in expansion map; extended over time / via a vocabulary service. */
const SYNONYMS: Record<string, string[]> = {
  "micro-caching": ["ephemeral cache", "tail-latency caching"],
  "p99 tail latency": ["tail latency", "p99 latency", "bounded latency"],
  "distributed stateful architectures": ["distributed system", "stateful architecture"],
};

function expand(concept: string): string[] {
  const extra = SYNONYMS[concept.toLowerCase()] ?? [];
  return [concept, ...extra];
}

function quoteOrGroup(terms: string[]): string {
  return `(${terms.map((t) => `"${t}"`).join(" OR ")})`;
}

export function buildBooleanStandard(concepts: string[]): string {
  return concepts.map((c) => quoteOrGroup(expand(c))).join(" AND ");
}

export function buildOpenAlexFilter(
  concepts: string[],
  temporalBounds: ExtractedIntent["temporalBounds"],
): string {
  const search = concepts.map((c) => quoteOrGroup(expand(c))).join(" AND ");
  let filter = `default.search:${search}`;
  if (temporalBounds?.startYear) {
    filter += `,from_publication_date:${temporalBounds.startYear}-01-01`;
  }
  if (temporalBounds?.endYear) {
    filter += `,to_publication_date:${temporalBounds.endYear}-12-31`;
  }
  return filter;
}

export function buildSemanticScholarPayload(
  concepts: string[],
  originalQuery: string,
): Record<string, unknown> {
  return {
    query: concepts.length > 0 ? concepts.join(" ") : originalQuery,
    fields: ["title", "abstract", "year", "citationCount", "externalIds"],
  };
}

export function buildCompilations(intent: ExtractedIntent, originalQuery: string): Compilations {
  return {
    booleanStandard: buildBooleanStandard(intent.coreConcepts),
    openAlexFilter: buildOpenAlexFilter(intent.coreConcepts, intent.temporalBounds),
    semanticScholarPayload: buildSemanticScholarPayload(intent.coreConcepts, originalQuery),
  };
}
