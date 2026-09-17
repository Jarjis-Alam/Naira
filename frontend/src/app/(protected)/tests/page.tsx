import { auth } from "@/lib/auth";
import { getPublishedTests } from "@/server/tests";
import { TestCatalog } from "@/components/tests/test-catalog";
import { NexoraLogo } from "@/components/ui/nexora-logo";
import Link from "next/link";

export default async function TestCatalogPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const allTests = await getPublishedTests(session.user.id);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header & Strategic Breadcrumb */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex flex-col max-w-3xl">
          <div className="flex items-center gap-1.5 text-text-muted text-[12px] font-mono mb-1">
            <NexoraLogo size={16} />
            <span className="font-semibold text-white">NEXORA</span>
            <span className="text-border">/</span>
            <span>PREPARATION</span>
            <span className="text-border">/</span>
            <span className="text-white">TESTS &amp; PRACTICE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display">
            Diagnostic Tests &amp; Adaptive Practice
          </h1>
          <p className="text-sm text-text-secondary mt-1 leading-relaxed">
            Calibrated question banks, algorithmic pressure tests, and targeted weak-spot drills synchronized with Tier-1 placement rubrics.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-end">
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-text-primary text-xs font-semibold transition-all border border-outline-variant/40 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>History &amp; Logs</span>
          </Link>
          <Link
            href="/roadmap"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black font-semibold text-xs hover:bg-zinc-200 active:scale-95 transition-all shadow-md"
          >
            <span className="material-symbols-outlined text-[16px]">alt_route</span>
            <span>View Roadmap</span>
          </Link>
        </div>
      </div>

      {/* Catalog Component with Metrics, Search, Filters, and Cards */}
      <TestCatalog tests={allTests} />
    </div>
  );
}
