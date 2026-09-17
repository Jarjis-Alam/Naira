import { NextResponse } from "next/server";

/**
 * Map service-layer failures to HTTP responses for the application APIs,
 * mirroring the resume API conventions: ownership failures are 403 (never
 * 404, so probing cannot distinguish "not yours" from "does not exist"),
 * validation failures are 400, and anything unexpected is a generic 500.
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
    /is required|are required|required|required\.|invalid|must|cannot|already|allowed:|no changes|does not exist|catalog/i.test(
      message
    );

  if (isClientError) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.error(`[applications-api] ${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export function validationError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
