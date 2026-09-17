import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getResumeVariant, getResumeWorkspace } from "@/server/resume-intelligence";
import { renderAtsHtml } from "@/lib/resume/ats-render";
import { ResumeBuilderEditor } from "@/components/resume/resume-builder-editor";

export default async function ResumeBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ variantId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/resume/builder");

  const userId = session.user.id;
  const { variantId } = await searchParams;

  const workspace = await getResumeWorkspace(userId);
  const targetVariantId = variantId ?? workspace.primaryVariant?.id ?? null;

  if (!targetVariantId) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-12">
        <h1 className="text-headline-lg font-bold text-text-primary">Resume Builder</h1>
        <p className="text-body-sm text-text-secondary">
          No resume variant exists yet. Upload a resume or create a variant first, then the ATS-safe builder becomes
          available.
        </p>
        <Link href="/resume" className="text-primary-text hover:underline text-body-sm">
          Back to Resume Intelligence
        </Link>
      </div>
    );
  }

  let variant;
  try {
    variant = await getResumeVariant(targetVariantId, userId);
  } catch {
    redirect("/resume");
  }

  const targetLine = [variant.targetCompanyName, variant.targetRoleName].filter(Boolean).length
    ? `Target: ${[variant.targetCompanyName, variant.targetRoleName].filter(Boolean).join(" — ")}`
    : null;

  const previewHtml = renderAtsHtml(variant.structured, { targetLine });
  const analysis = variant.analysis;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <header className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-label-xs font-mono uppercase tracking-widest text-primary mb-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>RESUME BUILDER</span>
            <span className="text-text-muted">/</span>
            <span className="text-text-secondary">ATS-SAFE FORMAT</span>
          </div>
          <h1 className="text-headline-lg font-bold text-text-primary tracking-tight">{variant.label}</h1>
          <p className="text-body-sm text-text-secondary mt-1">
            {targetLine ?? "No target set — the builder still produces a parser-friendly single-column document."}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <Link
            href={`/resume?variantId=${variant.id}`}
            className="text-body-sm font-semibold px-5 py-2.5 rounded-lg border border-border bg-surface-high text-text-secondary hover:text-text-primary transition-colors"
          >
            Back to analysis
          </Link>
          <a
            href={`/api/student/resume/variants/${variant.id}/export?format=txt`}
            className="text-body-sm font-semibold px-5 py-2.5 rounded-lg border border-border bg-surface-high text-text-secondary hover:text-text-primary transition-colors"
          >
            Export plain text
          </a>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-5 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">ATS compatibility</span>
          <span className="text-title-lg font-bold font-mono text-text-primary">
            {variant.atsScore !== null ? `${variant.atsScore} / 100` : "Not measured"}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">Target match</span>
          <span className="text-title-lg font-bold font-mono text-text-primary">
            {variant.matchScore !== null ? `${variant.matchScore}%` : "Not measured"}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">Pending suggestions</span>
          <span className="text-title-lg font-bold font-mono text-text-primary">
            {variant.suggestions.filter((suggestion) => suggestion.status === "pending").length}
          </span>
        </div>
        <div className="flex-1 min-w-[240px]">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">Format rules applied</span>
          <span className="text-[11px] font-mono text-text-secondary">
            Single column · standard headings · plain text layer · no tables, text boxes, icons, or graphics.
          </span>
        </div>
        {analysis && analysis.findings.length > 0 && (
          <div className="w-full border-t border-border/60 pt-3">
            <span className="text-[10px] font-mono uppercase text-text-muted font-bold block mb-1">
              Top finding in the current analysis
            </span>
            <span className="text-body-sm text-text-primary">{analysis.findings[0].title}</span>
            <span className="text-[11px] font-mono text-text-muted block">{analysis.findings[0].detail}</span>
          </div>
        )}
      </section>

      <ResumeBuilderEditor
        variantId={variant.id}
        structured={variant.structured}
        previewHtml={previewHtml}
        originalRawText={variant.originalRawText}
      />
    </div>
  );
}
