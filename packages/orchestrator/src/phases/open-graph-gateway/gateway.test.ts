import { describe, expect, it } from "vitest";
import type { CandidatePaper, CompiledDiscoveryManifest } from "@udaan/contracts";
import { runGateway } from "./gateway.js";
import type { OpenGraphProvider } from "./types.js";

const manifest: CompiledDiscoveryManifest = {
  projectId: "p",
  searchContext: { originalQuery: "q", temporalBounds: null, coreConcepts: ["q"] },
  compilations: { booleanStandard: "q" },
  telemetry: {},
};

const paper = (over: Partial<CandidatePaper>): CandidatePaper => ({
  internalId: Math.random().toString(36).slice(2),
  doi: null,
  title: "Title",
  abstract: "an abstract long enough to survive the validation drop heuristic",
  authors: ["Smith, J."],
  publicationDate: "2023-01-01",
  citationCount: 0,
  sourceProviders: ["X"],
  sourceUrls: [],
  ...over,
});

const adapter = (name: string, records: CandidatePaper[]): OpenGraphProvider => ({
  name,
  search: async () => records,
});

describe("runGateway", () => {
  it("merges duplicates across providers, drops invalid, and sorts by citations", async () => {
    const a = adapter("A", [
      paper({ doi: "10.1/x", citationCount: 5, sourceProviders: ["A"] }),
      paper({ title: "bad", abstract: "tooshort" }), // dropped
    ]);
    const b = adapter("B", [
      paper({ doi: "10.1/x", citationCount: 12, sourceProviders: ["B"] }),
      paper({ doi: "10.1/y", citationCount: 3 }),
    ]);

    const { candidates, providerResults } = await runGateway(manifest, { adapters: [a, b] });

    expect(providerResults).toHaveLength(2);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.citationCount).toBe(12); // merged, highest first
    expect(candidates[0]!.sourceProviders.sort()).toEqual(["A", "B"]);
    expect(candidates[1]!.doi).toBe("10.1/y");
  });

  it("still returns results when one provider fails", async () => {
    const ok = adapter("OK", [paper({ doi: "10.1/z", citationCount: 1 })]);
    const broken: OpenGraphProvider = {
      name: "BROKEN",
      search: async () => {
        throw new Error("down");
      },
    };
    const { candidates } = await runGateway(manifest, { adapters: [ok, broken], timeoutMs: 1000 });
    expect(candidates).toHaveLength(1);
  });
});
