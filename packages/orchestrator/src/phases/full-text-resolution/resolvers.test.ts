import { describe, expect, it } from "vitest";
import { resolveArxiv, resolveUnpaywall } from "./resolvers.js";
import type { FetchLike } from "./types.js";

describe("resolveArxiv", () => {
  it("builds the direct PDF URL for an arXiv DOI", () => {
    expect(resolveArxiv("10.48550/arXiv.2201.00001")).toBe("https://arxiv.org/pdf/2201.00001.pdf");
  });
  it("returns null for non-arXiv or missing DOIs", () => {
    expect(resolveArxiv("10.1145/3618257")).toBeNull();
    expect(resolveArxiv(null)).toBeNull();
  });
});

describe("resolveUnpaywall", () => {
  it("returns the best OA PDF URL", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(JSON.stringify({ best_oa_location: { url_for_pdf: "https://oa.example/p.pdf" } }), {
        headers: { "content-type": "application/json" },
      });
    expect(await resolveUnpaywall("10.1/x", "e@e.com", fetchImpl)).toBe("https://oa.example/p.pdf");
  });

  it("returns null when there is no OA location", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(JSON.stringify({ best_oa_location: null }), {
        headers: { "content-type": "application/json" },
      });
    expect(await resolveUnpaywall("10.1/x", "e@e.com", fetchImpl)).toBeNull();
  });
});
