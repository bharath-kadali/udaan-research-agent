/**
 * Thin HTTP API for the orchestrator. Enqueues research jobs on BullMQ by default
 * and streams per-phase progress over SSE via QueueEvents. Paywalled papers are
 * surfaced for manual upload to the vault. Set PIPELINE_MODE=inprocess to run
 * inline without Redis (local dev fallback only).
 */

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { ResolutionManifestEntry } from "@udaan/contracts";
import { QueueEvents, type Queue } from "bullmq";
import Fastify, { type FastifyInstance } from "fastify";
import { loadConfig } from "@udaan/shared";
import { S3ObjectStore, storageKey, type ObjectStore } from "./phases/full-text-resolution/index.js";
import { buildPipelineDeps } from "./pipeline/index.js";
import {
  createResearchQueue,
  enqueueResearch,
  connection,
  RESEARCH_QUEUE,
  type ResearchJobResult,
} from "./pipeline/queue.js";
import { runPipeline, type PipelineResult, type ProgressEvent } from "./pipeline/runPipeline.js";

type PipelineMode = "queue" | "inprocess";

interface InProcessJob {
  projectId: string;
  events: ProgressEvent[];
  paywalled: ResolutionManifestEntry[];
  result?: PipelineResult;
  error?: string;
  done: boolean;
}

export interface ServerOptions {
  /** Inject an object store (tests/no-infra); defaults to S3/MinIO from config. */
  store?: ObjectStore;
  /** Inject a queue (tests); created from config when omitted in queue mode. */
  queue?: Queue;
  /** Override pipeline execution mode. Default: queue unless PIPELINE_MODE=inprocess. */
  pipelineMode?: PipelineMode;
}

function resolvePipelineMode(override?: PipelineMode): PipelineMode {
  if (override) return override;
  return process.env.PIPELINE_MODE === "inprocess" ? "inprocess" : "queue";
}

function parseProgressPayload(data: unknown): ProgressEvent | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as { kind?: string; event?: ProgressEvent };
  if (payload.kind === "phase" && payload.event) return payload.event;
  // Back-compat: worker may emit a bare ProgressEvent.
  if ("phase" in payload && "name" in payload && "status" in payload) {
    return payload as ProgressEvent;
  }
  return null;
}

function parsePaywalledPayload(data: unknown): ResolutionManifestEntry[] | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as { kind?: string; entries?: ResolutionManifestEntry[] };
  if (payload.kind === "paywalled" && Array.isArray(payload.entries)) return payload.entries;
  return null;
}

