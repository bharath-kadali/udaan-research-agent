import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CompiledDiscoveryManifest } from "@udaan/contracts";
import { describe, expect, it, vi } from "vitest";
import { CrossrefAdapter } from "./crossref.js";
import { OpenAlexAdapter } from "./openalex.js";
import { SemanticScholarAdapter } from "./semantic-scholar.js";

const here = dirname(fileURLToPath(import.meta.url));

const manifest: CompiledDiscoveryManifest = {
  projectId: "proj_test",
  searchContext: { originalQuery: "graph neural networks", coreConcepts: ["GNN", "drug discovery"] },
  compilations: {
    booleanStandard: "GNN AND drug",
    openAlexFilter: "title.search:neural",
    semanticScholarPayload: { query: "graph neural networks" },
  },
};

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));
}

describe("adapter response mapping", () => {
  it("maps OpenAlex works to CandidatePaper", async () => {
    const adapter = new OpenAlexAdapter("https://api.openalex.org");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(loadFixture("openalex-response.json")), { status: 200 }),
    );
    const papers = await adapter.search(manifest);
    expect(papers).toHaveLength(1);
    expect(papers[0]?.doi).toBe("10.1234/example");
    expect(papers[0]?.title).toContain("Graph Neural Networks");
    expect(papers[0]?.abstract.length).toBeGreaterThanOrEqual(50);
    expect(papers[0]?.authors).toEqual(["A. Researcher"]);
    expect(papers[0]?.publicationDate).toBe("2023-06-15");
    expect(papers[0]?.citationCount).toBe(42);
    expect(papers[0]?.sourceProviders).toEqual(["OpenAlex"]);
  });

  it("maps Crossref items to CandidatePaper", async () => {
    const adapter = new CrossrefAdapter("https://api.crossref.org");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(loadFixture("crossref-response.json")), { status: 200 }),
    );
    const papers = await adapter.search(manifest);
    expect(papers).toHaveLength(1);
    expect(papers[0]?.doi).toBe("10.5678/sample");
    expect(papers[0]?.title).toContain("Crossref Sample Paper");
    expect(papers[0]?.authors[0]).toContain("Smith");
    expect(papers[0]?.publicationDate).toBe("2022-03-10");
    expect(papers[0]?.citationCount).toBe(17);
    expect(papers[0]?.sourceProviders).toEqual(["Crossref"]);
  });

  it("maps Semantic Scholar papers to CandidatePaper", async () => {
    const adapter = new SemanticScholarAdapter("https://api.semanticscholar.org/graph/v1");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(loadFixture("semantic-scholar-response.json")), { status: 200 }),
    );
    const papers = await adapter.search(manifest);
    expect(papers).toHaveLength(1);
    expect(papers[0]?.doi).toBe("10.9999/ss-paper");
    expect(papers[0]?.publicationDate).toBe("2021-01-01");
    expect(papers[0]?.citationCount).toBe(88);
    expect(papers[0]?.sourceProviders).toEqual(["SemanticScholar"]);
  });
});
