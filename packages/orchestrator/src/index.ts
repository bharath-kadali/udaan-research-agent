import { registerOllama } from "./providers/ollama.js";

// Register the default local LLM provider on import.
registerOllama();

export * as queryOrchestration from "./phases/query-orchestration/index.js";
export { OllamaLLMProvider, registerOllama } from "./providers/ollama.js";
