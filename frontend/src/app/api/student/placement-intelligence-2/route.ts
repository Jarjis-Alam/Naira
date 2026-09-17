import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlacementIntelligence2 } from "@/server/placement-intelligence-2";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Derive student identity strictly from authenticated server session
  const userId = session.user.id;

  try {
    const snapshot = await getPlacementIntelligence2(userId);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Failed to generate placement intelligence 2.0:", error);
    return NextResponse.json(
      { error: "Failed to generate placement intelligence 2.0" },
      { status: 500 }
    );
  }
}
