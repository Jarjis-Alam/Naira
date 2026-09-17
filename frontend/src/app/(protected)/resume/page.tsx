import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getResumeVariant,
  getResumeWorkspace,
  type ResumeVariantDetail,
  type ResumeWorkspace,
} from "@/server/resume-intelligence";
import { searchCompanies, searchRoles } from "@/server/company-role-intelligence";
import { AtsScoreCard } from "@/components/resume/ats-score-card";
import { ParsingFindings } from "@/components/resume/parsing-findings";
import { RoleMatchPanel } from "@/components/resume/role-match-panel";
import { SkillMatchPanel } from "@/components/resume/skill-match-panel";
import { KeywordMatchTable } from "@/components/resume/keyword-match-table";
import { SuggestionsPanel } from "@/components/resume/suggestions-panel";
import { JobDescriptionPanel } from "@/components/resume/job-description-panel";
import { ResumeUploadPanel } from "@/components/resume/resume-upload-panel";
import { VariantsPanel } from "@/components/resume/variants-panel";
import { VersionHistory } from "@/components/resume/version-history";
import { ResumeTargetSelector } from "@/components/resume/resume-target-selector";

export default async function ResumeIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ variantId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/resume");

  const userId = session.user.id;
  const { variantId } = await searchParams;

  const workspace: ResumeWorkspace = await getResumeWorkspace(userId);

  let activeVariant: ResumeVariantDetail | null = workspace.primaryVariant;
  if (variantId) {
    try {
      activeVariant = await getResumeVariant(variantId, userId);
    } catch {
      activeVariant = workspace.primaryVariant;
    }
  }

  const [companies, roles] = await Promise.all([
    searchCompanies({ limit: 60 }).catch(() => []),
    searchRoles({ limit: 60 }).catch(() => []),
  ]);

  const analysis = activeVariant?.analysis ?? null;
  const targetLabel = activeVariant
    ? [activeVariant.targetCompanyName, activeVariant.targetRoleName].filter(Boolean).join(" — ") || null
    : workspace.targets.configured
      ? [workspace.targets.companyName, workspace.targets.roleName].filter(Boolean).join(" — ")
      : null;

  const assertedSkills =
    activeVariant?.structured.studentAssertedFacts
      .filter((fact) => fact.kind === "skill")
      .map((fact) => fact.value) ?? [];

  const recommendations = (analysis?.findings ?? []).slice(0, 3);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-label-xs font-mono uppercase tracking-widest text-primary mb-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>NEXORA</span>
            <span className="text-text-muted">/</span>
            <span className="text-text-secondary">ATS RESUME INTELLIGENCE</span>
          </div>
          <h1 className="text-headline-lg font-bold text-text-primary tracking-tight">Resume Intelligence</h1>
          <p className="text-body-sm text-text-secondary mt-1">
            How well does your resume match the company and role you are targeting, and what should you improve?
          </p>
        </div>
        {activeVariant && (
          <Link
            href={`/resume/builder?variantId=${activeVariant.id}`}
            className="bg-primary text-text-inverse font-semibold text-body-sm px-6 py-2.5 rounded-lg hover:bg-primary-text transition-all inline-flex items-center gap-2 shadow-sm self-start"
          >
            <span>Improve Resume</span>
            <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
          </Link>
        )}
      </header>

      {/* Target banner */}
      {activeVariant && (
        <section className="rounded-2xl border border-primary/30 bg-surface/90 p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">target</span>
                Target
              </span>
              <h2 className="text-title-lg font-bold text-text-primary mt-1">
                {targetLabel || "No target configured"}
              </h2>
              <p className="text-[11px] font-mono text-text-muted mt-1">
                {workspace.targets.configured
                  ? "Defaulting to your Phase 16 primary target. Variants keep their own target."
                  : "Set a target in Profile to align the analysis with a company and role."}
                {" · "}
                <Link href="/profile" className="text-primary-text hover:underline">
                  Profile
                </Link>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-high text-text-muted font-bold">
                {activeVariant.label}
              </span>
              {activeVariant.isPrimary && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary/15 text-secondary font-bold">
                  Primary
                </span>
              )}
            </div>
          </div>

          <ResumeTargetSelector
            variantId={activeVariant.id}
            companies={companies.map((company) => ({ id: company.id, name: company.name }))}
            roles={roles.map((role) => ({ id: role.id, name: role.name }))}
            currentCompanyId={activeVariant.targetCompanyId}
            currentRoleId={activeVariant.targetRoleId}
            currentCompanyName={activeVariant.targetCompanyName}
            currentRoleName={activeVariant.targetRoleName}
          />
        </section>
      )}

      {/* Empty state */}
      {!activeVariant && (
        <section className="rounded-2xl border border-border bg-surface p-6 space-y-4">
          <h2 className="text-title-lg font-bold text-text-primary">Turn your resume into a targeted placement asset</h2>
          <p className="text-body-sm text-text-secondary max-w-3xl">
            Placement OS reads your document, scores how reliably an ATS can interpret it, compares it against your
            target role and job description, and tells you exactly what to improve — with every change verified against
            your own words.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] font-mono text-text-secondary">
            <li>• ATS compatibility score with a full breakdown</li>
            <li>• Resume ↔ job description keyword and skill match</li>
            <li>• Resume gap vs preparation gap, kept separate</li>
            <li>• Truth-preserving suggestions with before/after</li>
            <li>• ATS-safe builder with printable export</li>
            <li>• Targeted variants and version history</li>
          </ul>
        </section>
      )}

      {activeVariant && (
        <>
          <AtsScoreCard
            atsScore={activeVariant.atsScore}
            matchScore={activeVariant.matchScore}
            analysis={analysis}
          />

          {/* Recommendations digest (numbered, evidence-linked) */}
          {recommendations.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-3">
              <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
                Highest-priority findings
              </span>
              <ol className="space-y-3">
                {recommendations.map((finding, index) => (
                  <li key={finding.id} className="flex gap-3">
                    <span className="text-body-sm font-bold font-mono text-primary-text shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <span className="text-body-sm font-semibold text-text-primary block">{finding.title}</span>
                      <span className="text-[12px] font-mono text-text-secondary block mt-0.5">{finding.detail}</span>
                      {finding.evidence && (
                        <span className="text-[11px] font-mono text-text-muted block mt-0.5">
                          Evidence: {finding.evidence}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <SkillMatchPanel analysis={analysis} />
          <RoleMatchPanel
            analysis={analysis}
            targetRoleName={activeVariant.targetRoleName}
            targetCompanyName={activeVariant.targetCompanyName}
          />
          <KeywordMatchTable analysis={analysis} />
          <ParsingFindings analysis={analysis} />

          <JobDescriptionPanel variantId={activeVariant.id} jobDescription={activeVariant.jobDescription} />

          <SuggestionsPanel
            variantId={activeVariant.id}
            suggestions={activeVariant.suggestions}
            assertedSkills={assertedSkills}
          />

          <VersionHistory variantId={activeVariant.id} versions={activeVariant.versions} />

          {activeVariant.sourceFile && (
            <section className="rounded-2xl border border-border bg-surface p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
                  Original document
                </span>
                <span className="text-body-sm text-text-primary">{activeVariant.sourceFile.fileName}</span>
                <span className="text-[11px] font-mono text-text-muted block">
                  {activeVariant.sourceFile.wordCount} words ·{" "}
                  {activeVariant.sourceFile.pageCount ? `${activeVariant.sourceFile.pageCount} page(s) · ` : ""}
                  stored privately, owner-only download
                </span>
              </div>
              <a
                href={`/api/student/resume/files/${activeVariant.sourceFile.id}`}
                className="text-[12px] font-mono px-4 py-2 rounded-lg border border-border bg-surface-high text-text-secondary hover:text-text-primary transition-colors"
              >
                Download my upload
              </a>
            </section>
          )}
        </>
      )}

      <ResumeUploadPanel
        supportedFormats={workspace.supportedFormats}
        maxUploadBytes={workspace.maxUploadBytes}
        targetLabel={targetLabel}
        compact={Boolean(activeVariant)}
      />

      <VariantsPanel
        variants={workspace.variants}
        activeVariantId={activeVariant?.id ?? null}
        defaultTargetLabel={targetLabel}
      />
    </div>
  );
}
