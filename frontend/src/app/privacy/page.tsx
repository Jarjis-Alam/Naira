import Link from "next/link";
import { NexoraLogo } from "@/components/ui/nexora-logo";

export const metadata = {
  title: "Privacy Policy — NAIRA",
  description: "NAIRA candidate data handling, resume document processing, authentication session cookies, and data retention guidelines.",
};

export default function PrivacyPolicyPage() {
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
            <span>Data Transparency Protocol</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-phosphor-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-body-sm text-sage-40 font-mono">
            Last Updated: October 2026 • Version 1.1 (Production)
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            1. Platform Context &amp; Purpose
          </h2>
          <p className="text-body-sm leading-relaxed text-sage-60">
            NAIRA operates an intelligent placement-preparation operating system designed for engineering college students. This policy outlines how candidate data, assessment records, and uploaded documents are handled. NAIRA does not sell, broker, or license candidate data or uploaded resumes to advertising networks or third-party marketing brokers.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            2. Data We Collect
          </h2>
          <p className="text-body-sm leading-relaxed text-sage-60">
            NAIRA collects only the data required to support diagnostic testing, benchmark tracking, and placement readiness analysis:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-body-sm text-sage-60">
            <li>
              <strong className="text-phosphor-white font-medium">Account Credentials:</strong> Full name, email address, password (stored using bcrypt one-way hashing), college name, academic branch, graduation year, and preferred programming language.
            </li>
            <li>
              <strong className="text-phosphor-white font-medium">Assessment Telemetry:</strong> Submitted question responses, question timestamps, accuracy scores, sub-topic performance breakdowns, and mock placement simulation logs.
            </li>
            <li>
              <strong className="text-phosphor-white font-medium">Resume Documents:</strong> File name, MIME type, byte size, raw document payload, and plain text extracted from candidate-uploaded PDF, DOCX, or TXT documents.
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            3. Document Storage &amp; Processing Architecture
          </h2>
          <div className="rounded-xl border border-circuit-border bg-ground-iron p-5 space-y-3">
            <h3 className="text-title-sm font-semibold text-phosphor-white flex items-center gap-2">
              <span className="material-symbols-outlined text-lime-pulse text-[18px]">storage</span>
              <span>Database Storage &amp; Local Text Parsing</span>
            </h3>
            <p className="text-body-sm leading-relaxed text-sage-60">
              Uploaded resume files are stored directly in the application&apos;s PostgreSQL database (<code className="text-zinc-300 font-mono text-xs">resume_files</code> table) associated with the candidate&apos;s authenticated account ID. Document text extraction is executed locally on the server using specialized parser libraries (<code className="text-zinc-300 font-mono text-xs">pdf-parse</code> and <code className="text-zinc-300 font-mono text-xs">mammoth</code>).
            </p>
            <p className="text-body-sm leading-relaxed text-sage-60">
              <strong className="text-phosphor-white font-medium">ATS Scoring:</strong> ATS keyword density analysis, competency matching, and score evaluations run entirely on the server using deterministic TypeScript logic. Resumes and ATS scoring calculations are not transmitted to external LLM APIs.
            </p>
            <p className="text-body-sm leading-relaxed text-sage-60">
              <strong className="text-phosphor-white font-medium">AI Interview Coach:</strong> When a candidate explicitly launches an AI Mock Interview session, interview question generation and response evaluations are sent server-side to the Groq Cloud API using the configured model. Resume documents are not transmitted during interview coach sessions.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            4. Cookies &amp; Storage Architecture
          </h2>
          <p className="text-body-sm leading-relaxed text-sage-60">
            NAIRA uses only cookies strictly necessary to provide authentication sessions and security. Optional tracking cookies, marketing cookies, and third-party advertising pixels are not present in the application.
          </p>
          <div className="overflow-x-auto rounded-xl border border-circuit-border bg-ground-iron">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-circuit-border bg-carbon-veil text-sage-40 uppercase">
                <tr>
                  <th className="p-3">Cookie Name</th>
                  <th className="p-3">Purpose</th>
                  <th className="p-3">Classification</th>
                  <th className="p-3">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-circuit-border text-sage-60">
                <tr>
                  <td className="p-3 text-phosphor-white font-semibold">authjs.session-token</td>
                  <td className="p-3">Maintains the authenticated candidate session across requests</td>
                  <td className="p-3">Authentication</td>
                  <td className="p-3">Session / 30 Days</td>
                </tr>
                <tr>
                  <td className="p-3 text-phosphor-white font-semibold">authjs.csrf-token</td>
                  <td className="p-3">Secures authentication requests against Cross-Site Request Forgery</td>
                  <td className="p-3">Security</td>
                  <td className="p-3">Session</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-body-sm leading-relaxed text-sage-60">
            <strong className="text-phosphor-white font-medium">Client Storage:</strong> NAIRA does not store candidate data in browser <code className="text-zinc-300 font-mono text-xs">localStorage</code>. Browser <code className="text-zinc-300 font-mono text-xs">sessionStorage</code> is used solely by administrators to temporarily buffer draft previews in the test builder.
          </p>
          <p className="text-xs text-sage-40 leading-relaxed font-mono">
            Note: Because NAIRA only uses cookies strictly required for authentication and security functions, the application does not deploy a marketing cookie preference banner. Whether specific jurisdictions classify session cookies as exempt from consent requirements depends on applicable local laws.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            5. Candidate Rights &amp; Data Deletion
          </h2>
          <p className="text-body-sm leading-relaxed text-sage-60">
            Candidates can review their academic profile details, test scores, and uploaded resume variants directly within the application.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-body-sm text-sage-60">
            <li>
              <strong className="text-phosphor-white font-medium">Access &amp; Review:</strong> Profile information, competency radar scores, and historical assessment records can be accessed through your Candidate Profile and dashboard.
            </li>
            <li>
              <strong className="text-phosphor-white font-medium">Account &amp; Data Deletion Process:</strong> Automated self-service account deletion is not currently implemented in the platform architecture. To request account deletion or purging of assessment records and resume files, candidates must submit a deletion request to their institutional placement administrator or platform administrator.
            </li>
            <li>
              <strong className="text-phosphor-white font-medium">Database Cascade:</strong> When an administrator removes a candidate account, associated records across profile information, test attempts, question responses, and uploaded resume files are deleted from the database via PostgreSQL foreign key cascade constraints.
            </li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold text-phosphor-white">
            6. Support &amp; Administrative Inquiries
          </h2>
          <p className="text-body-sm leading-relaxed text-sage-60">
            For data inquiries, access requests, or deletion assistance, contact your institutional placement administration:
          </p>
          <div className="rounded-xl border border-circuit-border bg-ground-iron p-4 text-xs font-mono text-sage-40 space-y-1">
            <p className="text-phosphor-white font-semibold">Institutional Placement Administration</p>
            <p>Channel: Contact your designated campus placement cell coordinator or platform administrator</p>
            <p>Purpose: Academic Placement Preparation &amp; Candidate Support</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-circuit-border/60 bg-carbon-veil/40 py-6 text-center text-xs font-mono text-sage-40">
        <div className="container-fluid flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>NAIRA Placement Operating System • High-Signal Engineering</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-white transition-colors underline">
              Terms of Service
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
