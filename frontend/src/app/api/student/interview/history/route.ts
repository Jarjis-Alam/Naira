import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listInterviewHistory } from "@/server/interview-coach";

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

    const history = await listInterviewHistory(session.user.id);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("[api/student/interview/history] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
