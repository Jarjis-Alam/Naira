import Link from "next/link";
import { auth } from "@/lib/auth";
import { DeveloperFooter } from "@/components/layout/developer-footer";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CinematicHero } from "@/components/landing/cinematic-hero";

export default async function LandingPage() {
  const session = await auth();

  const navItems = [
    { label: "Preparation Loop", href: "#loop" },
    { label: "Readiness Model", href: "#readiness" },
    { label: "Curriculum", href: "#curriculum" },
  ];

  return (
    <div className="min-h-screen bg-void-black text-sage-60 selection:bg-white/20 selection:text-white flex flex-col justify-between">
      {/* Cinematic Full-Screen Video Hero with Minimal Layered Navigation and NAIRA Wordmark */}
      <CinematicHero isAuthenticated={Boolean(session)} navItems={navItems} />

      {/* Code Window / Live Terminal Preview Section */}
      <section id="readiness" className="container-fluid pt-16 pb-20 scroll-mt-20">
        <div className="rounded-xl bg-ground-iron border border-circuit-border overflow-hidden shadow-none">
          {/* Traffic-light terminal window top bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-circuit-border/60 bg-carbon-veil/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
              <span className="text-caption text-moss-70 ml-3 font-mono">nexora-intelligence-terminal</span>
            </div>
            <div className="text-caption text-lime-pulse font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse animate-pulse" />
              <span>DIAGNOSTIC ENGINE: OPTIMAL</span>
            </div>
          </div>

          {/* Terminal Content Grid */}
          <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-carbon-veil/60 border border-circuit-border/60 p-5 rounded-md">
              <div className="text-caption text-sage-40 uppercase font-mono mb-1">Placement Readiness</div>
              <div className="text-4xl font-bold font-mono text-phosphor-white mb-2">73%</div>
              <div className="text-caption text-lime-pulse font-mono font-semibold">CALIBRATED • COMPETITIVE</div>
              <div className="w-full bg-ground-iron h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-lime-pulse h-full w-[73%]" />
              </div>
            </div>

            <div className="bg-carbon-veil/60 border border-circuit-border/60 p-5 rounded-md">
              <div className="text-caption text-sage-40 uppercase font-mono mb-1">Benchmark Breakdown</div>
              <div className="space-y-2 mt-2">
                <div className="flex justify-between text-caption font-mono">
                  <span className="text-sage-60">DSA & Algo</span>
                  <span className="text-phosphor-white font-semibold">85%</span>
                </div>
                <div className="flex justify-between text-caption font-mono">
                  <span className="text-sage-60">OS & Concurrency</span>
                  <span className="text-phosphor-white font-semibold">51%</span>
                </div>
                <div className="flex justify-between text-caption font-mono">
                  <span className="text-sage-60">DBMS & SQL</span>
                  <span className="text-phosphor-white font-semibold">77%</span>
                </div>
              </div>
            </div>

            <div className="bg-carbon-veil/60 border border-circuit-border/60 p-5 rounded-md">
              <div className="text-caption text-sage-40 uppercase font-mono mb-1">Empirical Focus Candidates</div>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff7b72]" />
                  <span className="text-body-sm text-phosphor-white font-mono text-[13px]">Process Sync (OS) — 0% acc</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ffd37a]" />
                  <span className="text-body-sm text-phosphor-white font-mono text-[13px]">Graph Traversal (DSA) — 45%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6-Step Placement Preparation Loop */}
      <section id="loop" className="container-fluid py-20 scroll-mt-20 border-t border-phosphor-blue-black">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Eyebrow system="NEXORA" category="EXECUTION ARCHITECTURE" className="justify-center">
            CLOSED-LOOP PREPARATION
          </Eyebrow>
          <h2 className="font-heading text-headline-lg font-semibold text-phosphor-white">
            How Nexora Operates
          </h2>
          <p className="text-body-sm text-sage-60 mt-2 max-w-xl mx-auto leading-relaxed">
            A deterministic engineering feedback loop designed to move students from uncalibrated to placement-ready.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {[
            { step: "01", name: "Assess", detail: "Standardized diagnostic assessment covering core CS, DSA, and aptitude.", icon: "assignment" },
            { step: "02", name: "Analyze", detail: "Measure accuracy, timing, unanswered rates, and negative marking discipline.", icon: "insights" },
            { step: "03", name: "Identify Weaknesses", detail: "Isolate sub-topics and conceptual deficits holding back your score.", icon: "track_changes" },
            { step: "04", name: "Set Targets", detail: "Configure target roles and priority companies to contextualize benchmarks.", icon: "domain" },
            { step: "05", name: "Generate Roadmap", detail: "Receive a prioritized, sequenced daily action plan (FIX / REINFORCE / REVIEW).", icon: "alt_route" },
            { step: "06", name: "Simulate Rounds", detail: "Execute 5-round realistic placement simulations against company criteria.", icon: "terminal" },
          ].map((item) => (
            <div key={item.step} className="p-6 rounded-cards bg-ground-iron border border-circuit-border hover:border-lime-pulse/50 transition-all space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-caption text-lime-pulse font-bold">
                  STEP {item.step}
                </span>
                <span className="material-symbols-outlined text-moss-70 text-[20px]">
                  {item.icon}
                </span>
              </div>
              <h3 className="font-heading text-title-md font-semibold text-phosphor-white">
                {item.name}
              </h3>
              <p className="text-body-sm text-sage-60 leading-relaxed">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Curriculum & Placement Tests Section */}
      <section id="curriculum" className="py-20 container-fluid border-t border-phosphor-blue-black scroll-mt-20">
        <div className="mb-12 text-center md:text-left">
          <Eyebrow system="NEXORA" category="CURRICULUM">
            STANDARDIZED SYLLABUS
          </Eyebrow>
          <h2 className="font-heading text-headline-lg font-semibold text-phosphor-white mb-2">
            Placement Curriculum & Mock Tests
          </h2>
          <p className="text-body text-sage-60 max-w-3xl">
            Engineered to cover the technical interview syllabus across 7 core subjects and high-fidelity placement simulations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-stretch">
          {/* Left: 7 Core Subjects Curriculum */}
          <div className="lg:col-span-1 bg-ground-iron border border-circuit-border rounded-cards p-6 flex flex-col justify-between shadow-none">
            <div>
              <div className="w-10 h-10 rounded-lg bg-carbon-veil border border-circuit-border flex items-center justify-center text-lime-pulse mb-4">
                <span className="material-symbols-outlined text-[20px]">menu_book</span>
              </div>
              <h3 className="font-heading text-title-md font-semibold text-phosphor-white mb-2">
                7 Core Subjects
              </h3>
              <p className="text-body-sm text-sage-60 mb-6 leading-relaxed">
                Topic coverage with 60 key competencies and 160 vetted questions.
              </p>

              <ul className="space-y-2.5">
                {[
                  "Data Structures & Algorithms",
                  "Operating Systems & Concurrency",
                  "Database Management & SQL",
                  "Computer Networks & Protocols",
                  "Object-Oriented Programming (OOP)",
                  "System Design Fundamentals",
                  "Aptitude & Quantitative Analysis",
                ].map((subject, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 text-body-sm text-phosphor-white font-mono text-[13px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse" />
                    <span>{subject}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-5 mt-6 border-t border-circuit-border/60 flex items-center justify-between text-caption font-mono text-sage-40">
              <span>60 TOPICS</span>
              <span>160 VETTED QUESTIONS</span>
            </div>
          </div>

          {/* Right: Placement Tests */}
          <div className="lg:col-span-2 bg-ground-iron border border-circuit-border rounded-cards p-6 flex flex-col justify-between shadow-none">
            <div>
              <div className="w-10 h-10 rounded-lg bg-carbon-veil border border-circuit-border flex items-center justify-center text-lime-pulse mb-4">
                <span className="material-symbols-outlined text-[20px]">quiz</span>
              </div>
              <h3 className="font-heading text-title-md font-semibold text-phosphor-white mb-2">
                Placement Tests
              </h3>
              <p className="text-body-sm text-sage-60 mb-6 max-w-2xl leading-relaxed">
                Curated mock tests covering Aptitude, CS Fundamentals, and Full-Stack Placement rounds designed to simulate exact exam environments with strict timing and verified grading.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {[
                  { name: "Comprehensive Placement Assessment", meta: "50 Questions • 60 Mins", tag: "BASELINE" },
                  { name: "Core CS Fundamentals Benchmark", meta: "40 Questions • 45 Mins", tag: "CS CORE" },
                  { name: "Advanced Data Structures & Algorithms", meta: "35 Questions • 45 Mins", tag: "DSA" },
                  { name: "Full-Stack Engineering Mock", meta: "35 Questions • 45 Mins", tag: "SYSTEMS" },
                ].map((test, i) => (
                  <div key={i} className="p-3.5 rounded-md bg-carbon-veil/70 border border-circuit-border/60 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-body-sm font-semibold text-phosphor-white truncate">{test.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-pills bg-ground-iron text-moss-80 border border-circuit-border shrink-0">
                        {test.tag}
                      </span>
                    </div>
                    <span className="text-caption font-mono text-sage-40">{test.meta}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-5 border-t border-circuit-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <span className="text-caption text-sage-40 font-mono tracking-wider">
                4 BENCHMARKS • 160 CURATED QUESTIONS
              </span>
              <Link
                href="/tests"
                className="text-fern-link hover:text-phosphor-white text-body-sm font-semibold flex items-center gap-1.5 transition-colors underline"
              >
                <span>Explore All Tests</span>
                <span className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Developer Details & Footer */}
      <DeveloperFooter />
    </div>
  );
}
