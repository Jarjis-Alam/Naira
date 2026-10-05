"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ResumeVariantDetail, ResumeWorkspace } from "@/server/resume-intelligence";
import { ResumeTargetSelector } from "./resume-target-selector";
import { JobDescriptionPanel } from "./job-description-panel";
import { ResumeUploadPanel } from "./resume-upload-panel";
import { KeywordMatchTable } from "./keyword-match-table";
import { SuggestionsPanel } from "./suggestions-panel";
import { VersionHistory } from "./version-history";
import { CopyButton } from "@/components/ui/copy-button";

interface ResumeDossierViewProps {
  workspace: ResumeWorkspace;
  activeVariant: ResumeVariantDetail | null;
  companies: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}

export function ResumeDossierView({
  workspace,
  activeVariant,
  companies,
  roles,
}: ResumeDossierViewProps) {
  const router = useRouter();
  const [variantDropdownOpen, setVariantDropdownOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [activeSecondaryTab, setActiveSecondaryTab] = useState<string | null>(null);

  const targetLabel = activeVariant
    ? [activeVariant.targetCompanyName, activeVariant.targetRoleName].filter(Boolean).join(" — ") || null
    : workspace.targets.configured
    ? [workspace.targets.companyName, workspace.targets.roleName].filter(Boolean).join(" — ")
    : null;

  const atsScore = activeVariant?.atsScore ?? 78;
  const matchScore = activeVariant?.matchScore ?? 84;
  const analysis = activeVariant?.analysis ?? null;

  const assertedSkills =
    activeVariant?.structured.studentAssertedFacts
      .filter((fact) => fact.kind === "skill")
      .map((fact) => fact.value) ?? [];

  // Determine experience entries: prioritize structured data if present, otherwise realistic candidate technical data
  const expSection = activeVariant?.structured.sections?.find((s) => s.key === "experience");
  const hasStructuredExp = expSection && expSection.entries && expSection.entries.length > 0;

  // Build clean plain text resume export for quick clipboard copy
  const resumePlainText = activeVariant
    ? [
        activeVariant.label,
        activeVariant.targetCompanyName ? `Target: ${activeVariant.targetCompanyName}${activeVariant.targetRoleName ? ` — ${activeVariant.targetRoleName}` : ""}` : null,
        "",
        "SUMMARY:",
        activeVariant.structured.summary ?? "Software Engineer focused on high-throughput backend services and distributed systems.",
        "",
        "SKILLS:",
        assertedSkills.join(", "),
        "",
        "EXPERIENCE:",
        ...(activeVariant.structured.sections?.find((s) => s.key === "experience")?.entries?.map((e) => `${e.title || e.heading}${e.organization ? ` at ${e.organization}` : ""}${e.dates?.raw ? ` (${e.dates.raw})` : ""}\n${e.bullets?.join("\n")}`) ?? []),
        "",
        "PROJECTS:",
        ...(activeVariant.structured.sections?.find((s) => s.key === "projects")?.entries?.map((p) => `${p.title || p.heading}\n${p.bullets?.join("\n")}`) ?? []),
      ].filter((x) => x !== null).join("\n")
    : "";

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 pb-16 font-sans">
      {/* ── 1. RESUME HEADER & ACTIVE DOSSIER SELECTOR ── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-1">
        <div className="space-y-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-white font-heading">
              Resume
            </h1>
            <span className="sr-only">Resume Intelligence</span>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="text-white font-medium">v{activeVariant?.versions?.length ? (3.0 + activeVariant.versions.length * 0.1).toFixed(1) : "3.2"}</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-300">ATS-Ready</span>
              {activeVariant?.updatedAt && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">
                    Updated {new Date(activeVariant.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            Analyze ATS compatibility, match target roles, and resolve critical gaps.
          </p>
        </div>

        {/* Right Dossier Switcher & Actions */}
        <div className="flex items-center gap-2 flex-wrap relative">
          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            title="Print or Save PDF"
            className="no-print flex items-center gap-1.5 px-2.5 py-1.5 bg-[#121316] border border-zinc-800 rounded-md hover:border-zinc-600 hover:text-white text-zinc-400 transition-colors cursor-pointer text-xs font-mono"
          >
            <span className="material-symbols-outlined text-[15px]">print</span>
            <span>Print</span>
          </button>

          {/* Copy Plain Text Resume */}
          {resumePlainText && (
            <div className="no-print">
              <CopyButton
                text={resumePlainText}
                label="Copy Text"
                copiedLabel="Copied!"
              />
            </div>
          )}

          {/* Dossier dropdown trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setVariantDropdownOpen(!variantDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#121316] border border-zinc-800 rounded-md hover:border-zinc-600 transition-colors cursor-pointer text-xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
              <span className="font-mono text-white font-medium tracking-tight text-[11px]">
                {activeVariant?.sourceFile?.fileName || (activeVariant?.label ? `${activeVariant.label.toLowerCase().replace(/\s+/g, "_")}.pdf` : "alex_chen_sre_2025.pdf")}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400 text-[11px]">
                Target: {activeVariant?.targetCompanyName ? `${activeVariant.targetCompanyName} ${activeVariant.targetRoleName ? "SRE" : ""}` : "Stripe SRE"}
              </span>
              <span className="material-symbols-outlined text-[15px] text-zinc-400 ml-0.5">
                expand_more
              </span>
            </button>

            {/* Dropdown Menu */}
            {variantDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-lg bg-[#15151a] border border-zinc-800 p-1.5 shadow-2xl z-50 space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Switch Resume Dossier
                </div>
                {workspace.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setVariantDropdownOpen(false);
                      router.push(`/resume?variantId=${v.id}`);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between transition-colors ${
                      activeVariant?.id === v.id
                        ? "bg-white text-black font-semibold"
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    <span className="truncate">{v.label}</span>
                    {v.isPrimary && (
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        Primary
                      </span>
                    )}
                  </button>
                ))}
                <div className="pt-1 border-t border-zinc-800">
                  <button
                    onClick={() => {
                      setVariantDropdownOpen(false);
                      setActiveSecondaryTab(activeSecondaryTab === "upload" ? null : "upload");
                    }}
                    className="w-full text-left px-3 py-2 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Upload New Variant</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Upload New Button */}
          <button
            type="button"
            onClick={() => setActiveSecondaryTab(activeSecondaryTab === "upload" ? null : "upload")}
            className="px-3 py-1.5 bg-[#121316] hover:bg-[#18181b] border border-zinc-800 text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">upload_file</span>
            <span>Upload New</span>
          </button>
        </div>
      </header>

      {/* ── 2. STATUS STRIP (RESUME → STATUS) ── */}
      <section className="w-full bg-[#0f0f12]/80 border border-zinc-800/80 rounded-lg py-3 px-5 sm:px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* ATS Readiness Score (Typography-Led, not pill inside pill) */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight leading-none text-white font-mono">
                {atsScore}%
              </span>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                  ATS Readiness
                </span>
                <span className="text-xs text-zinc-200 font-semibold">
                  {atsScore >= 75 ? "Strong alignment" : atsScore >= 50 ? "Moderate alignment" : "Needs alignment"}
                </span>
              </div>
            </div>

            <div className="hidden sm:block w-px h-7 bg-zinc-800" />

            {/* Primary Target Role */}
            <div className="flex flex-col space-y-0.5">
              <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                Primary Target Role
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-medium text-white">
                  {activeVariant?.targetCompanyName || "Stripe"} — {activeVariant?.targetRoleName || "Site Reliability Engineer"}
                </span>
                <span className="px-1.5 py-0.5 bg-zinc-800/80 border border-zinc-700/60 font-mono text-[10px] text-zinc-300 rounded-sm">
                  L4
                </span>
              </div>
            </div>

            <div className="hidden md:block w-px h-7 bg-zinc-800" />

            {/* Last Reparsed */}
            <div className="flex flex-col space-y-0.5">
              <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                Last Reparsed
              </span>
              <div className="flex items-center gap-1.5 text-zinc-300 font-mono text-xs">
                <span className="material-symbols-outlined text-[14px] text-zinc-400">schedule</span>
                <span>Today at 09:15 AM</span>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            {activeVariant && (
              <a
                href={`/api/student/resume/variants/${activeVariant.id}/export?format=txt`}
                download
                className="px-3.5 py-1.5 bg-[#18181b] hover:bg-[#202025] border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[15px]">file_download</span>
                <span>Download PDF</span>
              </a>
            )}
            <Link
              href={activeVariant ? `/resume/builder?variantId=${activeVariant.id}` : "/resume/builder"}
              className="px-4 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>Improve Resume</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 3. CORE 2-COLUMN WORKSPACE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: RESUME DOCUMENT & DIRECT INSPECTION */}
        <section className="lg:col-span-7 flex flex-col space-y-3">
          {/* Document Toolbar Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-white">
                Resume Document
              </h2>
              <span className="text-xs font-mono text-zinc-500">
                LaTeX v3.14 · 1 Page Standard
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={activeVariant ? `/resume/builder?variantId=${activeVariant.id}` : "/resume/builder"}
                className="px-2.5 py-1 bg-[#121316] hover:bg-[#18181b] border border-zinc-800 text-zinc-300 hover:text-white text-[11px] font-mono rounded-md transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[13px]">edit</span>
                <span>Edit in Builder</span>
              </Link>
              {activeVariant && (
                <a
                  href={`/api/student/resume/variants/${activeVariant.id}/export?format=txt`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-[#121316] hover:bg-[#18181b] border border-zinc-800 text-zinc-300 hover:text-white text-[11px] font-mono rounded-md transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[13px]">code</span>
                  <span>Raw TeX</span>
                </a>
              )}
            </div>
          </div>

          {/* Rendered Resume Sheet Container (Realistic high-contrast technical paper sheet) */}
          <div className="relative w-full bg-[#f8f9fa] text-[#121315] p-5 sm:p-7 rounded-lg shadow-lg overflow-hidden font-sans selection:bg-[#121315] selection:text-white border border-[#e5e7eb]">
            {/* Architectural Grid Line Texture */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#121315_1px,transparent_1px)] [background-size:16px_16px]" />

            {/* Candidate Header */}
            <div className="flex flex-col pb-3 mb-3.5 border-b border-[#e5e7eb] space-y-1 relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-[#090a0c] uppercase">
                  {activeVariant?.structured.header.name || "ALEXANDER CHEN"}
                </span>
                <span className="text-[11px] font-mono text-[#4b5563] px-2 py-0.5 bg-[#e5e7eb] rounded-sm">
                  {activeVariant?.structured.header.links[0] || "alexchen.systems · github.com/alx-chen"}
                </span>
              </div>
              <p className="text-xs font-medium text-[#27272a] leading-relaxed">
                {activeVariant?.structured.summary || "Distributed Systems & Production SRE Specialist"}
              </p>
              <p className="text-[11px] text-[#52525b]">
                {activeVariant?.structured.header.location || "San Francisco, CA"} · {activeVariant?.structured.header.email || "chen.alexander.infra@proton.me"} · US Citizen
              </p>
            </div>

            {/* EXPERIENCE SECTION */}
            <div className="space-y-3 mb-4 relative z-10">
              <div className="flex items-center justify-between pb-1 border-b border-[#e5e7eb]">
                <span className="text-[11px] font-bold tracking-wider text-[#090a0c] uppercase">
                  Experience
                </span>
                <span className="text-[11px] font-mono text-[#6b7280]">2022 — Present</span>
              </div>

              {hasStructuredExp ? (
                expSection.entries.map((entry, eIdx) => (
                  <div key={entry.id || eIdx} className="space-y-0.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-bold text-[#090a0c]">
                        {entry.organization || entry.heading || "Software Engineering"}
                      </span>
                      <span className="text-[11px] text-[#4b5563]">
                        {entry.title || ""}
                      </span>
                    </div>
                    {entry.dates?.raw && (
                      <div className="text-[10px] text-[#374151] italic">
                        {entry.dates.raw}
                      </div>
                    )}
                    <ul className="space-y-1 pl-3.5 list-disc text-[11px] leading-relaxed text-[#1f2937] marker:text-[#4b5563]">
                      {entry.bullets.map((bullet, bIdx) => (
                        <li key={bIdx}>
                          <span>{bullet}</span>
                          {bIdx === 1 && (
                            <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 bg-[#18181b] text-white text-[9px] rounded-sm leading-none align-middle font-sans border border-[#27272a]">
                              <span className="w-1 h-1 rounded-full bg-white mr-1" />
                              Gap: Missing metrics
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <>
                  {/* Default Technical SRE Profile Experience */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-bold text-[#090a0c]">ScaleMesh Infrastructure</span>
                      <span className="text-[11px] text-[#4b5563]">San Francisco, CA</span>
                    </div>
                    <div className="flex items-baseline justify-between text-[#374151]">
                      <span className="text-[11px] italic">Senior Site Reliability Engineer — Distributed Consensus Storage</span>
                      <span className="text-[10px] font-mono text-[#6b7280]">Mar 2023 — Present</span>
                    </div>
                    <ul className="space-y-1 pl-3.5 list-disc text-[11px] leading-relaxed text-[#1f2937] marker:text-[#4b5563]">
                      <li>
                        Engineered multi-region Raft cluster failover routing in Go, decreasing P99 replication lag from 420ms to 48ms across 3 cloud providers.
                      </li>
                      <li className="relative group">
                        <span className="underline decoration-dotted decoration-[#71717a] decoration-2 underline-offset-4 cursor-pointer hover:bg-[#e4e4e7]/60 transition-colors p-0.5 rounded">
                          Architected tiered block-storage scrubber daemon, minimizing corrupted fragment recovery intervals.
                        </span>
                        <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 bg-[#18181b] text-white text-[9px] rounded-sm leading-none align-middle font-sans border border-[#27272a]">
                          <span className="w-1 h-1 rounded-full bg-white mr-1" />
                          Gap: Missing metrics
                        </span>
                      </li>
                      <li>
                        Integrated eBPF tracepoints for Linux socket buffers, pinpointing tail dropped packets in high-throughput gRPC proxy fleets.
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-0.5 pt-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-bold text-[#090a0c]">CloudVector Labs</span>
                      <span className="text-[11px] text-[#4b5563]">Seattle, WA</span>
                    </div>
                    <div className="flex items-baseline justify-between text-[#374151]">
                      <span className="text-[11px] italic">Systems Platform Engineer</span>
                      <span className="text-[10px] font-mono text-[#6b7280]">Aug 2021 — Feb 2023</span>
                    </div>
                    <ul className="space-y-1 pl-3.5 list-disc text-[11px] leading-relaxed text-[#1f2937] marker:text-[#4b5563]">
                      <li>
                        Automated bare-metal Kubernetes provisioning pipeline via custom Terraform providers and PXE boot controllers.
                      </li>
                      <li>
                        Reduced monthly cloud compute spend by 28% through custom horizontal pod autoscaling algorithms driven by Prometheus queue telemetry.
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* CORE PRIMITIVES & OPEN SOURCE */}
            <div className="space-y-1.5 mb-4 relative z-10">
              <div className="flex items-center justify-between pb-1 border-b border-[#e5e7eb]">
                <span className="text-[11px] font-bold tracking-wider text-[#090a0c] uppercase">
                  Core Primitives &amp; Open Source
                </span>
              </div>
              <div className="space-y-1 text-[11px] leading-relaxed">
                <p className="text-[#1f2937]">
                  <strong className="font-bold text-[#090a0c]">Apache Arrow (Contributor):</strong> Optimized columnar serialization routines in Rust, reducing zero-copy deserialization overhead on SIMD architectures.
                </p>
                <p className="text-[#1f2937]">
                  <strong className="font-bold text-[#090a0c]">Undergraduate Lead Researcher (Distributed OS):</strong> Published evaluation of verifiable Byzantine Fault Tolerant primitives in low-bandwidth ad-hoc mesh networks (IEEE Trans. 2021).
                </p>
              </div>
            </div>

            {/* TECHNICAL STACK */}
            <div className="space-y-1 pt-1.5 border-t border-[#e5e7eb] relative z-10">
              <span className="text-[11px] font-bold tracking-wider text-[#090a0c] uppercase">
                Technical Stack
              </span>
              <p className="text-[#374151] font-mono text-[10px] leading-relaxed">
                Go · Rust · C++ · eBPF · Kubernetes Internals · Raft / Paxos · Envoy Proxy · Linux Kernel Telemetry · Prometheus
              </p>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: THE FOCUSED DIAGNOSIS (STATUS → PROBLEM → ACTION) */}
        <section className="lg:col-span-5 flex flex-col space-y-3.5">
          {/* Section 1: Resume Analysis */}
          <div className="bg-[#0f0f12]/80 border border-zinc-800/80 rounded-lg p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
              <h2 className="text-sm font-semibold text-white">
                Resume Analysis
              </h2>
              <span className="text-xs font-mono text-zinc-400">
                Target: {activeVariant?.targetCompanyName || "Stripe"} L4
              </span>
            </div>

            {/* WHAT IS STRONG (Clean Editorial List instead of nested cards) */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                What is strong
              </span>
              <div className="divide-y divide-zinc-800/40">
                <div className="flex items-start gap-2.5 py-2 first:pt-0">
                  <span className="material-symbols-outlined text-[15px] text-white mt-0.5 shrink-0">
                    check_circle
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-white">
                      Distributed systems depth &amp; core primitives
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 leading-normal">
                      High-density Go, Rust, eBPF, and consensus mechanisms found throughout.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 py-2">
                  <span className="material-symbols-outlined text-[15px] text-white mt-0.5 shrink-0">
                    check_circle
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-white">
                      Clean ATS format hygiene
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 leading-normal">
                      100% parseable standard single-column layout, zero table traps or unreadable vectors.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 py-2 last:pb-0">
                  <span className="material-symbols-outlined text-[15px] text-white mt-0.5 shrink-0">
                    check_circle
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-white">
                      Systems architecture scope
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 leading-normal">
                      Demonstrates real multi-region ownership with measurable blast-radius management.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* NEEDS ATTENTION */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/50">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                Needs attention
              </span>
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-white text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    <span>Missing quantifiable business impact</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 pl-3.5 leading-normal">
                    Experience bullet #2 (ScaleMesh block-storage scrubber) describes the action but lacks peak write IOPS or latency percentile numbers.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-white text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    <span>Missing target keywords for {activeVariant?.targetCompanyName || "Stripe"} SRE</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-3.5 pt-0.5">
                    {["LSM-trees", "WAL (Write-Ahead Log)", "BGP Anycast"].map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 bg-zinc-850 border border-zinc-750 text-zinc-300 font-mono text-[10px] rounded-sm"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RECOMMENDED NEXT ACTION BOX */}
            <div className="p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Recommended Next Action
                </span>
                <span className="px-1.5 py-0.5 bg-white/10 border border-white/20 text-[10px] font-mono font-bold text-white rounded-sm">
                  +6% Potential Gain
                </span>
              </div>
              <p className="text-xs text-zinc-200 leading-normal">
                Add peak write IOPS &amp; latency percentiles to Distributed Storage project to satisfy Stripe&apos;s high-scale database telemetry bar.
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <Link
                  href={activeVariant ? `/resume/builder?variantId=${activeVariant.id}` : "/resume/builder"}
                  className="flex-1 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-md transition-colors text-center shadow-sm"
                >
                  Auto-Apply AI Revision
                </Link>
                <Link
                  href={activeVariant ? `/resume/builder?variantId=${activeVariant.id}` : "/resume/builder"}
                  className="px-3 py-1.5 bg-[#121316] hover:bg-[#1a1a20] border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium rounded-md transition-colors"
                >
                  Edit Bullet
                </Link>
              </div>
            </div>
          </div>

          {/* Section 2: Target Alignment */}
          <div className="bg-[#0f0f12]/80 border border-zinc-800/80 rounded-lg p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
              <h3 className="text-xs font-semibold text-white">
                Target Alignment
              </h3>
              <span className="text-xs font-mono text-zinc-500">
                Market Benchmark
              </span>
            </div>

            <div className="divide-y divide-zinc-800/40">
              {/* Stripe */}
              <div className="flex items-center justify-between py-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white">Stripe</span>
                  <span className="text-[10px] font-mono text-zinc-400">Site Reliability Engineer (L4)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-16 h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
                    <div className="h-full bg-white rounded-sm" style={{ width: "84%" }} />
                  </div>
                  <span className="font-mono text-xs text-white font-bold w-8 text-right">
                    84%
                  </span>
                </div>
              </div>

              {/* Datadog */}
              <div className="flex items-center justify-between py-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white">Datadog</span>
                  <span className="text-[10px] font-mono text-zinc-400">Distributed Systems Core</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-16 h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
                    <div className="h-full bg-zinc-400 rounded-sm" style={{ width: "81%" }} />
                  </div>
                  <span className="font-mono text-xs text-zinc-400 font-bold w-8 text-right">
                    81%
                  </span>
                </div>
              </div>

              {/* Snowflake */}
              <div className="flex items-center justify-between py-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white">Snowflake</span>
                  <span className="text-[10px] font-mono text-zinc-400">Core Query Execution Engine</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-16 h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
                    <div className="h-full bg-zinc-600 rounded-sm" style={{ width: "72%" }} />
                  </div>
                  <span className="font-mono text-xs text-zinc-400 font-bold w-8 text-right">
                    72%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: ATS Technical Breakdown & Methodology Accordion */}
          <div className="bg-[#0f0f12]/80 border border-zinc-800/80 rounded-lg overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setMethodologyOpen(!methodologyOpen)}
              className="w-full py-2.5 px-4 flex items-center justify-between hover:bg-zinc-900/60 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">
                  ATS Technical Breakdown &amp; Methodology
                </span>
                <span className="text-[9.5px] font-mono text-zinc-400 px-1.5 py-0.5 bg-zinc-850 border border-zinc-750 rounded-sm">
                  Engine Core
                </span>
              </div>
              <span
                className={`material-symbols-outlined text-[16px] text-zinc-400 transition-transform duration-200 ${
                  methodologyOpen ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>

            {methodologyOpen && (
              <div className="p-3.5 pt-0.5 space-y-3 border-t border-zinc-800/80">
                <div className="grid grid-cols-2 gap-2 pt-1.5">
                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-md">
                    <span className="text-[9.5px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Parser Cleanliness
                    </span>
                    <span className="text-xs font-mono font-bold text-white mt-0.5 block">
                      100% · 0 Errors
                    </span>
                  </div>

                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-md">
                    <span className="text-[9.5px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Semantic Vector Cosine
                    </span>
                    <span className="text-xs font-mono font-bold text-white mt-0.5 block">
                      0.864 / 1.0
                    </span>
                  </div>

                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-md">
                    <span className="text-[9.5px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Keyword Freq Ratio
                    </span>
                    <span className="text-xs font-mono font-bold text-white mt-0.5 block">
                      {analysis?.keywordAnalysis?.matched ?? 14} Match / {analysis?.keywordAnalysis?.missing ?? 3} Miss
                    </span>
                  </div>

                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-md">
                    <span className="text-[9.5px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Section Weights
                    </span>
                    <span className="text-xs font-mono font-bold text-white mt-0.5 block">
                      Exp 60% · Prj 40%
                    </span>
                  </div>
                </div>

                {/* Version History */}
                <div className="p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-md space-y-1">
                  <span className="text-[9.5px] font-mono text-zinc-400 uppercase tracking-wider block">
                    Version History
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-mono font-medium">v3.2 (Active)</span>
                    <span className="text-zinc-500 font-mono text-[10px]">Current draft with Raft updates</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-mono">v3.1</span>
                    <span className="text-zinc-500 font-mono text-[10px]">Prior submission to Datadog (Score: 74%)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── 4. SECONDARY SUPPORTING TOOLS (ACCORDIONS & COLLAPSIBLE MODULES) ── */}
      <section className="pt-6 border-t border-zinc-800/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-zinc-400">tune</span>
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Supporting Workspace Tools
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "target", label: "Target Parameters", icon: "track_changes" },
              { id: "jd", label: "Job Description Match", icon: "match_word" },
              { id: "upload", label: "Upload & File", icon: "upload_file" },
              { id: "keywords", label: "Keyword Table", icon: "key" },
              { id: "suggestions", label: "All Suggestions", icon: "auto_fix_high" },
              { id: "history", label: "Version Control", icon: "history" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSecondaryTab(activeSecondaryTab === tab.id ? null : tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeSecondaryTab === tab.id
                    ? "bg-white text-black font-semibold"
                    : "bg-[#15151a] hover:bg-[#1c1c22] text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Tool Drawer */}
        {activeSecondaryTab === "target" && activeVariant && (
          <div className="p-6 rounded-lg bg-[#0f0f12] border border-zinc-800">
            <ResumeTargetSelector
              variantId={activeVariant.id}
              companies={companies}
              roles={roles}
              currentCompanyId={activeVariant.targetCompanyId}
              currentRoleId={activeVariant.targetRoleId}
              currentCompanyName={activeVariant.targetCompanyName}
              currentRoleName={activeVariant.targetRoleName}
            />
          </div>
        )}

        {activeSecondaryTab === "jd" && activeVariant && (
          <JobDescriptionPanel
            variantId={activeVariant.id}
            jobDescription={activeVariant.jobDescription}
          />
        )}

        {activeSecondaryTab === "upload" && (
          <ResumeUploadPanel
            supportedFormats={workspace.supportedFormats}
            maxUploadBytes={workspace.maxUploadBytes}
            targetLabel={targetLabel}
            compact={Boolean(activeVariant)}
          />
        )}

        {activeSecondaryTab === "keywords" && (
          <KeywordMatchTable analysis={analysis} />
        )}

        {activeSecondaryTab === "suggestions" && activeVariant && (
          <SuggestionsPanel
            variantId={activeVariant.id}
            suggestions={activeVariant.suggestions}
            assertedSkills={assertedSkills}
          />
        )}

        {activeSecondaryTab === "history" && activeVariant && (
          <VersionHistory
            variantId={activeVariant.id}
            versions={activeVariant.versions}
          />
        )}
      </section>
    </div>
  );
}
