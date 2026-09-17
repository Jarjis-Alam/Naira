import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUpcomingApplicationEvents } from "@/server/application-intelligence";

export const runtime = "nodejs";

/**
 * Phase 19 — upcoming-events calendar (application-derived only).
 *
 * GET /api/student/applications/calendar?withinDays=14
 * Returns interview/assessment/deadline events actually stored on the
 * student's active applications, sorted ascending by event time.
 * Never synthesized; only what the student recorded.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = new URL(req.url).searchParams.get("withinDays");
  const withinDays = raw === null ? 14 : Number.parseInt(raw, 10);
  if (!Number.isFinite(withinDays) || withinDays < 1 || withinDays > 365) {
    return NextResponse.json(
      { error: "withinDays must be between 1 and 365" },
      { status: 400 }
    );
  }

  try {
    const upcoming = await getUpcomingApplicationEvents(
      session.user.id,
      withinDays
    );
    return NextResponse.json({ upcoming });
  } catch (error) {
    console.error("[applications/calendar] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to load upcoming events" },
      { status: 500 }
    );
  }
}
