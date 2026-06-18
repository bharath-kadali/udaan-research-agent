/**
 * Standalone BullMQ worker process. Pulls research jobs off Redis and runs the
 * full pipeline. Scale by running more of these.
 *
 *   pnpm --filter @udaan/orchestrator worker
 */

import { loadConfig } from "@udaan/shared";
import { createResearchWorker } from "./pipeline/queue.js";

const config = loadConfig();
const worker = createResearchWorker(config.redisUrl, config);

worker.on("completed", (job) => console.log(`[worker] completed ${job.id}`));
worker.on("failed", (job, err) => console.error(`[worker] failed ${job?.id}:`, err.message));

console.log(`[worker] research worker started (queue: udaan:research, redis: ${config.redisUrl})`);
