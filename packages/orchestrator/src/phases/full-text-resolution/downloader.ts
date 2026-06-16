/**
 * Download + sanitize + store one PDF (Phase 4 §2.2, §4.1).
 *
 * Reads the response, traps HTML (paywall) by content-type, verifies the PDF
 * magic number, then writes to object storage. (Production streams via S3
 * multipart; buffering is adequate for the ≤20-paper JIT batch.)
 */

import type { ResolutionStatus } from "@udaan/contracts";
import { hasPdfMagic, isHtmlContentType } from "./sanitize.js";
import type { FetchLike, ObjectStore } from "./types.js";

export interface DownloadOutcome {
  status: ResolutionStatus;
  pointer: string | null;
}

export async function downloadAndStore(
  url: string,
  key: string,
  store: ObjectStore,
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<DownloadOutcome> {
  const res = await fetchImpl(url, { signal });
  if (!res.ok) return { status: "FAILED_CORRUPTED", pointer: null };

  if (isHtmlContentType(res.headers.get("content-type"))) {
    return { status: "PAYWALLED", pointer: null };
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!hasPdfMagic(bytes)) return { status: "FAILED_CORRUPTED", pointer: null };

  const pointer = await store.put(key, bytes, "application/pdf");
  return { status: "RESOLVED_DOWNLOAD", pointer };
}
