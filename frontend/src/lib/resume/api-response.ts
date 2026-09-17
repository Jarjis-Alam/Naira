import { NextResponse } from "next/server";

/**
 * Map service-layer failures to HTTP responses for the resume APIs.
 *
 * Ownership failures surface as 403 (never 404, so a wrong-owner probe cannot
 * distinguish "not yours" from "does not exist"), validation failures as 400,
 * and anything unexpected as a generic 500 so internal details never leak.
 */
export function jsonError(error: unknown, fallback: string): NextResponse {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("Unauthorized") || message.includes("Access denied")) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (/not found/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  const isClientError =
    /could not|not supported|unsupported|corrupt|too large|max|is required|required|invalid|must|minimum|at least|only|paste|cannot|no changes/i.test(
      message
    );

  if (isClientError) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.error(`[resume-api] ${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export function validationError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
