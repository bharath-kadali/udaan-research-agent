import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineLedger } from "./PipelineLedger.js";

describe("PipelineLedger", () => {
  it("shows phase status labels", () => {
    render(
      <PipelineLedger
        statuses={{ 1: "done", 2: "active", 3: "pending" }}
        details={{ 2: "12 candidates" }}
      />,
    );
    expect(screen.getByText("Query Orchestration")).toBeTruthy();
    expect(screen.getByText("12 candidates")).toBeTruthy();
    expect(screen.getAllByText("done").length).toBeGreaterThan(0);
    expect(screen.getAllByText("active").length).toBeGreaterThan(0);
  });
});
