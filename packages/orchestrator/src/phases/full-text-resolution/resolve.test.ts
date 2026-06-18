import { describe, expect, it } from "vitest";
import type { PrioritizedIngestionIndex, RankedPaper } from "@udaan/contracts";
import { runFullTextResolution } from "./resolve.js";
import { InMemoryObjectStore, storageKey } from "./storage.js";
import type { FetchLike } from "./types.js";

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

const paper = (over: Partial<RankedPaper>): RankedPaper => ({
  rank: 1,
  relevanceScore: 0.9,
  internalId: "id",
  doi: null,
  title: "Title",
  abstract: "abstract",
  publicationDate: "2023-01-01",
  ...over,
});

// Routes by URL: arXiv -> PDF, Unpaywall -> no OA, anything else -> html.
const routedFetch: FetchLike = async (url) => {
  if (url.includes("arxiv.org/pdf")) {
    return new Response(pdfBytes, { headers: { "content-type": "application/pdf" } });
  }
  if (url.includes("api.unpaywall.org")) {
    return new Response(JSON.stringify({ best_oa_location: null }), {
      headers: { "content-type": "application/json" },
    });
  }
  return new Response("<html></html>", { headers: { "content-type": "text/html" } });
};

describe("runFullTextResolution", () => {
  it("resolves via cache, arXiv, and flags paywalled papers", async () => {
    const store = new InMemoryObjectStore();
    const cached = paper({ internalId: "cached", doi: "10.1/cached", rank: 1 });
    const arxiv = paper({ internalId: "arxiv", doi: "10.48550/arXiv.2201.1", rank: 2 });
    const paywalled = paper({ internalId: "paywalled", doi: "10.1/closed", rank: 3 });

    // Pre-seed the cache for the first paper (Track A).
    await store.put(storageKey(cached.doi, cached.internalId), pdfBytes, "application/pdf");

    const index: PrioritizedIngestionIndex = {
      projectId: "proj_1",
      totalProcessed: 3,
      totalFiltered: 3,
      rankedManifest: [cached, arxiv, paywalled],
    };

    const result = await runFullTextResolution(index, { store, fetchImpl: routedFetch });

    const byId = Object.fromEntries(result.manifest.map((e) => [e.internalId, e]));
    expect(byId.cached!.status).toBe("RESOLVED_CACHE");
    expect(byId.arxiv!.status).toBe("RESOLVED_DOWNLOAD");
    expect(byId.paywalled!.status).toBe("PAYWALLED");
    expect(result.resolutionSummary).toEqual({
      totalRequested: 3,
      successfullyResolved: 2,
      paywalled: 1,
    });
  });
});
