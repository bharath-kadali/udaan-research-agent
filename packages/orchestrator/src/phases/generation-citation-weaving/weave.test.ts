import { describe, expect, it } from "vitest";
import type { SynthesisGraph } from "@udaan/contracts";
import type { LLMProvider } from "@udaan/shared";
import { runGeneration } from "./weave.js";

// Stub returns tagged text plus one unsupported (untagged) sentence that the
// hallucination filter must drop.
const stubLLM: LLMProvider = {
  complete: async () =>
    "There is disagreement on micro-caching latency [cl_a]. " +
    "Others report increases under memory pressure [cl_b]. " +
    "This unsupported sentence has no citation and must be dropped.",
};

const graph: SynthesisGraph = {
  projectId: "proj_1",
  synthesisGraph: [
    {
      clusterId: "cluster_01",
      generatedTopicLabel: "Micro-caching latency",
      polarity: "CONTRADICTION",
      claims: [
        { claimId: "cl_a", doi: "10.1/a", text: "micro-caching reduced p99 latency by 40%" },
        { claimId: "cl_b", doi: "10.1/b", text: "micro-caching increased p99 latency by 15%" },
      ],
    },
  ],
};

describe("runGeneration", () => {
  it("produces a sourced brief with woven citations and no raw claim tags", async () => {
    const brief = await runGeneration(graph, { llm: stubLLM });

    expect(brief.projectId).toBe("proj_1");
    expect(brief.metadata.totalClaims).toBe(2);

    // Executive summary first, then the themed section.
    expect(brief.sections[0]!.heading).toBe("Executive Summary");
    expect(brief.sections.some((s) => s.heading === "Conflicts in the Literature")).toBe(true);

    const allBody = brief.sections.map((s) => s.bodyText).join(" ");
    expect(allBody).not.toContain("[cl_"); // raw tags replaced
    expect(allBody).not.toContain("unsupported sentence"); // hallucination dropped
    expect(allBody).toContain("[1]");

    expect(brief.bibliography["1"]!.claimId).toBe("cl_a");
    expect(brief.bibliography["2"]!.claimId).toBe("cl_b");
  });
});
