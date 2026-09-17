import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createPlacementSimulation,
  getStudentSimulationHistory,
} from "@/server/placement-simulation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const history = await getStudentSimulationHistory(session.user.id);
    return NextResponse.json(history);
  } catch (error) {
    console.error("Failed to fetch simulation history:", error);
    return NextResponse.json(
      { error: "Failed to fetch simulation history" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, companyName, roleId, roleName } = body;

    const simulation = await createPlacementSimulation({
      userId: session.user.id,
      companyId,
      companyName,
      roleId,
      roleName,
    });

    return NextResponse.json(simulation, { status: 201 });
  } catch (error) {
    console.error("Failed to create placement simulation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create simulation" },
      { status: 400 }
    );
  }
}
