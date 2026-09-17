"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { DevModal } from "@/components/layout/dev-modal";

interface SidebarProps {
  baselineTestId?: string | null;
  isAdmin?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  accentColor?: "green" | "blue" | "purple" | "amber" | "rose";
}

export function Sidebar({ baselineTestId, isAdmin: initialIsAdmin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [devModalOpen, setDevModalOpen] = useState(false);

  const isAdmin =
    initialIsAdmin ??
    (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin ??
    false;

  const assessmentHref = baselineTestId ? `/tests/${baselineTestId}` : "/assessment";

  const coreNavItems: NavItem[] = [
    { label: "Dashboard",         href: "/dashboard",    icon: "space_dashboard",  accentColor: "green" },
    { label: "Target Strategy",   href: "/target",       icon: "track_changes",    accentColor: "blue" },
    { label: "Resume",            href: "/resume",       icon: "description",      accentColor: "blue" },
    { label: "Applications",      href: "/applications", icon: "work_outline",     accentColor: "amber" },
    { label: "Outcomes",          href: "/outcomes",     icon: "insights",         accentColor: "rose" },
    { label: "Simulations",       href: "/simulation",   icon: "terminal",         accentColor: "purple" },
  ];

  const prepNavItems: NavItem[] = [
    { label: "Assessment",        href: assessmentHref,  icon: "assignment",       accentColor: "green" },
    { label: "Tests & Practice",  href: "/tests",        icon: "quiz",             accentColor: "green" },
    { label: "Roadmap",           href: "/roadmap",      icon: "alt_route",        accentColor: "blue" },
    { label: "Analytics",         href: "/analytics",    icon: "monitoring",       accentColor: "purple" },
  ];

  const identityNavItems: NavItem[] = [
    { label: "Profile",           href: "/profile",      icon: "person_outline",   accentColor: "neutral" as "green" },
  ];

  const adminNavItems: NavItem[] = [
    { label: "Question Bank",     href: "/admin/questions",    icon: "inventory_2" },
    { label: "Tests",             href: "/admin/tests",        icon: "quiz" },
    { label: "Test Builder",      href: "/admin/tests/new",    icon: "build" },
    { label: "Analytics",         href: "/admin/analytics",    icon: "insights" },
    { label: "Companies",         href: "/admin/companies",    icon: "domain" },
    { label: "Roles",             href: "/admin/roles",        icon: "badge" },
  ];

  const accentTextMap = {
    green:  "text-lime-pulse",
    blue:   "text-accent-blue",
    purple: "text-accent-purple",
    amber:  "text-accent-amber",
    rose:   "text-accent-rose",
  };
  const accentBgMap = {
    green:  "bg-[rgba(127,238,100,0.10)]",
    blue:   "bg-[rgba(96,165,250,0.10)]",
    purple: "bg-[rgba(167,139,250,0.10)]",
    amber:  "bg-[rgba(251,191,36,0.10)]",
    rose:   "bg-[rgba(251,113,133,0.10)]",
  };
  const accentDotMap = {
    green:  "bg-lime-pulse",
    blue:   "bg-accent-blue",
    purple: "bg-accent-purple",
    amber:  "bg-accent-amber",
    rose:   "bg-accent-rose",
  };

  function isActive(item: NavItem): boolean {
    const isBaselineRoute = baselineTestId
      ? pathname.startsWith(`/tests/${baselineTestId}`)
      : false;
    return (
      pathname === item.href ||
      (item.label === "Tests & Practice"
        ? pathname === "/tests" ||
          (pathname.startsWith("/tests/") && !isBaselineRoute)
        : item.href !== "/dashboard" && pathname.startsWith(item.href))
    );
  }

  const renderNavGroup = (
    title: string,
    items: NavItem[],
    showDivider = true
  ) => (
    <div className={`${showDivider ? "pt-4 border-t border-[#1a1f1a]" : ""}`}>
      {/* Group label */}
      <div className="px-3 mb-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-deep-fern font-medium">
          {title}
        </span>
      </div>
      <nav className="flex flex-col gap-0.5" role="navigation" aria-label={title}>
        {items.map((item) => {
          const active = isActive(item);
          const accent = item.accentColor && item.accentColor !== ("neutral" as string)
            ? item.accentColor
            : undefined;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`
                relative flex items-center gap-2.5 px-3 py-2 rounded-full
                text-[13px] font-medium transition-all duration-150 group
                ${active
                  ? `${accent ? accentBgMap[accent] : "bg-[rgba(127,238,100,0.1)]"} border ${accent ? "border-" + accent + "-500/20" : "border-lime-pulse/20"}`
                  : "border border-transparent hover:bg-[rgba(127,238,100,0.05)] hover:border-[rgba(127,238,100,0.12)]"
                }
              `}
            >
              {/* No left strip for rounded-full pills */}

              {/* Icon */}
              <span
                className={`
                  material-symbols-outlined text-[17px] flex-shrink-0 transition-colors
                  ${active
                    ? accent ? accentTextMap[accent] : "text-lime-pulse"
                    : "text-sage-40 group-hover:text-sage-60"
                  }
                `}
              >
                {item.icon}
              </span>

              {/* Label */}
              <span
                className={`flex-1 truncate transition-colors ${
                  active
                    ? "text-phosphor-white"
                    : "text-sage-60 group-hover:text-phosphor-white"
                }`}
              >
                {item.label}
              </span>

              {/* Active dot */}
              {active && (
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    accent ? accentDotMap[accent] : "bg-lime-pulse"
                  }`}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  // Avatar initials
  const initials = (session?.user?.name || session?.user?.email || "U")
    .slice(0, 2)
    .toUpperCase();

  const navContent = (
    <div className="flex flex-col h-full py-4 px-2.5">
      {/* ── Brand / Logo ── */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-2.5 py-2 mb-4 group"
      >
        {/* Emblem */}
        <div className="w-7 h-7 rounded-[6px] bg-ground-iron border border-circuit-border flex items-center justify-center group-hover:border-lime-pulse transition-colors flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L12.5 4.5V9.5L7 13L1.5 9.5V4.5L7 1Z" stroke="#7fee64" strokeWidth="1.2" fill="none"/>
            <path d="M7 4L10 5.75V9.25L7 11L4 9.25V5.75L7 4Z" fill="#7fee64" fillOpacity="0.25" stroke="#7fee64" strokeWidth="0.8"/>
          </svg>
        </div>
        <div>
          <div className="font-heading font-semibold text-[15px] text-phosphor-white leading-none tracking-tight">
            Nexora
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-deep-fern mt-0.5">
            Placement OS
          </div>
        </div>
      </Link>

      {/* ── Navigation ── */}
      <div className="flex-1 overflow-y-auto space-y-0 pr-0.5 -mr-0.5 min-h-0">
        {renderNavGroup("Core OS", coreNavItems, false)}

        {renderNavGroup("Preparation", prepNavItems)}
        {renderNavGroup("Identity", identityNavItems)}
        {isAdmin && renderNavGroup("Admin", adminNavItems)}
      </div>

      {/* ── Bottom: Profile + Actions ── */}
      <div className="mt-3 pt-3 border-t border-[#1a1f1a] space-y-2">
        {/* User Profile Card */}
        {session?.user && (
          <div className="flex items-center gap-2 p-2 rounded-[8px] bg-ground-iron border border-circuit-border/60">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-[6px] bg-carbon-veil border border-circuit-border flex items-center justify-center font-mono text-[11px] font-semibold text-lime-pulse flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-phosphor-white truncate leading-tight">
                {session.user.name || session.user.email}
              </p>
              <p className="text-[10px] font-mono text-deep-fern truncate">
                {session.user.email}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1 rounded-md text-sage-40 hover:text-accent-rose transition-colors cursor-pointer flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[15px]">logout</span>
            </button>
          </div>
        )}

        {/* UI 2.0 Motivation Card */}
        <div className="relative overflow-hidden rounded-[16px] p-4 bg-gradient-to-br from-[#101b14] via-[#0b1410] to-[#0a110f] border border-lime-pulse/20 mb-3">
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse animate-pulse" />
              <span className="text-[10px] font-mono text-lime-pulse uppercase tracking-widest font-semibold">Momentum</span>
            </div>
            <p className="text-[11px] text-phosphor-white font-medium leading-tight">
              Discipline today.<br/>Placement tomorrow.
            </p>
          </div>
          {/* Decorative orbs */}
          <div className="absolute -right-3 -bottom-4 w-20 h-20 bg-lime-pulse/10 rounded-full blur-lg pointer-events-none" />
          <div className="absolute right-1 bottom-1 w-12 h-12 rounded-full border border-lime-pulse/20 bg-gradient-to-tr from-lime-pulse/20 to-mint-frost/10" />
        </div>

        {/* Dev footer */}
        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => setDevModalOpen(true)}
            className="flex items-center gap-1 text-[10px] font-mono text-deep-fern hover:text-sage-60 transition-colors cursor-pointer"
          >
            <span className="w-1 h-1 rounded-full bg-lime-pulse" />
            DEV
          </button>
          <div className="flex items-center gap-1">
            <a
              href="https://github.com/Jarjis-Alam"
              target="_blank"
              rel="noopener noreferrer"
              className="p-0.5 rounded text-deep-fern hover:text-sage-60 transition-colors"
              title="GitHub"
            >
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/jarjisalam/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-0.5 rounded text-deep-fern hover:text-sage-60 transition-colors"
              title="LinkedIn"
            >
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c.97 0 1.75-.79 1.75-1.76s-.78-1.75-1.75-1.75a1.75 1.75 0 0 0-1.75 1.75c0 .97.78 1.76 1.75 1.76m1.4 9.74v-8.37H5.06v8.37h2.8z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-void-black border-b border-circuit-border/50 backdrop-blur-sm">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[5px] bg-ground-iron border border-circuit-border flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L12.5 4.5V9.5L7 13L1.5 9.5V4.5L7 1Z" stroke="#7fee64" strokeWidth="1.2" fill="none"/>
              <path d="M7 4L10 5.75V9.25L7 11L4 9.25V5.75L7 4Z" fill="#7fee64" fillOpacity="0.25" stroke="#7fee64" strokeWidth="0.8"/>
            </svg>
          </div>
          <span className="font-heading font-semibold text-[14px] text-phosphor-white">Nexora</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-sage-60 hover:text-phosphor-white transition-colors cursor-pointer"
          aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileMenuOpen}
        >
          <span className="material-symbols-outlined text-[22px]">
            {mobileMenuOpen ? "close" : "menu"}
          </span>
        </button>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 top-[49px] z-50 bg-void-black/98 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {navContent}
        </div>
      )}

      {/* ── Desktop fixed sidebar ── */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 h-screen z-30 bg-void-black border-r border-[#1a1f1a] w-60"
        aria-label="Main navigation"
      >
        {navContent}
      </aside>

      {/* Dev Modal */}
      <DevModal isOpen={devModalOpen} onClose={() => setDevModalOpen(false)} />
    </>
  );
}
