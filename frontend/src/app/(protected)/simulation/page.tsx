import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStudentSimulationHistory } from "@/server/placement-simulation";
import { getStudentPlacementTargets } from "@/server/company-role-intelligence";
import { StartSimulationForm } from "@/components/simulation/start-simulation-form";

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
      <header className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-label-xs font-mono uppercase tracking-widest text-primary mb-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>NEXORA</span>
            <span className="text-text-muted">/</span>
            <span className="text-text-secondary">PLACEMENT READINESS SIMULATION</span>
          </div>
          <h1 className="text-headline-lg font-bold text-text-primary tracking-tight">
            Placement Readiness Simulation
          </h1>
          <p className="text-body-sm text-text-secondary mt-1">
            Simulate your target company&apos;s complete placement process: Screening, Coding, Debugging, Technical Architecture, and HR Evaluation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium border bg-surface-high border-border text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            5 REALISTIC ROUNDS
          </span>
        </div>
      </header>

      {/* Active Simulation Resume Banner (if in progress) */}
      {activeSimulation && (
        <section className="p-6 sm:p-7 rounded-2xl bg-surface border border-primary/50 shadow-md ring-1 ring-primary/20 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-primary/15 text-primary-text font-bold">
                  ACTIVE SIMULATION • ROUND 0{activeSimulation.currentRoundOrder} OF 05
                </span>
              </div>
              <h3 className="text-title-lg font-bold text-text-primary">
                {activeSimulation.companyName} — {activeSimulation.roleName}
              </h3>
              <p className="text-body-sm text-text-secondary">
                You have an ongoing placement simulation. Completed rounds are preserved.
              </p>
            </div>

            <Link
              href={`/simulation/${activeSimulation.id}`}
              className="bg-primary text-text-inverse font-semibold text-body-sm px-6 py-2.5 rounded-lg hover:bg-primary-text transition-all inline-flex items-center justify-center gap-2 shadow-sm shrink-0"
            >
              <span>RESUME SIMULATION</span>
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            </Link>
          </div>
        </section>
      )}

      {/* Start New Simulation Card */}
      <section className="p-6 sm:p-8 rounded-2xl bg-surface/90 border border-border/80 space-y-6">
        <div className="space-y-1">
          <h2 className="text-title-md font-bold text-text-primary">
            Start New Placement Simulation
          </h2>
          <p className="text-body-sm text-text-secondary">
            Configure your target company and role. Nexora automatically aligns questions, test cases, and architectural prompts to your target requirements.
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
          <h2 className="text-title-md font-bold text-text-primary">
            Verified Simulation History
          </h2>
          <span className="text-label-xs font-mono text-text-muted">
            {completedSimulations.length} COMPLETED SIMULATIONS
          </span>
        </div>

        {completedSimulations.length === 0 ? (
          <div className="p-8 rounded-xl bg-surface/60 border border-border/70 text-center space-y-2">
            <span className="material-symbols-outlined text-[32px] text-text-muted">history_toggle_off</span>
            <h3 className="text-body-sm font-semibold text-text-primary">No completed simulations yet</h3>
            <p className="text-[12px] text-text-secondary max-w-sm mx-auto">
              Complete your first multi-round simulation above to evaluate your realistic readiness against placement benchmarks.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedSimulations.map((sim) => (
              <div
                key={sim.id}
                className="p-5 rounded-2xl bg-surface border border-border/80 hover:border-border transition-all flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary/15 text-secondary font-bold">
                      {sim.readinessLevel || "COMPLETED"}
                    </span>
                    <span className="text-[11px] font-mono text-text-muted">
                      {sim.completedAt
                        ? new Date(sim.completedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "Completed"}
                    </span>
                  </div>
                  <h3 className="text-body-md font-bold text-text-primary line-clamp-1">
                    {sim.companyName}
                  </h3>
                  <span className="text-[12px] font-mono text-text-muted block mt-0.5">
                    {sim.roleName}
                  </span>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-text-muted uppercase block">
                      READINESS
                    </span>
                    <span className="text-2xl font-bold font-mono text-secondary">
                      {sim.overallReadinessScore}%
                    </span>
                  </div>
                  <Link
                    href={`/simulation/${sim.id}`}
                    className="text-primary-text font-mono text-[12px] font-semibold hover:underline inline-flex items-center gap-1"
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
