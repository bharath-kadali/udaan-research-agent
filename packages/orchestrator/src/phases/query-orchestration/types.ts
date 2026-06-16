/** Phase 1 — Query Orchestration & Translation: local types. */

/** Incoming request (Phase 1 §3.1). */
export interface ResearchQueryRequest {
  userId: string;
  projectId: string;
  rawQuery: string;
  /** ISO 8601 */
  timestamp: string;
}

/** Result of the ingestion guard. */
export interface GuardResult {
  ok: boolean;
  /** Sanitized + truncated query (present even when ok=false, for logging). */
  sanitized: string;
  reason?: string;
}

/** Structured intent extracted from the raw query (LLM or fallback). */
export interface ExtractedIntent {
  coreConcepts: string[];
  temporalBounds: { startYear?: number; endYear?: number } | null;
  /** Telemetry classification; degraded=true when the regex fallback was used. */
  degraded: boolean;
}
