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

export interface Config {
  qdrantUrl: string;
  redisUrl: string;
  s3: S3Config;
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
    providers: {
      llm: (optional("LLM_PROVIDER") ?? "ollama") as LLMProviderName,
      embedding: (optional("EMBEDDING_PROVIDER") ?? "local") as EmbeddingProviderName,
      rerank: (optional("RERANK_PROVIDER") ?? "local") as RerankProviderName,
    },
    ollamaUrl: optional("OLLAMA_URL") ?? "http://localhost:11434",
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
