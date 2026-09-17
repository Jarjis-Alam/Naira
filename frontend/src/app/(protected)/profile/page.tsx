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
import { Eyebrow } from "@/components/ui/eyebrow";

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

  const completedSimulation = simulationHistory.find((simulation) => simulation.status === "completed") ?? null;

  const profileDimensions = [
    {
      id: "preparation",
      label: "Preparation Readiness",
      value: readiness.readinessScore,
      href: "/roadmap",
      note: readiness.hasCompletedBaseline
        ? "Measured assessment accuracy across the curriculum."
        : "Complete the baseline assessment to measure this.",
    },
    {
      id: "target",
      label: "Target Readiness",
      value: targetStrategy?.readiness.targetScore ?? null,
      href: "/target",
      note: placementTargets.configured
        ? "Alignment with your target company and role requirements."
        : "Select a target company and role to measure this.",
    },
    {
      id: "resume",
      label: "Resume ATS Compatibility",
      value: resumeHealth?.hasResume ? resumeHealth.atsScore : null,
      href: "/resume",
      note: resumeHealth?.hasResume
        ? "How reliably an ATS can parse your resume."
        : "Upload a resume to measure ATS compatibility.",
    },
    {
      id: "interview",
      label: "Interview Readiness",
      value: completedSimulation?.overallReadinessScore ?? null,
      href: "/simulation",
      note: completedSimulation
        ? "Latest completed placement simulation score."
        : "Complete a placement simulation to measure this.",
    },
  ];

  // Phase 20 — descriptive outcome history (counts only).
  const outcomeHistory = await getOutcomeHistorySummary(session.user.id).catch(() => null);

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-circuit-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow system="NEXORA" category="STUDENT IDENTITY">
            PLACEMENT PROFILE
          </Eyebrow>
          <h1 className="font-heading text-headline-lg font-semibold text-phosphor-white tracking-tight">
            Student Placement Profile
          </h1>
          <p className="text-body-sm text-sage-60 mt-1">
            Personal identity, academic benchmarks, target alignment, and multi-dimensional readiness measurements.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Personal & Academic Profile (Span 4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Identity Card */}
          <div className="rounded-cards border border-circuit-border bg-ground-iron p-6 text-center shadow-none">
            <div
              role="img"
              aria-label={`${profile.name} profile`}
              className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-circuit-border bg-carbon-veil text-2xl font-bold font-mono text-lime-pulse"
              style={profile.avatarUrl ? { backgroundImage: `url(${profile.avatarUrl})`, backgroundSize: "cover" } : undefined}
            >
              {!profile.avatarUrl && profile.name.charAt(0).toUpperCase()}
            </div>

            <div className="mt-4">
              <h2 className="font-heading text-title-md font-semibold text-phosphor-white">{profile.name}</h2>
              <p className="mt-0.5 break-all text-body-sm text-sage-60">{profile.email}</p>
              <p className="mt-2 text-caption font-mono uppercase text-moss-70">
                {profile.branch || "Academic details not set"}
              </p>
            </div>

            <div className="mt-5 space-y-2 border-t border-circuit-border/60 pt-4 text-left font-mono text-caption">
              <div className="flex items-start justify-between gap-4">
                <span className="uppercase text-sage-40">Institution</span>
                <span className="max-w-[160px] text-right font-medium text-phosphor-white">
                  {profile.college || "Not set"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="uppercase text-sage-40">Branch</span>
                <span className="max-w-[160px] text-right font-medium text-phosphor-white">
                  {profile.branch || "Not set"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="uppercase text-sage-40">Graduation Year</span>
                <span className="font-medium text-phosphor-white">{profile.graduationYear || "Not set"}</span>
              </div>
            </div>
          </div>

          {/* Editable Personal Info Card */}
          <ProfileEditor initialProfile={profile} />
        </div>

        {/* Right Col: Placement Metrics & Preferences (Span 8) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Placement Profile Metrics Banner */}
          <div className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
            <div className="flex items-center gap-2 mb-4 text-caption text-moss-70 font-mono uppercase font-medium">
              <span className="material-symbols-outlined text-[18px] text-lime-pulse">analytics</span>
              <span>Placement Dimensions</span>
            </div>

            {/* Distinct placement dimensions — never merged into one number */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {profileDimensions.map((dimension) => (
                <div key={dimension.id} className="min-w-0 p-3 rounded-md bg-carbon-veil/70 border border-circuit-border/60">
                  <span className="text-[10px] text-sage-40 uppercase font-mono block mb-1">
                    {dimension.label}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-phosphor-white">
                      {dimension.value !== null ? `${dimension.value}%` : "--"}
                    </span>
                  </div>
                  <div className="w-full bg-ground-iron h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-lime-pulse h-full rounded-full" style={{ width: `${dimension.value ?? 0}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] font-mono text-sage-40 leading-relaxed">
                    {dimension.note}
                  </p>
                  <Link
                    href={dimension.href}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-fern-link hover:text-phosphor-white underline"
                  >
                    <span>Open</span>
                    <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                  </Link>
                </div>
              ))}
            </div>

            {/* Placement Outcome History */}
            {outcomeHistory && outcomeHistory.applications > 0 && (
              <div className="mt-5 border-t border-circuit-border/60 pt-4">
                <div className="flex items-center gap-2 mb-3 text-caption text-moss-70 font-mono uppercase font-medium">
                  <span className="material-symbols-outlined text-[16px] text-lime-pulse">history</span>
                  <span>Outcome History (Empirical Counts)</span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="rounded-md bg-carbon-veil/60 border border-circuit-border/40 px-2 py-2">
                    <p className="text-[10px] font-mono uppercase text-sage-40 font-medium">Applications</p>
                    <p className="text-body font-mono font-bold text-phosphor-white mt-0.5">{outcomeHistory.applications}</p>
                  </div>
                  <div className="rounded-md bg-carbon-veil/60 border border-circuit-border/40 px-2 py-2">
                    <p className="text-[10px] font-mono uppercase text-sage-40 font-medium">Interviews</p>
                    <p className="text-body font-mono font-bold text-phosphor-white mt-0.5">{outcomeHistory.interviews}</p>
                  </div>
                  <div className="rounded-md bg-carbon-veil/60 border border-circuit-border/40 px-2 py-2">
                    <p className="text-[10px] font-mono uppercase text-sage-40 font-medium">Offers</p>
                    <p className="text-body font-mono font-bold text-lime-pulse mt-0.5">{outcomeHistory.offers}</p>
                  </div>
                  <div className="rounded-md bg-carbon-veil/60 border border-circuit-border/40 px-2 py-2">
                    <p className="text-[10px] font-mono uppercase text-sage-40 font-medium">Rejections</p>
                    <p className="text-body font-mono font-bold text-phosphor-white mt-0.5">{outcomeHistory.rejections}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-circuit-border/60 pt-4">
              <div>
                <span className="text-caption text-sage-40 uppercase font-mono block mb-1">
                  Strongest Skill
                </span>
                <div className="text-2xl font-bold font-mono text-phosphor-white flex items-center gap-2 mt-1">
                  <span className="material-symbols-outlined text-lime-pulse text-[20px]">
                    code
                  </span>
                  {strongestSkill || "Not established yet"}
                </div>
              </div>

              <div>
                <span className="text-caption text-sage-40 uppercase font-mono block mb-1">
                  Current Focus Area
                </span>
                <div className="text-2xl font-bold font-mono text-[#ffd37a] flex items-center gap-2 mt-1">
                  <span className="material-symbols-outlined text-[#ffd37a] text-[20px]">
                    memory
                  </span>
                  {focusArea || "Not established yet"}
                </div>
              </div>
            </div>
          </div>

          {/* Placement Targets (Phase 11A) */}
          <PlacementTargetsEditor
            initialTargets={placementTargets}
            allRoles={allRoles}
            allCompanies={allCompanies}
          />

          {/* Environment Preferences */}
          <div className="space-y-4 rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
            <div className="flex items-center gap-2 text-caption text-moss-70 font-mono uppercase font-medium">
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Environment Preferences</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-caption text-sage-40 uppercase font-mono block mb-2">
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
                        className={`rounded-buttons border px-3.5 py-1.5 font-mono text-caption font-medium ${
                          isSelected
                            ? "border-lime-pulse bg-ground-iron text-phosphor-white"
                            : "border-circuit-border bg-carbon-veil text-sage-40"
                        }`}
                      >
                        {lang}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-caption text-sage-40 uppercase font-mono block mb-2">
                  Target Role
                </span>
                <div className="rounded-buttons border border-circuit-border bg-carbon-veil p-2.5 text-body-sm font-mono text-phosphor-white">
                  {placementTargets.primaryRole ? (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{placementTargets.primaryRole.name}</span>
                      <span className="text-[10px] text-lime-pulse uppercase font-mono px-1.5 py-0.5 rounded-pills bg-lime-pulse/10 border border-lime-pulse/30">
                        Configured
                      </span>
                    </div>
                  ) : (
                    <span className="text-sage-40">Not set</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Assessments */}
          <div className="rounded-cards border border-circuit-border bg-ground-iron p-6 shadow-none">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-heading text-title-md font-semibold text-phosphor-white">
                Recent Assessments
              </h3>
              <span className="text-caption font-mono uppercase text-sage-40">{recentAttempts.length} recorded</span>
            </div>

            {recentAttempts.length > 0 ? (
              <div className="divide-y divide-circuit-border/60">
                {recentAttempts.map((att) => {
                  const score = att.score ?? 0;
                  return (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-4 py-3 text-body-sm"
                    >
                      <div className="truncate mr-4">
                        <span className="text-phosphor-white font-medium block truncate">
                          {att.testTitle}
                        </span>
                        <span className="text-caption text-sage-40 font-mono">
                          {att.submittedAt ? formatDate(att.submittedAt) : "Recently"}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 font-mono text-caption shrink-0">
                        <span className="font-bold text-phosphor-white">
                          {score}/100
                        </span>
                        <span
                          className={`rounded-pills border px-2 py-0.5 font-bold ${
                            score >= 70
                              ? "border-lime-pulse/30 bg-lime-pulse/10 text-lime-pulse"
                              : "border-circuit-border bg-carbon-veil text-sage-40"
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
              <p className="text-body-sm text-sage-40 py-4 text-center font-mono">
                No assessments completed yet. Start your baseline assessment to begin tracking readiness.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
