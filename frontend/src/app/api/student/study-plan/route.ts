import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getActiveStudyPlan,
  generateAdaptiveStudyPlan,
  type PlanHorizon,
} from "@/server/adaptive-study-planner";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const plan = await getActiveStudyPlan(session.user.id);
    return NextResponse.json(plan);
  } catch (error) {
    console.error("Failed to fetch adaptive study plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch adaptive study plan" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: {
      availableMinutesPerDay?: number;
      planningHorizon?: PlanHorizon;
      constraints?: {
        preferredStudyDays?: string[];
        targetRoleSlug?: string;
      };
      forceRecalculate?: boolean;
    } = {};

    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable
    }

    if (
      body.availableMinutesPerDay !== undefined &&
      (typeof body.availableMinutesPerDay !== "number" || body.availableMinutesPerDay <= 0)
    ) {
      return NextResponse.json(
        { error: "Invalid availableMinutesPerDay. Expected positive integer." },
        { status: 400 }
      );
    }

    const plan = await generateAdaptiveStudyPlan(session.user.id, {
      availableMinutesPerDay: body.availableMinutesPerDay,
      planningHorizon: body.planningHorizon,
      constraints: body.constraints,
      forceRecalculate: body.forceRecalculate,
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Failed to generate adaptive study plan:", error);
    return NextResponse.json(
      { error: "Failed to generate adaptive study plan" },
      { status: 500 }
    );
  }
}
