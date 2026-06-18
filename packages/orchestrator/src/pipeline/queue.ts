/**
 * BullMQ queue + worker — the durable, horizontally-scalable execution path.
 * The worker body is the same `runPipeline` the in-process API uses, so there
 * is one source of truth for the pipeline. Requires Redis (the API's in-process
 * path needs no Redis; this is the scale path).
 *
 * Run a worker:  pnpm --filter @udaan/orchestrator worker
 * Enqueue:       enqueueResearch(createResearchQueue(redisUrl), request)
 */

import type { ResolutionManifestEntry } from "@udaan/contracts";
import type { Config } from "@udaan/shared";
import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";
import type { ResearchQueryRequest } from "../phases/query-orchestration/index.js";
import { buildPipelineDeps } from "./index.js";
import { runPipeline, type PipelineResult, type ProgressEvent } from "./runPipeline.js";

export const RESEARCH_QUEUE = "udaan:research";

export interface ResearchJobResult {
  pipeline: PipelineResult;
  paywalled: ResolutionManifestEntry[];
}

/** Parse a redis:// URL into options BullMQ uses to build its own connection
 *  (avoids passing our ioredis instance, which can differ in version). */
export function connection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {}),
    ...(url.username ? { username: url.username } : {}),
    ...(url.pathname.length > 1 ? { db: Number(url.pathname.slice(1)) } : {}),
    // BullMQ requires this for blocking commands.
    maxRetriesPerRequest: null,
  };
}

export function createResearchQueue(redisUrl: string): Queue<ResearchQueryRequest, ResearchJobResult> {
  return new Queue(RESEARCH_QUEUE, { connection: connection(redisUrl) });
}

export function enqueueResearch(
  queue: Queue<ResearchQueryRequest, ResearchJobResult>,
  request: ResearchQueryRequest,
): Promise<Job<ResearchQueryRequest, ResearchJobResult>> {
  return queue.add("research", request);
}

export function createResearchWorker(
  redisUrl: string,
  config: Config,
): Worker<ResearchQueryRequest, ResearchJobResult> {
  return new Worker<ResearchQueryRequest, ResearchJobResult>(
    RESEARCH_QUEUE,
    async (job) => {
      let paywalled: ResolutionManifestEntry[] = [];
      const deps = buildPipelineDeps(config, {
        onProgress: (event: ProgressEvent) => {
          void job.updateProgress({ kind: "phase", event });
        },
        onPaywalled: (entries) => {
          paywalled = entries;
          void job.updateProgress({ kind: "paywalled", entries });
        },
      });
      const pipeline = await runPipeline(job.data, deps);
      return { pipeline, paywalled };
    },
    { connection: connection(redisUrl), concurrency: 2 },
  );
}
