import Link from "next/link";
import { NexoraLogo } from "@/components/ui/nexora-logo";

export const metadata = {
  title: "Terms of Service — NAIRA",
  description: "NAIRA terms of service, acceptable use, academic integrity guidelines, and placement non-warranty disclaimers.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-void-black text-sage-60 selection:bg-white/20 selection:text-white flex flex-col justify-between antialiased">
      {/* Top Header */}
      <header className="border-b border-circuit-border/60 bg-carbon-veil/60 backdrop-blur-md sticky top-0 z-30">
        <div className="container-fluid py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <NexoraLogo size={22} className="opacity-80 group-hover:opacity-100 transition-opacity" />
            <span className="font-heading font-medium tracking-[0.22em] text-xs text-white uppercase">
              NAIRA
            </span>
          </Link>

          <div className="flex items-center gap-4 text-xs font-mono">
            <Link
              href="/"
              className="text-sage-40 hover:text-white transition-colors"
            >
              ← Back to Overview
            </Link>
            <Link
              href="/auth/login"
              className="px-3.5 py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white hover:text-black text-white transition-all font-sans font-medium"
            >
              Candidate Login
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-fluid max-w-4xl py-12 sm:py-16 space-y-10">
        <div className="space-y-3 border-b border-circuit-border pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-[#121316] text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse" />
            <span>Candidate Protocol & Agreement</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-phosphor-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-body-sm text-sage-40 font-mono">
            Last Updated: October 2026 • Version 1.0 (Production)
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            1. Acceptance of Terms
          </h2>
          <p className="text-body-sm leading-relaxed text-sage-60">
            By creating an account, accessing, or utilizing the NAIRA Placement Operating System (&ldquo;NAIRA&rdquo; or the &ldquo;Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access or use the platform.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            2. Candidate Accounts & Integrity
          </h2>
          <p className="text-body-sm leading-relaxed text-sage-60">
            You must provide accurate and verifiable academic information during registration. You are responsible for safeguarding your credentials and for all activities conducted through your account.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-body-sm text-sage-60">
            <li>
              <strong className="text-phosphor-white font-medium">Single Candidate Identity:</strong> Accounts are assigned to individual students. Sharing credentials or impersonating candidates is strictly prohibited.
            </li>
            <li>
              <strong className="text-phosphor-white font-medium">Diagnostic Honesty:</strong> NAIRA benchmarks, baseline exams, and practice simulations are designed to isolate individual strengths and conceptual deficits. Automated scripts or coordinated answer copying defeat the diagnostic utility of the system.
            </li>
          </ul>
        </section>

        {/* Section 3 — Placement Disclaimer */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            3. Placement Disclaimer & Non-Warranty
          </h2>
          <div className="rounded-xl border border-circuit-border bg-ground-iron p-5 space-y-3">
            <h3 className="text-title-sm font-semibold text-phosphor-white flex items-center gap-2">
              <span className="material-symbols-outlined text-lime-pulse text-[18px]">info</span>
              <span>Diagnostic Preparation Notice</span>
            </h3>
            <p className="text-body-sm leading-relaxed text-sage-60">
              NAIRA is an independent placement preparation platform. Readiness percentages, ATS scores, subject competency radar ratings, and mock company simulations are analytical evaluations engineered for self-assessment and practice.
            </p>
            <p className="text-body-sm leading-relaxed text-sage-60">
              <strong className="text-phosphor-white font-medium">
                NAIRA does not guarantee employment, internship offers, interview invitations, or selection by any company or recruiting entity.
              </strong> Company hiring criteria and cutoffs are determined exclusively by respective hiring organizations.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            4. User-Submitted Content & Documents
          </h2>
          <p className="text-body-sm leading-relaxed text-sage-60">
            You retain all ownership rights to resumes, project descriptions, and academic documents you upload to NAIRA. By uploading documents, you grant NAIRA a limited, non-exclusive license solely to process, parse, and analyze your text to provide ATS calibration, readiness scores, and personalized practice recommendations.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            5. Intellectual Property
          </h2>
          <p className="text-body-sm leading-relaxed text-sage-60">
            All curriculum content, question banks, benchmark algorithms, interfaces, and branding belonging to NAIRA are protected by applicable intellectual property laws. You may not scrape, reverse engineer, extract, or redistribute NAIRA&apos;s curriculum or evaluation engines without prior written authorization.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            6. Service Availability & Modifications
          </h2>
          <p className="text-body-sm leading-relaxed text-sage-60">
            We continuously refine questions and diagnostic benchmarks to reflect industry hiring patterns. We reserve the right to modify curriculum benchmarks, update features, or perform essential maintenance without prior notice.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            7. Contact &amp; Platform Governance
          </h2>
          <p className="text-body-sm leading-relaxed text-sage-60">
            For governance questions, institutional integration inquiries, or terms clarification, contact your designated campus placement administration or institutional coordinator:
          </p>
          <div className="rounded-xl border border-circuit-border bg-ground-iron p-4 text-xs font-mono text-sage-40 space-y-1">
            <p className="text-phosphor-white font-semibold">Institutional Placement Administration</p>
            <p>Channel: Designated Campus Placement Cell / Institutional Administrator</p>
            <p>Purpose: Candidate Terms &amp; Platform Governance</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-circuit-border/60 bg-carbon-veil/40 py-6 text-center text-xs font-mono text-sage-40">
        <div className="container-fluid flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>NAIRA Placement Operating System • High-Signal Engineering</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors underline">
              Privacy Policy
            </Link>
            <Link href="/" className="hover:text-white transition-colors underline">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
