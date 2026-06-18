import { describe, expect, it, vi } from "vitest";
import type { ResearchQueryRequest } from "../phases/query-orchestration/index.js";
import { enqueueResearch, type ResearchJobResult } from "./queue.js";

describe("BullMQ research queue", () => {
  it("enqueueResearch adds a job to the queue", async () => {
    const add = vi.fn().mockResolvedValue({ id: "job-1", data: { projectId: "p1" } });
    const queue = { add } as unknown as Parameters<typeof enqueueResearch>[0];

    const request: ResearchQueryRequest = {
      userId: "u1",
      projectId: "p1",
      rawQuery: "graph neural networks",
      timestamp: new Date().toISOString(),
    };

    const job = await enqueueResearch(queue, request);
    expect(add).toHaveBeenCalledWith("research", request);
    expect(job.id).toBe("job-1");
  });

  it("ResearchJobResult wraps pipeline output and paywalled entries", () => {
    const result: ResearchJobResult = {
      pipeline: { status: "rejected", reason: "QUERY_TOO_SHORT" },
      paywalled: [],
    };
    expect(result.pipeline.status).toBe("rejected");
    expect(result.paywalled).toEqual([]);
  });
});
