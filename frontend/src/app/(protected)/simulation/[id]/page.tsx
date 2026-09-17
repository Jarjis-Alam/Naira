import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPlacementSimulation } from "@/server/placement-simulation";
import {
  getResumeCoverageForGaps,
  type ResumeCoverageReport,
} from "@/server/resume-intelligence";
import { SimulationRunner } from "@/components/simulation/simulation-runner";
import Link from "next/link";

export default async function SimulationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const { id } = await params;
  if (!id) notFound();

  let simulation;
  try {
    simulation = await getPlacementSimulation(id, session.user.id);
  } catch (error) {
    console.error("Failed to load placement simulation:", error);
    notFound();
  }

  // Phase 18 integration: does the student's resume evidence the areas the
  // simulation flagged? Best-effort — a resume problem never breaks this page.
  let resumeCoverage: ResumeCoverageReport | null = null;
  const gaps = simulation.summaryReport?.targetGapAnalysis?.needsImprovement ?? [];
  if (gaps.length > 0) {
    resumeCoverage = await getResumeCoverageForGaps(
      session.user.id,
      gaps.map((gap) => ({ domain: gap.domain, topic: gap.topic }))
    ).catch(() => null);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex items-center gap-2 text-label-xs font-mono uppercase tracking-widest text-text-muted">
        <Link href="/simulation" className="hover:text-text-primary transition-colors">
          SIMULATIONS
        </Link>
        <span>/</span>
        <span className="text-primary font-semibold">{simulation.companyName}</span>
      </div>

      <SimulationRunner initialSimulation={simulation} resumeCoverage={resumeCoverage} />
    </div>
  );
}
