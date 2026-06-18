import { describe, expect, it } from "vitest";
import { buildBooleanStandard, buildCompilations } from "./compiler.js";

describe("buildBooleanStandard", () => {
  it("expands known synonyms and ANDs concept groups", () => {
    const out = buildBooleanStandard(["micro-caching", "p99 tail latency"]);
    expect(out).toContain('"micro-caching"');
    expect(out).toContain('"ephemeral cache"');
    expect(out).toContain(" AND ");
    expect(out).toContain(" OR ");
  });
});

describe("buildCompilations", () => {
  it("emits a temporal filter when a start year is present", () => {
    const c = buildCompilations(
      { coreConcepts: ["micro-caching"], temporalBounds: { startYear: 2022 }, degraded: false },
      "micro-caching latency",
    );
    expect(c.openAlexFilter).toContain("from_publication_date:2022-01-01");
    expect((c.semanticScholarPayload as { query: string }).query).toBe("micro-caching");
  });

  it("omits the temporal filter when no bounds are present", () => {
    const c = buildCompilations(
      { coreConcepts: ["caching"], temporalBounds: null, degraded: false },
      "caching",
    );
    expect(c.openAlexFilter).not.toContain("publication_date");
  });
});
