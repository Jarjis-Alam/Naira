import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPracticeRecommendations } from "@/server/practice-question-intelligence";

export async function GET() {
  try {
    let session = null;
    try {
      session = await auth();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recommendations = await getPracticeRecommendations(session.user.id);
    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("[api/student/practice/recommendations] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
