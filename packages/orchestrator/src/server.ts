/**
 * Thin HTTP API for the orchestrator. Runs the pipeline in-process and streams
 * per-phase progress over SSE. Non-health routes require an API key when
 * ORCHESTRATOR_API_KEY is configured. Completed jobs are evicted after TTL.
 */

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { ResolutionManifestEntry } from "@udaan/contracts";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { loadConfig, type OrchestratorApiConfig } from "@udaan/shared";
import { S3ObjectStore, storageKey, type ObjectStore } from "./phases/full-text-resolution/index.js";
import { buildPipelineDeps } from "./pipeline/index.js";
import { runPipeline, type PipelineResult, type ProgressEvent } from "./pipeline/runPipeline.js";

interface Job {
  projectId: string;
  events: ProgressEvent[];
  paywalled: ResolutionManifestEntry[];
  result?: PipelineResult;
  error?: string;
  done: boolean;
  completedAt?: number;
}

export interface ServerOptions {
  store?: ObjectStore;
  /** Override orchestrator API settings (tests). Pass apiKey: null to disable auth. */
  orchestrator?: Partial<OrchestratorApiConfig> & { apiKey?: string | null };
}

function resolveApiKey(
  configured: OrchestratorApiConfig,
  override?: Partial<OrchestratorApiConfig> & { apiKey?: string | null },
): string | undefined {
  if (override && "apiKey" in override) {
    return override.apiKey ?? undefined;
  }
  return configured.apiKey;
}

function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : undefined;
}

function isAuthorized(req: FastifyRequest, apiKey: string | undefined): boolean {
  if (!apiKey) return true;
  const headerKey = req.headers["x-api-key"];
  const fromHeader = typeof headerKey === "string" ? headerKey : undefined;
  const fromBearer = extractBearerToken(req.headers.authorization);
  return fromHeader === apiKey || fromBearer === apiKey;
}

export function buildServer(options: ServerOptions = {}): FastifyInstance {
  const config = loadConfig();
  const apiConfig: OrchestratorApiConfig = { ...config.orchestrator, ...options.orchestrator };
  const apiKey = resolveApiKey(config.orchestrator, options.orchestrator);

  const app = Fastify({
    logger: false,
    bodyLimit: apiConfig.maxBodyBytes,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  });
  const jobs = new Map<string, Job>();

  let store = options.store ?? null;
  const getStore = (): ObjectStore => {
    if (!store) store = new S3ObjectStore(config.s3);
    return store;
  };

  function evictExpiredJobs(): void {
    const cutoff = Date.now() - apiConfig.jobTtlMs;
    for (const [id, job] of jobs) {
      if (job.done && job.completedAt !== undefined && job.completedAt < cutoff) {
        jobs.delete(id);
      }
    }
  }

  function inFlightCount(): number {
    let n = 0;
    for (const job of jobs.values()) {
      if (!job.done) n++;
    }
    return n;
  }

  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/health" || req.url.startsWith("/health?")) return;
    if (!isAuthorized(req, apiKey)) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  function startJob(query: string, projectId: string, userId: string): string {
    evictExpiredJobs();
    const id = randomUUID();
    const job: Job = { projectId, events: [], paywalled: [], done: false };
    jobs.set(id, job);

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
        job.completedAt = Date.now();
      });

    return id;
  }

  app.get("/health", async () => ({ status: "ok" }));

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
      if (inFlightCount() >= apiConfig.maxConcurrentJobs) {
        return reply.code(429).send({ error: "too many in-flight jobs" });
      }
      const { query, projectId = `proj_${randomUUID().slice(0, 8)}`, userId = "anonymous" } = req.body ?? {};
      const jobId = startJob(query, projectId, userId);
      return reply.code(202).send({ jobId, projectId });
    },
  );

  app.get<{ Params: { id: string } }>("/research/:id", async (req, reply) => {
    const job = jobs.get(req.params.id);
    if (!job) return reply.code(404).send({ error: "not found" });
    return {
      done: job.done,
      projectId: job.projectId,
      events: job.events,
      paywalled: job.paywalled,
      result: job.result,
      error: job.error,
    };
  });

  app.get<{ Params: { id: string } }>("/research/:id/stream", (req, reply) => {
    const job = jobs.get(req.params.id);
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
      const approxBytes = Math.floor((pdfBase64.length * 3) / 4);
      if (approxBytes > apiConfig.maxUploadBytes) {
        return reply.code(413).send({ error: "upload too large" });
      }
      const bytes = new Uint8Array(Buffer.from(pdfBase64, "base64"));
      if (bytes.length > apiConfig.maxUploadBytes) {
        return reply.code(413).send({ error: "upload too large" });
      }
      if (bytes.length < 5 || !(bytes[0] === 0x25 && bytes[1] === 0x50)) {
        return reply.code(415).send({ error: "not a PDF" });
      }
      const pointer = await getStore().put(storageKey(doi, internalId), bytes, "application/pdf");
      return { stored: true, pointer };
    },
  );

  /** Test helper: inspect/evict the in-memory job store. */
  app.decorate("jobStoreSize", () => jobs.size);

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
