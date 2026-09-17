import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveStudyPlan } from "@/server/adaptive-study-planner";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const plan = await getActiveStudyPlan(session.user.id);
    return NextResponse.json({
      planId: plan.id,
      planVersion: plan.planVersion,
      availableMinutesPerDay: plan.availableMinutesPerDay,
      hasBudgetSet: plan.hasBudgetSet,
      todaySchedule: plan.todaySchedule,
      emptyState: plan.emptyState,
    });
  } catch (error) {
    console.error("Failed to fetch today study plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch today study plan" },
      { status: 500 }
    );
  }
}
