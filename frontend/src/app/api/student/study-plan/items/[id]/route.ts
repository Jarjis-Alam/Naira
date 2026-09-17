import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateStudyPlanItemStatus } from "@/server/adaptive-study-planner";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validStatuses = [
      "PENDING",
      "IN_PROGRESS",
      "PARTIALLY_COMPLETED",
      "COMPLETED",
      "MISSED",
      "RESCHEDULED",
    ];

    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await updateStudyPlanItemStatus(
      session.user.id,
      id,
      body.status
    );

    if (!result.success) {
      return NextResponse.json(
        { error: "Item not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update study plan item:", error);
    return NextResponse.json(
      { error: "Failed to update study plan item" },
      { status: 500 }
    );
  }
}
