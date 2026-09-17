import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDailyExecutionPlan } from "@/server/placement-execution";

export async function GET(request?: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Security barrier: Derive student identity strictly from authenticated server session
  const userId = session.user.id;

  let targetDateStr: string | undefined;
  if (request?.url) {
    try {
      const url = new URL(request.url);
      const dateParam = url.searchParams.get("date");
      if (dateParam) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
          return NextResponse.json(
            { error: "Invalid date format. Expected YYYY-MM-DD" },
            { status: 400 }
          );
        }
        targetDateStr = dateParam;
      }
    } catch {
      // Ignore URL parse failures for internal callers
    }
  }

  try {
    const plan = await getDailyExecutionPlan(userId, targetDateStr);
    return NextResponse.json(plan);
  } catch (error) {
    console.error("Failed to generate execution plan:", error);
    return NextResponse.json(
      { error: "Failed to generate execution plan" },
      { status: 500 }
    );
  }
}
