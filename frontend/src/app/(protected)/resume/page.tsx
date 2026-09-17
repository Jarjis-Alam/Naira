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
import { Eyebrow } from "@/components/ui/eyebrow";

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
      <header className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-circuit-border/60 pb-6">
        <div>
          <Eyebrow system="NEXORA" category="ATS RESUME INTELLIGENCE">
            WORKSPACE & SCORING
          </Eyebrow>
          <h1 className="font-heading text-headline-lg font-semibold text-phosphor-white tracking-tight">
            Resume Intelligence
          </h1>
          <p className="text-body-sm text-sage-60 mt-1 max-w-2xl">
            ATS parsing compatibility, target role and job description alignment, and truth-verified suggestions.
          </p>
        </div>
        {activeVariant && (
          <Link
            href={`/resume/builder?variantId=${activeVariant.id}`}
            className="bg-ground-iron text-phosphor-white font-medium text-body-sm px-6 py-2.5 rounded-buttons border border-circuit-border hover:border-lime-pulse transition-all inline-flex items-center gap-2 shadow-none self-start"
          >
            <span className="material-symbols-outlined text-[18px] text-lime-pulse">auto_fix_high</span>
            <span>Open Builder</span>
          </Link>
        )}
      </header>

      {/* Target Banner */}
      {activeVariant && (
        <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 space-y-4 shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-caption font-mono uppercase tracking-wider text-moss-70 font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-lime-pulse">track_changes</span>
                Target Alignment
              </span>
              <h2 className="font-heading text-title-md font-semibold text-phosphor-white mt-1">
                {targetLabel || "No target configured"}
              </h2>
              <p className="text-caption font-mono text-sage-40 mt-1">
                {workspace.targets.configured
                  ? "Inheriting your Phase 16 primary target. Variants preserve independent targets."
                  : "Set a target in Profile to align ATS analysis with a specific company and role."}
                {" · "}
                <Link href="/profile" className="text-fern-link hover:text-phosphor-white underline">
                  Profile
                </Link>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-pills bg-carbon-veil text-sage-60 border border-circuit-border font-medium">
                {activeVariant.label}
              </span>
              {activeVariant.isPrimary && (
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-pills bg-lime-pulse/15 text-phosphor-white border border-lime-pulse/40 font-semibold">
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

      {/* Zero-State */}
      {!activeVariant && (
        <section className="rounded-cards border border-dashed border-circuit-border bg-ground-iron/40 p-8 sm:p-10 space-y-4">
          <h2 className="font-heading text-title-md font-semibold text-phosphor-white">
            Turn your resume into a targeted placement asset
          </h2>
          <p className="text-body-sm text-sage-60 max-w-3xl leading-relaxed">
            Nexora ATS parses your document, scores machine readability, benchmarks against target job descriptions,
            and surfaces truth-verified improvements with factual-scope protections.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-caption font-mono text-sage-40">
            <li>• Deterministic ATS score with complete breakdown</li>
            <li>• Keyword and required skill coverage comparison</li>
            <li>• Resume gaps kept strictly separate from preparation gaps</li>
            <li>• Truth-preserving suggestions with exact source quotes</li>
            <li>• ATS-safe builder with raw plain text and semantic export</li>
            <li>• Role-targeted variants and version history snapshots</li>
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

          {/* Recommendations Digest */}
          {recommendations.length > 0 && (
            <section className="rounded-cards border border-circuit-border bg-ground-iron p-6 space-y-3 shadow-none">
              <span className="text-caption font-mono uppercase text-moss-70 font-medium block">
                Highest-Priority Findings
              </span>
              <ol className="space-y-3">
                {recommendations.map((finding, index) => (
                  <li key={finding.id} className="flex gap-3">
                    <span className="text-body-sm font-bold font-mono text-lime-pulse shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <span className="text-body-sm font-semibold text-phosphor-white block">
                        {finding.title}
                      </span>
                      <span className="text-caption font-mono text-sage-60 block mt-0.5">
                        {finding.detail}
                      </span>
                      {finding.evidence && (
                        <span className="text-[11px] font-mono text-sage-40 block mt-0.5">
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
            <section className="rounded-cards border border-circuit-border bg-ground-iron p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-caption font-mono uppercase text-moss-70 font-medium block">
                  Original Source Document
                </span>
                <span className="text-body-sm font-medium text-phosphor-white">
                  {activeVariant.sourceFile.fileName}
                </span>
                <span className="text-[11px] font-mono text-sage-40 block mt-0.5">
                  {activeVariant.sourceFile.wordCount} words ·{" "}
                  {activeVariant.sourceFile.pageCount ? `${activeVariant.sourceFile.pageCount} page(s) · ` : ""}
                  stored privately, owner-only download
                </span>
              </div>
              <a
                href={`/api/student/resume/files/${activeVariant.sourceFile.id}`}
                className="text-caption font-mono px-4 py-2 rounded-buttons border border-circuit-border bg-carbon-veil text-sage-60 hover:text-phosphor-white hover:border-lime-pulse transition-colors"
              >
                Download Uploaded File
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