export function buildServer(options: ServerOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: false,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  });

  const config = loadConfig();
  const mode = resolvePipelineMode(options.pipelineMode);
  const inProcessJobs = new Map<string, InProcessJob>();

  let store = options.store ?? null;
  const getStore = (): ObjectStore => {
    if (!store) store = new S3ObjectStore(config.s3);
    return store;
  };

  let queue = options.queue ?? null;
  const getQueue = (): Queue => {
    if (!queue) queue = createResearchQueue(config.redisUrl);
    return queue;
  };

  async function readQueueJob(jobId: string): Promise<{
    done: boolean;
    projectId?: string;
    events: ProgressEvent[];
    paywalled: ResolutionManifestEntry[];
    result?: PipelineResult;
    error?: string;
  } | null> {
    const job = await getQueue().getJob(jobId);
    if (!job) return null;

    const events: ProgressEvent[] = [];
    let paywalled: ResolutionManifestEntry[] = [];
    const progressLog = Array.isArray(job.progress) ? job.progress : job.progress ? [job.progress] : [];
    for (const entry of progressLog) {
      const phase = parseProgressPayload(entry);
      if (phase) events.push(phase);
      const pw = parsePaywalledPayload(entry);
      if (pw) paywalled = pw;
    }

    const state = await job.getState();
    const done = state === "completed" || state === "failed";
    const returnValue = job.returnvalue as ResearchJobResult | PipelineResult | undefined;

    if (returnValue && "pipeline" in returnValue) {
      paywalled = returnValue.paywalled.length > 0 ? returnValue.paywalled : paywalled;
      return {
        done,
        projectId: job.data.projectId,
        events,
        paywalled,
        result: returnValue.pipeline,
        error: state === "failed" ? job.failedReason : undefined,
      };
    }

    return {
      done,
      projectId: job.data.projectId,
      events,
      paywalled,
      result: returnValue as PipelineResult | undefined,
      error: state === "failed" ? job.failedReason : undefined,
    };
  }

  function startInProcessJob(query: string, projectId: string, userId: string): string {
    const id = randomUUID();
    const job: InProcessJob = { projectId, events: [], paywalled: [], done: false };
    inProcessJobs.set(id, job);

    const deps = buildPipelineDeps(config, {
      onProgress: (event) => job.events.push(event),
      onPaywalled: (entries) => {
        job.paywalled = entries;
      },
    });
    const request = { userId, projectId, rawQuery: query, timestamp: new Date().toISOString() };

    runPipeline(request, deps)
      .then((result) => {
        job.result = result;
      })
      .catch((err: unknown) => {
        job.error = err instanceof Error ? err.message : String(err);
      })
      .finally(() => {
        job.done = true;
      });

    return id;
  }

  app.get("/health", async () => ({ status: "ok", pipelineMode: mode }));

  const researchBodySchema = {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: {
      query: { type: "string", minLength: 1 },
      projectId: { type: "string", minLength: 1 },
      userId: { type: "string", minLength: 1 },
    },
  };

  app.post<{ Body: { query: string; projectId?: string; userId?: string } }>(
    "/research",
    { schema: { body: researchBodySchema } },
    async (req, reply) => {
      const { query, projectId = `proj_${randomUUID().slice(0, 8)}`, userId = "anonymous" } = req.body ?? {};
      const request = { userId, projectId, rawQuery: query, timestamp: new Date().toISOString() };

      if (mode === "inprocess") {
        const jobId = startInProcessJob(query, projectId, userId);
        return reply.code(202).send({ jobId, projectId, pipelineMode: mode });
      }

      const bullJob = await enqueueResearch(getQueue(), request);
      return reply.code(202).send({ jobId: bullJob.id, projectId, pipelineMode: mode });
    },
  );

  app.get<{ Params: { id: string } }>("/research/:id", async (req, reply) => {
    if (mode === "inprocess") {
      const job = inProcessJobs.get(req.params.id);
      if (!job) return reply.code(404).send({ error: "not found" });
      return {
        done: job.done,
        projectId: job.projectId,
        events: job.events,
        paywalled: job.paywalled,
        result: job.result,
        error: job.error,
        pipelineMode: mode,
      };
    }

    const job = await readQueueJob(req.params.id);
    if (!job) return reply.code(404).send({ error: "not found" });
    return { ...job, pipelineMode: mode };
  });

  app.get<{ Params: { id: string } }>("/research/:id/stream", async (req, reply) => {
    if (mode === "inprocess") {
      const job = inProcessJobs.get(req.params.id);
      if (!job) {
        reply.code(404).send({ error: "not found" });
        return;
      }
      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      let sent = 0;
      const timer = setInterval(() => {
        while (sent < job.events.length) {
          raw.write(`event: progress\ndata: ${JSON.stringify(job.events[sent])}\n\n`);
          sent++;
        }
        if (job.done) {
          raw.write(`event: result\ndata: ${JSON.stringify(job.result ?? { error: job.error })}\n\n`);
          clearInterval(timer);
          raw.end();
        }
      }, 200);

      req.raw.on("close", () => clearInterval(timer));
      return;
    }

    const jobId = req.params.id;
    const existing = await getQueue().getJob(jobId);
    if (!existing) {
      reply.code(404).send({ error: "not found" });
      return;
    }

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    const sentPhases = new Set<string>();
    let finished = false;

    const queueEvents = new QueueEvents(RESEARCH_QUEUE, {
      connection: connection(config.redisUrl),
    });

    const finish = (payload: unknown) => {
      if (finished) return;
      finished = true;
      raw.write(`event: result\ndata: ${JSON.stringify(payload)}\n\n`);
      clearInterval(poll);
      void queueEvents.close();
      raw.end();
    };

    queueEvents.on("progress", ({ jobId: id, data }) => {
      if (id !== jobId) return;
      const phase = parseProgressPayload(data);
      if (phase) {
        const key = `${phase.phase}:${phase.status}:${phase.detail ?? ""}`;
        if (!sentPhases.has(key)) {
          sentPhases.add(key);
          raw.write(`event: progress\ndata: ${JSON.stringify(phase)}\n\n`);
        }
      }
      const paywalled = parsePaywalledPayload(data);
      if (paywalled && paywalled.length > 0) {
        raw.write(`event: paywalled\ndata: ${JSON.stringify(paywalled)}\n\n`);
      }
    });

    const poll = setInterval(async () => {
      const snapshot = await readQueueJob(jobId);
      if (!snapshot) return;
      for (const event of snapshot.events) {
        const key = `${event.phase}:${event.status}:${event.detail ?? ""}`;
        if (!sentPhases.has(key)) {
          sentPhases.add(key);
          raw.write(`event: progress\ndata: ${JSON.stringify(event)}\n\n`);
        }
      }
      if (snapshot.paywalled.length > 0) {
        raw.write(`event: paywalled\ndata: ${JSON.stringify(snapshot.paywalled)}\n\n`);
      }
      if (snapshot.done) {
        finish(snapshot.result ?? { error: snapshot.error });
      }
    }, 500);

    req.raw.on("close", () => {
      clearInterval(poll);
      void queueEvents.close();
    });
  });

  const uploadBodySchema = {
    type: "object",
    additionalProperties: false,
    required: ["internalId", "pdfBase64"],
    properties: {
      doi: { type: ["string", "null"] },
      internalId: { type: "string", minLength: 1 },
      pdfBase64: { type: "string", minLength: 1 },
    },
  };

  app.post<{ Body: { doi: string | null; internalId: string; pdfBase64: string } }>(
    "/uploads",
    { schema: { body: uploadBodySchema } },
    async (req, reply) => {
      const { doi = null, internalId, pdfBase64 } = req.body ?? {};
      const bytes = new Uint8Array(Buffer.from(pdfBase64, "base64"));
      if (bytes.length < 5 || !(bytes[0] === 0x25 && bytes[1] === 0x50)) {
        return reply.code(415).send({ error: "not a PDF" });
      }
      const pointer = await getStore().put(storageKey(doi, internalId), bytes, "application/pdf");
      return { stored: true, pointer };
    },
  );

  return app;
}

const isMain = (() => {
  try {
    return process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();

if (isMain) {
  const app = buildServer();
  const port = Number(process.env.PORT ?? 8080);
  app.listen({ port, host: process.env.HOST ?? "0.0.0.0" }).then(
    () => console.log(`orchestrator API listening on :${port}`),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
