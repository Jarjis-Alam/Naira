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
import { PageHeader } from "@/components/ui/page-header";

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

  const breadcrumbs = [
    { label: "NEXORA", href: "/dashboard" },
    { label: "CORE OS", href: "/dashboard" },
    { label: "RESUME INTELLIGENCE" },
  ];

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      {/* ── Top Header ── */}
      <PageHeader
        breadcrumbs={breadcrumbs}
        title="Resume Intelligence"
        subtitle="ATS parsing compatibility, target role and job description alignment, and truth-verified suggestions."
        badge={{
          label: activeVariant ? "ATS CALIBRATED" : "NO RESUME",
          variant: activeVariant ? "green" : "neutral",
          ping: Boolean(activeVariant),
        }}
        actions={
          activeVariant ? (
            <Link
              href={`/resume/builder?variantId=${activeVariant.id}`}
              className="px-5 py-2 rounded-full bg-lime-pulse text-void-black font-semibold text-xs transition-all shadow-[0_0_15px_rgba(127,238,100,0.2)] hover:bg-mint-frost flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[17px]">auto_fix_high</span>
              <span>Open Builder</span>
            </Link>
          ) : undefined
        }
      />

      {/* ── Version Control Branch Selector ── */}
      {workspace.variants.length > 0 && (
        <section className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {workspace.variants.map((v) => {
            const isActive = activeVariant?.id === v.id;
            return (
              <Link
                key={v.id}
                href={`/resume?variantId=${v.id}`}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono transition-all shrink-0 ${
                  isActive
                    ? "bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30 font-semibold"
                    : "bg-[#191c1b] border border-[#3f4a38]/40 text-sage-40 hover:text-phosphor-white"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isActive ? "bg-lime-pulse animate-pulse" : "bg-sage-40/40"
                  }`}
                />
                <span>{v.label}</span>
                {v.isPrimary && (
                  <span className="text-[10px] uppercase font-bold text-lime-pulse">
                    (Active)
                  </span>
                )}
              </Link>
            );
          })}
        </section>
      )}

      {/* ── Target Alignment Banner ── */}
      {activeVariant && (
        <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 space-y-4 shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-lime-pulse font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">track_changes</span>
                Target Alignment
              </span>
              <h2 className="text-lg font-bold font-heading text-phosphor-white mt-1">
                {targetLabel || "No target configured"}
              </h2>
              <p className="text-xs text-sage-40 mt-1">
                {workspace.targets.configured
                  ? "Inheriting your Phase 16 primary target. Variants preserve independent targets."
                  : "Set a target in Profile to align ATS analysis with a specific company and role."}
                {" · "}
                <Link href="/profile" className="text-lime-pulse hover:underline">
                  Profile Target Settings →
                </Link>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase px-3 py-1 rounded-full bg-[#111413] text-sage-40 border border-[#3f4a38]/40 font-medium">
                {activeVariant.label}
              </span>
              {activeVariant.isPrimary && (
                <span className="text-xs font-mono uppercase px-3 py-1 rounded-full bg-lime-pulse/15 text-lime-pulse border border-lime-pulse/30 font-semibold">
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

      {/* ── Zero-State ── */}
      {!activeVariant && (
        <section className="rounded-2xl border border-dashed border-[#3f4a38]/60 bg-[#191c1b]/40 p-10 space-y-4 shadow-md">
          <h2 className="text-xl font-bold font-heading text-phosphor-white">
            Turn your resume into a targeted placement asset
          </h2>
          <p className="text-xs text-sage-40 max-w-3xl leading-relaxed">
            Nexora ATS parses your document, scores machine readability, benchmarks against target job descriptions,
            and surfaces truth-verified improvements with factual-scope protections.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-sage-40 pt-2">
            <li>• Deterministic ATS score with complete breakdown</li>
            <li>• Keyword and required skill coverage comparison</li>
            <li>• Resume gaps kept strictly separate from preparation gaps</li>
            <li>• Truth-preserving suggestions with exact source quotes</li>
            <li>• ATS-safe builder with raw plain text and semantic export</li>
            <li>• Role-targeted variants and version history snapshots</li>
          </ul>
        </section>
      )}

      {/* ── Active Variant Panels ── */}
      {activeVariant && (
        <>
          <AtsScoreCard
            atsScore={activeVariant.atsScore}
            matchScore={activeVariant.matchScore}
            analysis={analysis}
          />

          {/* Recommendations Findings */}
          {recommendations.length > 0 && (
            <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-6 space-y-3 shadow-md">
              <span className="text-xs font-mono uppercase text-lime-pulse font-semibold block">
                Highest-Priority Findings
              </span>
              <ol className="space-y-3">
                {recommendations.map((finding, index) => (
                  <li key={finding.id} className="flex gap-3">
                    <span className="text-sm font-bold font-mono text-lime-pulse shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-phosphor-white block">
                        {finding.title}
                      </span>
                      <span className="text-xs text-sage-40 block mt-0.5 leading-relaxed">
                        {finding.detail}
                      </span>
                      {finding.evidence && (
                        <span className="text-[11px] font-mono text-sage-40/80 block mt-0.5">
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
            <section className="rounded-2xl border border-[#3f4a38]/40 bg-[#191c1b] p-5 flex flex-wrap items-center justify-between gap-4 shadow-md">
              <div>
                <span className="text-xs font-mono uppercase text-sage-40 font-semibold block">
                  Original Source Document
                </span>
                <span className="text-sm font-medium text-phosphor-white">
                  {activeVariant.sourceFile.fileName}
                </span>
                <span className="text-xs font-mono text-sage-40 block mt-0.5">
                  {activeVariant.sourceFile.wordCount} words ·{" "}
                  {activeVariant.sourceFile.pageCount ? `${activeVariant.sourceFile.pageCount} page(s) · ` : ""}
                  stored privately, owner-only download
                </span>
              </div>
              <a
                href={`/api/student/resume/files/${activeVariant.sourceFile.id}`}
                className="text-xs font-mono px-4 py-2 rounded-full border border-[#3f4a38]/40 bg-[#111413] text-phosphor-white hover:border-lime-pulse hover:text-lime-pulse transition-all"
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
