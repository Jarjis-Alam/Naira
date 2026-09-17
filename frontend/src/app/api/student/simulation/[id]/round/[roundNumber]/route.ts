import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { submitSimulationRound } from "@/server/placement-simulation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; roundNumber: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, roundNumber: roundNumberParam } = await params;
  const roundNumber = parseInt(roundNumberParam, 10);

  if (!id || isNaN(roundNumber) || roundNumber < 1 || roundNumber > 5) {
    return NextResponse.json({ error: "Invalid round parameter" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const updatedSimulation = await submitSimulationRound({
      simulationId: id,
      roundNumber,
      userId: session.user.id,
      submission: body,
    });

    return NextResponse.json(updatedSimulation);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to submit round";
    if (msg.includes("locked")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg.includes("Unauthorized")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error(`[simulation-api] POST /api/student/simulation/${id}/round/${roundNumber} failed:`, error);
    return NextResponse.json({ error: "Failed to submit simulation round" }, { status: 500 });
  }
}
