/**
 * BullMQ queue + worker — the durable, horizontally-scalable execution path.
 * The worker body is the same `runPipeline` the in-process API uses, so there
 * is one source of truth for the pipeline. Requires Redis (the API's in-process
 * path needs no Redis; this is the scale path).
 *
 * Run a worker:  pnpm --filter @udaan/orchestrator worker
 * Enqueue:       enqueueResearch(createResearchQueue(redisUrl), request)
 */

import type { Config } from "@udaan/shared";
import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";
import type { ResearchQueryRequest } from "../phases/query-orchestration/index.js";
import { buildPipelineDeps } from "./index.js";
import { runPipeline, type PipelineResult } from "./runPipeline.js";

export const RESEARCH_QUEUE = "udaan:research";

/** Parse a redis:// URL into options BullMQ uses to build its own connection
 *  (avoids passing our ioredis instance, which can differ in version). */
function connection(redisUrl: string): ConnectionOptions {
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

export function createResearchQueue(redisUrl: string): Queue<ResearchQueryRequest, PipelineResult> {
  return new Queue(RESEARCH_QUEUE, { connection: connection(redisUrl) });
}

export function enqueueResearch(
  queue: Queue<ResearchQueryRequest, PipelineResult>,
  request: ResearchQueryRequest,
): Promise<Job<ResearchQueryRequest, PipelineResult>> {
  return queue.add("research", request);
}

export function createResearchWorker(
  redisUrl: string,
  config: Config,
): Worker<ResearchQueryRequest, PipelineResult> {
  return new Worker<ResearchQueryRequest, PipelineResult>(
    RESEARCH_QUEUE,
    async (job) => {
      const deps = buildPipelineDeps(config, {
        // Stream per-phase progress onto the job (readable via job.progress).
        onProgress: (event) => {
          void job.updateProgress(event);
        },
      });
      return runPipeline(job.data, deps);
    },
    { connection: connection(redisUrl), concurrency: 2 },
  );
}
