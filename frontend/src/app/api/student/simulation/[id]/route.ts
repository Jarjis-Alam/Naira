import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlacementSimulation } from "@/server/placement-simulation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing simulation ID" }, { status: 400 });
  }

  try {
    const simulation = await getPlacementSimulation(id, session.user.id);
    return NextResponse.json(simulation);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load simulation";
    if (msg.includes("Unauthorized")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error(`[simulation-api] GET /api/student/simulation/${id} failed:`, error);
    return NextResponse.json({ error: "Failed to load simulation" }, { status: 500 });
  }
}
