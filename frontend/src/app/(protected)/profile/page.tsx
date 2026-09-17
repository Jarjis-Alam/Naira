import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { profiles, users, attempts, tests } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { calculateReadiness, detectWeakAreas } from "@/server/readiness";
import { formatDate } from "@/lib/utils";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { getOutcomeHistorySummary } from "@/server/outcome-intelligence";
import { PlacementTargetsEditor } from "@/components/profile/placement-targets-editor";
import {
  getStudentPlacementTargets,
  searchCompanies,
  searchRoles,
} from "@/server/company-role-intelligence";
import { getPlacementTargetStrategy } from "@/server/placement-target-strategy";
import { getStudentSimulationHistory } from "@/server/placement-simulation";
import { getResumeHealth } from "@/server/resume-intelligence";
import { MetricCardV2 } from "@/components/ui/metric-card-v2";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  // Fetch profile
  const userProfile = await db
    .select({
      id: profiles.id,
      userId: profiles.userId,
      name: profiles.name,
      avatarUrl: profiles.avatarUrl,
      college: profiles.college,
      branch: profiles.branch,
      graduationYear: profiles.graduationYear,
      preferredLanguage: profiles.preferredLanguage,
      email: users.email,
    })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(eq(profiles.userId, session.user.id))
    .limit(1);

  if (userProfile.length === 0) {
    notFound();
  }

  const profile = userProfile[0];

  // Fetch readiness & focus areas
  const readiness = await calculateReadiness(session.user.id);
  const weakAreas = await detectWeakAreas(session.user.id);

  // Strongest subject
  const sortedSubjects = [...readiness.subjectScores].sort(
    (a, b) => b.score - a.score
  );
  const strongestSkill =
    readiness.hasCompletedBaseline && (sortedSubjects[0]?.score || 0) > 0
      ? sortedSubjects[0].code
      : null;
  const focusArea = weakAreas[0]?.subjectCode || null;

  // Recent assessments
  const recentAttempts = await db
    .select({
      id: attempts.id,
      testId: attempts.testId,
      testTitle: tests.title,
      score: attempts.score,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .innerJoin(tests, eq(attempts.testId, tests.id))
    .where(
      and(
        eq(attempts.userId, session.user.id),
        eq(attempts.status, "submitted")
      )
    )
    .orderBy(desc(attempts.submittedAt));

  // Fetch Placement Targets and catalog
  const placementTargets = await getStudentPlacementTargets(session.user.id);
  const allRoles = await searchRoles({ includeInactive: true, limit: 100 });
  const allCompanies = await searchCompanies({ includeInactive: true, limit: 100 });

  const [targetStrategy, simulationHistory, resumeHealth] = await Promise.all([
    getPlacementTargetStrategy(session.user.id).catch(() => null),
    getStudentSimulationHistory(session.user.id).catch(() => []),
    getResumeHealth(session.user.id).catch(() => null),
  ]);

  const completedSimulation = simulationHistory.find((s) => s.status === "completed") ?? null;
  const outcomeHistory = await getOutcomeHistorySummary(session.user.id).catch(() => null);

  const initial = (profile.name.charAt(0) || "U").toUpperCase();
  const shortId = profile.id.slice(0, 8).toUpperCase();

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      {/* ── Top Bar: Breadcrumb + Cycle Status Badges ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-mono text-xs text-sage-40 flex-wrap">
          <Link href="/dashboard" className="hover:text-phosphor-white transition-colors">
            Nexora
          </Link>
          <span className="text-[#3f4a38]">/</span>
          <span className="text-phosphor-white font-semibold">Profile &amp; Identity</span>
          <span className="text-[#3f4a38]">/</span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#282b29] text-lime-pulse font-mono text-[10px] border border-[#3f4a38]/40">
            ID: NX-{shortId}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30 text-[11px] font-mono font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse animate-ping" />
            <span>Active Cycle</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-zinc-300 border border-white/20 text-[11px] font-mono font-semibold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[14px]">verified_user</span>
            <span>Profile Verified</span>
          </div>
        </div>
      </div>

      {/* ── Profile Header Hero Card ── */}
      <div className="relative rounded-2xl bg-[#191c1b] border border-[#3f4a38]/40 p-6 sm:p-8 shadow-xl overflow-hidden">
        {/* Ambient Chromatic Glow */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-lime-pulse/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Candidate Avatar with Ring */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-2xl bg-[#111413] border-2 border-lime-pulse/40 flex items-center justify-center font-heading text-2xl sm:text-3xl font-bold text-lime-pulse">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#111413] flex items-center justify-center border border-[#3f4a38]">
                <span className="w-4 h-4 rounded-full bg-lime-pulse flex items-center justify-center">
                  <span className="material-symbols-outlined text-void-black text-[12px] font-bold">
                    check
                  </span>
                </span>
              </div>
            </div>

            {/* Identity & Academic Meta */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-phosphor-white tracking-tight">
                  {profile.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-lime-pulse text-void-black font-mono text-[10px] font-bold uppercase tracking-wider">
                  {readiness.hasCompletedBaseline ? "Calibrated" : "Uncalibrated"}
                </span>
                <span className="text-sage-40 font-mono text-[11px]">
                  UID: {profile.userId.slice(0, 8)}
                </span>
              </div>

              <p className="text-xs text-sage-40 flex items-center gap-2 flex-wrap">
                <span className="text-phosphor-white font-medium">{profile.email}</span>
                <span>•</span>
                <span>{profile.branch || "Computer Science & Engineering"}</span>
                <span>•</span>
                <span className="text-phosphor-white">{profile.college || "Nexora Institute"}</span>
                <span>•</span>
                <span>Class of {profile.graduationYear || "2026"}</span>
              </p>

              {/* Status Tag Chips */}
              <div className="flex items-center gap-2 pt-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-[#282b29] text-sage-40 font-mono text-[10px] font-semibold border border-[#3f4a38]/40">
                  {profile.branch ? profile.branch.toUpperCase() : "CS CORE"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#282b29] text-sage-40 font-mono text-[10px] font-semibold border border-[#3f4a38]/40">
                  CLASS OF {profile.graduationYear || "2026"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-300 font-mono text-[10px] font-semibold border border-white/20">
                  {profile.preferredLanguage ? `${profile.preferredLanguage.toUpperCase()} TRACK` : "C++ TRACK"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-lime-pulse/15 text-lime-pulse font-mono text-[10px] font-bold border border-lime-pulse/30">
                  READINESS {readiness.readinessScore !== null ? `${readiness.readinessScore}%` : "--"}
                </span>
              </div>
            </div>
          </div>

          {/* Target Role Pill */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/target"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-lime-pulse hover:bg-mint-frost text-void-black font-semibold text-xs shadow-md transition-all font-sans"
            >
              <span className="material-symbols-outlined text-[17px]">radar</span>
              <span>Target Strategy</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 4 Placement Readiness Dimensions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCardV2
          title="Preparation Readiness"
          value={readiness.hasCompletedBaseline && readiness.readinessScore !== null ? `${readiness.readinessScore}%` : "--"}
          accentColor="green"
          icon="menu_book"
          progressPct={readiness.hasCompletedBaseline ? readiness.readinessScore : 0}
          footerText={readiness.hasCompletedBaseline ? "Curriculum benchmark active" : "Complete baseline test"}
          href="/tests"
        />

        <MetricCardV2
          title="Target Readiness"
          value={targetStrategy?.readiness.targetScore !== null && targetStrategy?.readiness.targetScore !== undefined ? `${targetStrategy.readiness.targetScore}%` : "--"}
          accentColor="pink"
          icon="radar"
          progressPct={targetStrategy?.readiness.targetScore ?? 0}
          footerText={placementTargets.configured ? "Target company alignment" : "Select target company"}
          href="/target"
        />

        <MetricCardV2
          title="Resume ATS Benchmark"
          value={resumeHealth?.hasResume && resumeHealth.atsScore !== null ? `${resumeHealth.atsScore}%` : "--"}
          accentColor="blue"
          icon="description"
          progressPct={resumeHealth?.hasResume ? resumeHealth.atsScore : 0}
          footerText={resumeHealth?.hasResume ? "ATS scan complete" : "Upload resume to scan"}
          href="/resume"
        />

        <MetricCardV2
          title="Interview Simulation"
          value={completedSimulation?.overallReadinessScore !== null && completedSimulation?.overallReadinessScore !== undefined ? `${completedSimulation.overallReadinessScore}%` : "--"}
          accentColor="amber"
          icon="videocam"
          progressPct={completedSimulation?.overallReadinessScore ?? 0}
          footerText={completedSimulation ? "Latest simulation verified" : "Take mock simulation"}
          href="/simulation"
        />
      </div>

      {/* ── Main Layout: Profile Editors & Targets ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Personal Information Editor (Span 5) */}
        <div className="lg:col-span-5 space-y-6">
          <ProfileEditor initialProfile={profile} />

          {/* Environment Preferences */}
          <div className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-5 shadow-md space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-sage-40 font-semibold">
              <span className="material-symbols-outlined text-[16px] text-lime-pulse">tune</span>
              <span>Environment Preferences</span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-mono text-sage-40 block mb-1.5">
                  Primary Language
                </span>
                <div className="flex gap-2">
                  {["C++", "Java", "Python"].map((lang) => {
                    const isSelected =
                      (profile.preferredLanguage || "C++").toLowerCase() ===
                      lang.toLowerCase();
                    return (
                      <span
                        key={lang}
                        className={`rounded-full border px-3.5 py-1 text-xs font-mono font-medium transition-colors ${
                          isSelected
                            ? "border-lime-pulse/40 bg-lime-pulse/15 text-lime-pulse font-semibold"
                            : "border-[#3f4a38]/40 bg-[#111413] text-sage-40"
                        }`}
                      >
                        {lang}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-mono text-sage-40 block mb-1.5">
                  Primary Target Role
                </span>
                <div className="rounded-xl border border-[#3f4a38]/40 bg-[#111413] p-3 text-xs font-mono text-phosphor-white">
                  {placementTargets.primaryRole ? (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{placementTargets.primaryRole.name}</span>
                      <span className="text-[10px] text-lime-pulse uppercase font-mono px-2 py-0.5 rounded-full bg-lime-pulse/10 border border-lime-pulse/30">
                        Configured
                      </span>
                    </div>
                  ) : (
                    <span className="text-sage-40">Not selected yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Placement Targets & Outcome History (Span 7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Placement Targets Editor */}
          <PlacementTargetsEditor
            initialTargets={placementTargets}
            allRoles={allRoles}
            allCompanies={allCompanies}
          />

          {/* Outcome History Card */}
          {outcomeHistory && outcomeHistory.applications > 0 && (
            <div className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-5 shadow-md">
              <div className="flex items-center gap-2 mb-3 text-xs font-mono uppercase tracking-wider text-sage-40 font-semibold">
                <span className="material-symbols-outlined text-[16px] text-lime-pulse">history</span>
                <span>Outcome History (Empirical Observations)</span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center font-mono">
                <div className="rounded-xl bg-[#111413] border border-[#3f4a38]/30 p-2.5">
                  <p className="text-[10px] uppercase text-sage-40">Applications</p>
                  <p className="text-lg font-bold text-phosphor-white mt-0.5">{outcomeHistory.applications}</p>
                </div>
                <div className="rounded-xl bg-[#111413] border border-[#3f4a38]/30 p-2.5">
                  <p className="text-[10px] uppercase text-sage-40">Interviews</p>
                  <p className="text-lg font-bold text-phosphor-white mt-0.5">{outcomeHistory.interviews}</p>
                </div>
                <div className="rounded-xl bg-[#111413] border border-[#3f4a38]/30 p-2.5">
                  <p className="text-[10px] uppercase text-sage-40">Offers</p>
                  <p className="text-lg font-bold text-lime-pulse mt-0.5">{outcomeHistory.offers}</p>
                </div>
                <div className="rounded-xl bg-[#111413] border border-[#3f4a38]/30 p-2.5">
                  <p className="text-[10px] uppercase text-sage-40">Rejections</p>
                  <p className="text-lg font-bold text-zinc-400 mt-0.5">{outcomeHistory.rejections}</p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Assessments Card */}
          <div className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-5 shadow-md">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-sage-40">
                  quiz
                </span>
                <h3 className="text-sm font-bold text-phosphor-white">
                  Recent Assessments
                </h3>
              </div>
              <span className="text-[11px] font-mono text-sage-40">
                {recentAttempts.length} recorded
              </span>
            </div>

            {recentAttempts.length > 0 ? (
              <div className="divide-y divide-[#3f4a38]/30">
                {recentAttempts.slice(0, 5).map((att) => {
                  const score = att.score ?? 0;
                  return (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-4 py-3 text-xs"
                    >
                      <div className="truncate mr-4">
                        <span className="text-phosphor-white font-medium block truncate">
                          {att.testTitle}
                        </span>
                        <span className="text-[10px] text-sage-40 font-mono">
                          {att.submittedAt ? formatDate(att.submittedAt) : "Recently"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 font-mono shrink-0">
                        <span className="font-bold text-lime-pulse">
                          {score}/100
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                            score >= 70
                              ? "border-lime-pulse/30 bg-lime-pulse/15 text-lime-pulse"
                              : "border-[#3f4a38]/40 bg-[#111413] text-sage-40"
                          }`}
                        >
                          {score >= 70 ? "PASSED" : "REVIEW"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-sage-40 py-4 text-center font-mono">
                No assessments completed yet. Start your baseline assessment to begin tracking readiness.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
