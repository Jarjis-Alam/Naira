/**
 * Test-only helpers for Phase 18 extraction classification.
 *
 * The real extraction functions are exercised with real documents elsewhere in
 * the suite; this module exists for the one thing a real document cannot do:
 * reproduce a specific historical server-side failure (the pdfjs fake-worker
 * bug) to prove the CURRENT classifier distinguishes engine failures from
 * corrupt documents. It contains no parsing logic and cannot weaken production
 * behaviour — it only exposes `isPdfEngineFailure` through a typed shape for
 * the regression assertion.
 */

import { isPdfEngineFailure } from "./text-extraction";
import type { ResumeExtraction } from "./types";

/**
 * The classification the current parser produces for the historical pdfjs
 * worker-resolution failure. Asserted so that classification can never regress
 * back to blaming the document.
 */
export function engineFailureExtraction(): ResumeExtraction {
  return {
    ok: false,
    format: "pdf",
    rawText: "",
    warnings: [],
    error: {
      code: isPdfEngineFailure(
        "Setting up fake worker failed: Cannot find module '.next/dev/server/chunks/pdfw...'"
      )
        ? "engine_unavailable"
        : "corrupt",
      message: "The PDF engine could not start on this server.",
    },
    signals: null,
  };
}
