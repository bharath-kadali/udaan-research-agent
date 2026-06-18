import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaywallUploads } from "./PaywallUploads.js";

describe("PaywallUploads", () => {
  it("lists paywalled papers with upload controls", () => {
    render(
      <PaywallUploads
        entries={[
          {
            internalId: "p1",
            doi: "10.1/x",
            status: "PAYWALLED",
            storagePointer: null,
            metadataSnapshot: { title: "Closed Access Paper" },
          },
        ]}
      />,
    );
    expect(screen.getByText("Closed Access Paper")).toBeTruthy();
    expect(screen.getByText("Upload PDF")).toBeTruthy();
  });
});
