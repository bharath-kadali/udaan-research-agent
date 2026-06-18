import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Brief } from "./Brief.js";
import type { ResearchBrief } from "../types.js";

const sampleBrief: ResearchBrief = {
  projectId: "p1",
  metadata: { totalClaims: 2, sectionsGenerated: 1, degraded: false, degradedStages: [] },
  sections: [{ heading: "Consensus", bodyText: "Evidence supports the hypothesis [1] and [2]." }],
  bibliography: {
    "1": { claimId: "c1", doi: "10.1/a", text: "Quote one" },
    "2": { claimId: "c2", doi: null, text: "Quote two" },
  },
};

describe("Brief", () => {
  it("renders citation anchors that link to bibliography entries", () => {
    render(<Brief brief={sampleBrief} />);
    const cite = screen.getByRole("link", { name: "Source 1" });
    expect(cite.getAttribute("href")).toBe("#ref-1");
    expect(screen.getByText("Quote one")).toBeTruthy();
  });
});
