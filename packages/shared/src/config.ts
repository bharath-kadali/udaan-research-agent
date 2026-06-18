/**
 * 12-factor config loader. Every endpoint/credential/model comes from the
 * environment — no hardcoded `localhost` in code, so deploy is a config change.
 */

export type LLMProviderName = "ollama" | "gemini" | "groq" | "anthropic";
export type EmbeddingProviderName = "local" | "cohere";
export type RerankProviderName = "local" | "cohere";

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

export interface OrchestratorApiConfig {
  /** When set, all non-health routes require Authorization: Bearer <key> or x-api-key. */
  apiKey?: string;
  maxBodyBytes: number;
  maxUploadBytes: number;
  maxConcurrentJobs: number;
  /** Evict completed jobs from the in-memory store after this many ms. */
  jobTtlMs: number;
}

export interface Config {
  qdrantUrl: string;
  redisUrl: string;
  s3: S3Config;
  orchestrator: OrchestratorApiConfig;
  providers: {
    llm: LLMProviderName;
    embedding: EmbeddingProviderName;
    rerank: RerankProviderName;
  };
  ollamaUrl: string;
  models: { llm: string; embedding: string; rerank: string };
  apiKeys: { gemini?: string; groq?: string; anthropic?: string; cohere?: string };
  services: { ranking: string; parsing: string; synthesis: string };
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value === "" ? undefined : value;
}

const LLM_PROVIDERS = ["ollama", "gemini", "groq", "anthropic"] as const;
const EMBEDDING_PROVIDERS = ["local", "cohere"] as const;
const RERANK_PROVIDERS = ["local", "cohere"] as const;

/** Validate an env value against an allowed set instead of blind-casting. */
function parseEnum<T extends string>(name: string, value: string, allowed: readonly T[]): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Invalid ${name}=${value}. Allowed: ${allowed.join(", ")}`);
}

function parsePositiveInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid ${name}=${raw}: must be a positive integer`);
  }
  return n;
}

export function loadConfig(): Config {
  return {
    qdrantUrl: required("QDRANT_URL"),
    redisUrl: required("REDIS_URL"),
    s3: {
      endpoint: required("S3_ENDPOINT"),
      bucket: required("S3_BUCKET"),
      accessKey: required("S3_ACCESS_KEY"),
      secretKey: required("S3_SECRET_KEY"),
      region: optional("S3_REGION") ?? "us-east-1",
    },
    orchestrator: {
      apiKey: optional("ORCHESTRATOR_API_KEY"),
      maxBodyBytes: parsePositiveInt("ORCHESTRATOR_MAX_BODY_BYTES", optional("ORCHESTRATOR_MAX_BODY_BYTES"), 1_048_576),
      maxUploadBytes: parsePositiveInt("ORCHESTRATOR_MAX_UPLOAD_BYTES", optional("ORCHESTRATOR_MAX_UPLOAD_BYTES"), 25_000_000),
      maxConcurrentJobs: parsePositiveInt(
        "ORCHESTRATOR_MAX_CONCURRENT_JOBS",
        optional("ORCHESTRATOR_MAX_CONCURRENT_JOBS"),
        4,
      ),
      jobTtlMs: parsePositiveInt("ORCHESTRATOR_JOB_TTL_MS", optional("ORCHESTRATOR_JOB_TTL_MS"), 3_600_000),
    },
    providers: {
      llm: parseEnum("LLM_PROVIDER", optional("LLM_PROVIDER") ?? "ollama", LLM_PROVIDERS),
      embedding: parseEnum("EMBEDDING_PROVIDER", optional("EMBEDDING_PROVIDER") ?? "local", EMBEDDING_PROVIDERS),
      rerank: parseEnum("RERANK_PROVIDER", optional("RERANK_PROVIDER") ?? "local", RERANK_PROVIDERS),
    },
    ollamaUrl: required("OLLAMA_URL"),
    models: {
      llm: required("LLM_MODEL"),
      embedding: required("EMBEDDING_MODEL"),
      rerank: required("RERANK_MODEL"),
    },
    apiKeys: {
      gemini: optional("GEMINI_API_KEY"),
      groq: optional("GROQ_API_KEY"),
      anthropic: optional("ANTHROPIC_API_KEY"),
      cohere: optional("COHERE_API_KEY"),
    },
    services: {
      ranking: required("RANKING_SERVICE_URL"),
      parsing: required("PARSING_SERVICE_URL"),
      synthesis: required("SYNTHESIS_SERVICE_URL"),
    },
  };
}
