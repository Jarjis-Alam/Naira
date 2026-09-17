import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStudentSimulationHistory } from "@/server/placement-simulation";
import { getStudentPlacementTargets } from "@/server/company-role-intelligence";
import { StartSimulationForm } from "@/components/simulation/start-simulation-form";
import { Eyebrow } from "@/components/ui/eyebrow";

export default async function SimulationHubPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/simulation");
  }

  const userId = session.user.id;
  const [history, targets] = await Promise.all([
    getStudentSimulationHistory(userId),
    getStudentPlacementTargets(userId),
  ]);

  const activeSimulation = history.find((s) => s.status !== "completed");
  const completedSimulations = history.filter((s) => s.status === "completed");

  const primaryRole = targets.primaryRole?.name || "Software Engineer";
  const primaryCompany = targets.primaryCompany?.name || "Tier-1 Tech Firm";

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-circuit-border/60 pb-6">
        <div>
          <Eyebrow system="NEXORA" category="PLACEMENT READINESS SIMULATION">
            MULTI-ROUND EVALUATION
          </Eyebrow>
          <h1 className="font-heading text-headline-lg font-semibold text-phosphor-white tracking-tight">
            Placement Readiness Simulation
          </h1>
          <p className="text-body-sm text-sage-60 mt-1 max-w-2xl">
            Simulate your target company&apos;s complete interview lifecycle: Screening, Coding, Debugging, Technical Architecture, and HR Evaluation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pills text-caption font-mono font-medium border border-circuit-border bg-carbon-veil text-moss-80">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse" />
            5 REALISTIC ROUNDS
          </span>
        </div>
      </header>

      {/* Active Simulation Resume Banner (if in progress) */}
      {activeSimulation && (
        <section className="p-6 rounded-cards bg-ground-iron border border-lime-pulse/60 shadow-none relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-pills bg-lime-pulse/15 text-phosphor-white border border-lime-pulse/40 font-semibold">
                  ACTIVE SIMULATION • ROUND 0{activeSimulation.currentRoundOrder} OF 05
                </span>
              </div>
              <h3 className="font-heading text-title-md font-semibold text-phosphor-white">
                {activeSimulation.companyName} — {activeSimulation.roleName}
              </h3>
              <p className="text-body-sm text-sage-60">
                You have an ongoing placement simulation. Completed round scores are preserved.
              </p>
            </div>

            <Link
              href={`/simulation/${activeSimulation.id}`}
              className="bg-lime-pulse text-void-black font-semibold text-body-sm px-6 py-2.5 rounded-pills hover:bg-[#6edc54] transition-all inline-flex items-center justify-center gap-2 shadow-none shrink-0"
            >
              <span>RESUME SIMULATION</span>
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            </Link>
          </div>
        </section>
      )}

      {/* Start New Simulation Card */}
      <section className="p-6 sm:p-8 rounded-cards bg-ground-iron border border-circuit-border space-y-6 shadow-none">
        <div className="space-y-1">
          <h2 className="font-heading text-title-md font-semibold text-phosphor-white">
            Start New Placement Simulation
          </h2>
          <p className="text-body-sm text-sage-60">
            Configure your target company and role. Nexora dynamically calibrates questions, test cases, and architectural prompts to match benchmark standards.
          </p>
        </div>

        <StartSimulationForm
          defaultRoleName={primaryRole}
          defaultCompanyName={primaryCompany}
          roleId={targets.primaryRole?.id}
          companyId={targets.primaryCompany?.id}
        />
      </section>

      {/* Simulation History */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-title-md font-semibold text-phosphor-white">
            Verified Simulation History
          </h2>
          <span className="text-caption font-mono text-sage-40">
            {completedSimulations.length} COMPLETED SIMULATIONS
          </span>
        </div>

        {completedSimulations.length === 0 ? (
          <div className="p-8 rounded-cards bg-ground-iron/40 border border-dashed border-circuit-border text-center space-y-2">
            <span className="material-symbols-outlined text-[32px] text-circuit-border">history_toggle_off</span>
            <h3 className="text-body-sm font-semibold text-phosphor-white">No completed simulations yet</h3>
            <p className="text-caption font-mono text-sage-40 max-w-sm mx-auto">
              Complete your first 5-round simulation above to evaluate your realistic readiness against placement benchmarks.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedSimulations.map((sim) => (
              <div
                key={sim.id}
                className="p-5 rounded-cards bg-ground-iron border border-circuit-border hover:border-lime-pulse/50 transition-all flex flex-col justify-between space-y-4 shadow-none"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-pills bg-lime-pulse/15 text-phosphor-white border border-lime-pulse/40 font-semibold">
                      {sim.readinessLevel || "COMPLETED"}
                    </span>
                    <span className="text-caption font-mono text-sage-40">
                      {sim.completedAt
                        ? new Date(sim.completedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "Completed"}
                    </span>
                  </div>
                  <h3 className="text-body font-semibold text-phosphor-white line-clamp-1">
                    {sim.companyName}
                  </h3>
                  <span className="text-caption font-mono text-sage-40 block mt-0.5">
                    {sim.roleName}
                  </span>
                </div>

                <div className="pt-3 border-t border-circuit-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-sage-40 uppercase block">
                      READINESS
                    </span>
                    <span className="text-2xl font-bold font-mono text-lime-pulse">
                      {sim.overallReadinessScore}%
                    </span>
                  </div>
                  <Link
                    href={`/simulation/${sim.id}`}
                    className="text-fern-link hover:text-phosphor-white font-mono text-caption font-semibold underline inline-flex items-center gap-1 transition-colors"
                  >
                    <span>View Report</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
