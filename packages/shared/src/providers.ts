/**
 * Swappable provider interfaces + a registry so concrete implementations plug
 * in during the phase that first needs them (local ↔ free API ↔ paid is a
 * config flip — see STACK.md §4.2). Foundation defines the contracts only.
 *
 * Provider caveat baked in: the Anthropic implementation must NOT send
 * `temperature`/`top_p` (they 400 on Opus 4.8/4.7/Fable 5) — use adaptive
 * thinking. Local/Gemini/Groq use temperature: 0.
 */

import type { Config, EmbeddingProviderName, LLMProviderName, RerankProviderName } from "./config.js";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompleteOptions {
  system?: string;
  /** When set, the provider must constrain output to this JSON Schema. */
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  /** Sampling temperature (local / Gemini / Groq). Omit for Anthropic. */
  temperature?: number;
  /** Nucleus sampling (local / Gemini / Groq). Omit for Anthropic. */
  topP?: number;
  /**
   * Adaptive-thinking control for the Anthropic provider, which must NOT send
   * temperature/top_p (they 400 on Opus 4.8/4.7/Fable 5).
   */
  thinking?: { type: "adaptive" | "disabled" };
}

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: LLMCompleteOptions): Promise<string>;
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export interface RerankResult {
  index: number;
  score: number;
}

export interface RerankProvider {
  rerank(query: string, documents: string[]): Promise<RerankResult[]>;
}

// --- Registries: phases register concrete implementations here ---
type LLMFactory = (config: Config) => LLMProvider;
type EmbeddingFactory = (config: Config) => EmbeddingProvider;
type RerankFactory = (config: Config) => RerankProvider;

const llmRegistry = new Map<LLMProviderName, LLMFactory>();
const embeddingRegistry = new Map<EmbeddingProviderName, EmbeddingFactory>();
const rerankRegistry = new Map<RerankProviderName, RerankFactory>();

export function registerLLMProvider(name: LLMProviderName, factory: LLMFactory): void {
  llmRegistry.set(name, factory);
}
export function registerEmbeddingProvider(name: EmbeddingProviderName, factory: EmbeddingFactory): void {
  embeddingRegistry.set(name, factory);
}
export function registerRerankProvider(name: RerankProviderName, factory: RerankFactory): void {
  rerankRegistry.set(name, factory);
}

function resolve<N, F>(registry: Map<N, F>, name: N, kind: string): F {
  const factory = registry.get(name);
  if (!factory) {
    throw new Error(`No ${kind} provider registered for '${String(name)}'. Register it before use.`);
  }
  return factory;
}

export function createLLMProvider(config: Config): LLMProvider {
  return resolve(llmRegistry, config.providers.llm, "LLM")(config);
}
export function createEmbeddingProvider(config: Config): EmbeddingProvider {
  return resolve(embeddingRegistry, config.providers.embedding, "embedding")(config);
}
export function createRerankProvider(config: Config): RerankProvider {
  return resolve(rerankRegistry, config.providers.rerank, "rerank")(config);
}
