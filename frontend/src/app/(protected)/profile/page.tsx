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
import { CompactMetricStrip } from "@/components/ui/compact-metric-strip";
import { PrivacyManagementCard } from "@/components/profile/privacy-management-card";

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

  const completedSimulation =
    (simulationHistory as Array<{ status: string; overallReadinessScore?: number | null }>).find(
      (s) => s.status === "completed"
    ) ?? null;
  const outcomeHistory = await getOutcomeHistorySummary(session.user.id).catch(() => null);

  const initial = (profile.name.charAt(0) || "U").toUpperCase();
  const shortId = profile.id.slice(0, 8).toUpperCase();

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white font-display">
            Candidate Profile
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Academic credentials, target roles, and performance dimensions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/target"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">radar</span>
            <span>Target Strategy</span>
          </Link>
        </div>
      </div>

      {/* ── Profile Header Hero Card ── */}
      <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Candidate Avatar */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-zinc-900 border border-zinc-700 flex items-center justify-center font-heading text-2xl font-bold text-white">
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
            </div>

            {/* Identity & Academic Meta */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {profile.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[10px] font-semibold border border-zinc-700">
                  {readiness.hasCompletedBaseline ? "Calibrated" : "Uncalibrated"}
                </span>
                <span className="text-zinc-500 font-mono text-[11px]">
                  UID: {profile.userId.slice(0, 8)}
                </span>
              </div>

              <p className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
                <span className="text-zinc-200 font-medium">{profile.email}</span>
                <span>•</span>
                <span>{profile.branch || "Computer Science & Engineering"}</span>
                <span>•</span>
                <span className="text-zinc-300">{profile.college || "Institute of Technology"}</span>
                <span>•</span>
                <span>Class of {profile.graduationYear || "2026"}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Placement Readiness Dimensions Strip ── */}
      <section aria-label="Placement Readiness Dimensions">
        <CompactMetricStrip
          items={[
            {
              id: "prep",
              label: "Preparation",
              value:
                readiness.hasCompletedBaseline && readiness.readinessScore !== null
                  ? `${readiness.readinessScore}%`
                  : "--",
              detail: readiness.hasCompletedBaseline
                ? "Curriculum benchmark"
                : "Baseline pending",
              progressPct: readiness.hasCompletedBaseline ? readiness.readinessScore : 0,
              href: "/tests",
            },
            {
              id: "target",
              label: "Target Fit",
              value:
                targetStrategy?.readiness.targetScore !== null &&
                targetStrategy?.readiness.targetScore !== undefined
                  ? `${targetStrategy.readiness.targetScore}%`
                  : "--",
              detail: placementTargets.configured
                ? "Target alignment"
                : "Select company",
              progressPct: targetStrategy?.readiness.targetScore ?? 0,
              href: "/target",
            },
            {
              id: "ats",
              label: "Resume ATS",
              value:
                resumeHealth?.hasResume && resumeHealth.atsScore !== null
                  ? `${resumeHealth.atsScore}%`
                  : "--",
              detail: resumeHealth?.hasResume ? "ATS analyzed" : "Upload resume",
              progressPct: resumeHealth?.hasResume ? resumeHealth.atsScore : 0,
              href: "/resume",
            },
            {
              id: "simulation",
              label: "Interview Simulation",
              value:
                completedSimulation?.overallReadinessScore !== null &&
                completedSimulation?.overallReadinessScore !== undefined
                  ? `${completedSimulation.overallReadinessScore}%`
                  : "--",
              detail: completedSimulation ? "Latest verified" : "Take mock",
              progressPct: completedSimulation?.overallReadinessScore ?? 0,
              href: "/simulation",
            },
          ]}
        />
      </section>

      {/* ── Main Layout: Profile Editors & Targets ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Personal Information Editor (Span 5) */}
        <div className="lg:col-span-5 space-y-6">
          <ProfileEditor initialProfile={profile} />

          {/* Environment Preferences */}
          <div className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-5 shadow-md space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-sage-40 font-semibold">
              <span className="material-symbols-outlined text-[16px] text-lime-pulse">tune</span>
              <span>Preferences</span>
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
                <span>Outcome History</span>
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

      {/* ── Privacy & Data Sovereignty Section ── */}
      <PrivacyManagementCard
        userId={profile.userId}
        email={profile.email}
      />
    </div>
  );
}
