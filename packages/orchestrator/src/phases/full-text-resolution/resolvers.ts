/**
 * Multi-track resolvers (Phase 4 §2.1). Cache is checked by the entrypoint
 * (Track A); here are Track B (direct arXiv) and Track C (Unpaywall).
 */

import type { FetchLike } from "./types.js";

/** Track B: construct the direct arXiv PDF URL from an arXiv DOI. */
export function resolveArxiv(doi: string | null): string | null {
  if (!doi) return null;
  const match = doi.toLowerCase().match(/^10\.48550\/arxiv\.(.+)$/);
  return match ? `https://arxiv.org/pdf/${match[1]}.pdf` : null;
}

interface UnpaywallResponse {
  best_oa_location?: { url_for_pdf?: string | null; url?: string | null } | null;
}

/** Track C: query Unpaywall for an open-access location. */
export async function resolveUnpaywall(
  doi: string | null,
  email: string,
  fetchImpl: FetchLike,
): Promise<string | null> {
  if (!doi) return null;
  const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`;
  const res = await fetchImpl(url);
  if (!res.ok) return null;
  const data = (await res.json()) as UnpaywallResponse;
  return data.best_oa_location?.url_for_pdf ?? data.best_oa_location?.url ?? null;
}
