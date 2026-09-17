import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recalculateStudyPlan } from "@/server/adaptive-study-planner";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let reason = "Manual plan recalibration";
    try {
      const body = await request.json();
      if (body.reason && typeof body.reason === "string") {
        reason = body.reason;
      }
    } catch {
      // Empty body is acceptable
    }

    const plan = await recalculateStudyPlan(session.user.id, reason);
    return NextResponse.json(plan);
  } catch (error) {
    console.error("Failed to recalculate study plan:", error);
    return NextResponse.json(
      { error: "Failed to recalculate study plan" },
      { status: 500 }
    );
  }
}
