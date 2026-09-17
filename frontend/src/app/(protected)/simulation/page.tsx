import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStudentSimulationHistory } from "@/server/placement-simulation";
import { getStudentPlacementTargets } from "@/server/company-role-intelligence";
import { StartSimulationForm } from "@/components/simulation/start-simulation-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// The 5-phase readiness formula — Phase 17 invariant, DO NOT MODIFY weights
const SIMULATION_PHASES = [
  { key: "screening",   step: "1", label: "Screening",           weight: 20, icon: "filter_list",       accent: "blue" },
  { key: "coding",      step: "2", label: "Coding & Algo",       weight: 30, icon: "code",              accent: "green" },
  { key: "debugging",   step: "3", label: "Debugging Drill",     weight: 15, icon: "bug_report",        accent: "amber" },
  { key: "technical",   step: "4", label: "Technical Interview",  weight: 20, icon: "architecture",      accent: "purple" },
  { key: "hr",          step: "5", label: "HR Evaluation",       weight: 15, icon: "record_voice_over", accent: "rose" },
];

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

  // Most recent completed sim for phase breakdown
  const latestComplete = completedSimulations[0] ?? null;

  const breadcrumbs = [
    { label: "NEXORA", href: "/dashboard" },
    { label: "CORE OS", href: "/dashboard" },
    { label: "PLACEMENT SIMULATIONS" },
  ];

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      {/* ── Top Header ── */}
      <PageHeader
        breadcrumbs={breadcrumbs}
        title="Placement Simulations"
        subtitle="Simulate your target company's complete interview lifecycle across 5 deterministic evaluation stages."
        badge={{
          label: "5 ROUND RIG",
          variant: "green",
          ping: true,
        }}
      />

      {/* ── Round Progression Visualizer (Horizontal Pill-Based Stage Chain) ── */}
      <section className="w-full">
        <div className="p-5 rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 shadow-md">
          <div className="flex items-center justify-between mb-3.5 px-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lime-pulse text-[18px]">schema</span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-sage-40 font-bold">
                Deterministic 5-Stage Formula
              </span>
            </div>
            <span className="text-[11px] font-mono text-sage-40 hidden sm:block">
              20% Screening • 30% Coding • 15% Debug • 20% Tech • 15% HR
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {SIMULATION_PHASES.map((phase) => (
              <div
                key={phase.key}
                className="flex items-center justify-between px-4 py-2.5 rounded-full bg-[#111413] border border-[#3f4a38]/30 group hover:border-[#88957f]/60 transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-lime-pulse/15 text-lime-pulse flex items-center justify-center shrink-0 text-[10px] font-mono font-bold">
                    {phase.step}
                  </span>
                  <span className="text-xs font-semibold text-phosphor-white truncate">
                    {phase.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-lime-pulse bg-lime-pulse/10 px-2 py-0.5 rounded-full ml-1 shrink-0">
                  {phase.weight}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Active Simulation Resume Banner ── */}
      {activeSimulation && (
        <section className="p-6 rounded-2xl bg-[#191c1b] border border-lime-pulse/40 shadow-xl relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-lime-pulse/5 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30 text-[10px] font-mono font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse animate-ping" />
                <span>ACTIVE — ROUND {String(activeSimulation.currentRoundOrder).padStart(2, "0")} OF 05</span>
              </div>
              <h3 className="text-xl font-bold font-heading text-phosphor-white">
                {activeSimulation.companyName} — {activeSimulation.roleName}
              </h3>
              <p className="text-xs text-sage-40">
                You have an ongoing simulation in progress. All completed round scores are preserved.
              </p>
            </div>
            <Link
              href={`/simulation/${activeSimulation.id}`}
              className="px-6 py-2.5 rounded-full bg-lime-pulse hover:bg-mint-frost text-void-black font-semibold text-xs transition-all shadow-[0_0_20px_rgba(127,238,100,0.25)] flex items-center justify-center gap-2 shrink-0"
            >
              <span className="material-symbols-outlined text-[17px]">play_arrow</span>
              <span>Resume Simulation</span>
            </Link>
          </div>
        </section>
      )}

      {/* ── Latest Simulation Score Breakdown ── */}
      {latestComplete && (
        <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-lime-pulse">analytics</span>
              <h2 className="text-xs font-mono uppercase tracking-wider text-sage-40 font-semibold">
                Latest Simulation Evaluation
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-lime-pulse/15 text-lime-pulse font-mono text-[10px] font-bold uppercase border border-lime-pulse/30">
              {latestComplete.readinessLevel ?? "CALIBRATED"}
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6 pt-2">
            <div className="flex items-baseline gap-2 shrink-0">
              <span className="text-4xl sm:text-5xl font-extrabold font-heading text-lime-pulse">
                {latestComplete.overallReadinessScore}
              </span>
              <span className="text-lg font-mono text-sage-40">/ 100</span>
            </div>
            <div className="flex-1 w-full space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-phosphor-white font-medium">
                  {latestComplete.companyName} — {latestComplete.roleName}
                </span>
                <span className="text-lime-pulse font-bold">{latestComplete.overallReadinessScore}% Score</span>
              </div>
              <div className="w-full bg-[#0c0f0e] h-2 rounded-full overflow-hidden border border-[#3f4a38]/20">
                <div
                  className="bg-lime-pulse h-full rounded-full transition-all duration-500"
                  style={{ width: `${latestComplete.overallReadinessScore ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Start New Simulation Form ── */}
      <section className="p-6 sm:p-8 rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 shadow-md space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[20px] text-lime-pulse">bolt</span>
            <h2 className="text-base font-bold font-heading text-phosphor-white">
              Start New Placement Simulation
            </h2>
          </div>
          <p className="text-xs text-sage-40">
            Configure your target company and role. Nexora dynamically calibrates questions to match industry benchmark standards.
          </p>
        </div>

        <StartSimulationForm
          defaultRoleName={primaryRole}
          defaultCompanyName={primaryCompany}
          roleId={targets.primaryRole?.id}
          companyId={targets.primaryCompany?.id}
        />
      </section>

      {/* ── Simulation History ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-sage-40">history</span>
            <h2 className="text-sm font-bold text-phosphor-white">Simulation History</h2>
          </div>
          <span className="text-xs font-mono text-sage-40 uppercase">
            {completedSimulations.length} COMPLETED
          </span>
        </div>

        {completedSimulations.length === 0 ? (
          <EmptyState
            icon="history_toggle_off"
            title="No completed simulations yet"
            description="Complete your first 5-round simulation to evaluate your realistic readiness against placement benchmarks."
            accentColor="purple"
            size="md"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedSimulations.map((sim) => {
              const score = sim.overallReadinessScore ?? 0;
              const isHigh = score >= 70;
              const isMedium = score >= 50;

              return (
                <div
                  key={sim.id}
                  className="p-5 rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 hover:border-[#88957f]/60 transition-all flex flex-col justify-between gap-4 shadow-md group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                          isHigh
                            ? "bg-lime-pulse/15 text-lime-pulse border-lime-pulse/30"
                            : isMedium
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {sim.readinessLevel ?? "COMPLETED"}
                      </span>
                      <span className="font-mono text-[10px] text-sage-40">
                        {sim.completedAt
                          ? new Date(sim.completedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Completed"}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-phosphor-white truncate group-hover:text-lime-pulse transition-colors">
                      {sim.companyName}
                    </h3>
                    <span className="text-xs text-sage-40 block mt-0.5">
                      {sim.roleName}
                    </span>
                  </div>

                  <div className="border-t border-[#3f4a38]/30 pt-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-sage-40 uppercase block">
                        Readiness
                      </span>
                      <span
                        className={`text-2xl font-extrabold font-heading ${
                          isHigh
                            ? "text-lime-pulse"
                            : isMedium
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {score}%
                      </span>
                    </div>
                    <Link
                      href={`/simulation/${sim.id}`}
                      className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#111413] border border-[#3f4a38]/40 text-phosphor-white hover:border-lime-pulse hover:text-lime-pulse transition-all inline-flex items-center gap-1"
                    >
                      <span>Report</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
