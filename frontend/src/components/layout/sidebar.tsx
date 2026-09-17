"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { NexoraLogo } from "@/components/ui/nexora-logo";
import { useState } from "react";

interface SidebarProps {
  baselineTestId?: string | null;
  isAdmin?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export function Sidebar({ baselineTestId, isAdmin: initialIsAdmin }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin =
    initialIsAdmin ??
    (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin ??
    false;

  const assessmentHref = baselineTestId ? `/tests/${baselineTestId}` : "/assessment";

  const coreNavItems: NavItem[] = [
    { label: "Dashboard",         href: "/dashboard",    icon: "space_dashboard" },
    { label: "Target Strategy",   href: "/target",       icon: "track_changes" },
    { label: "Resume",            href: "/resume",       icon: "description" },
    { label: "Applications",      href: "/applications", icon: "work_outline" },
    { label: "Outcomes",          href: "/outcomes",     icon: "insights" },
    { label: "Simulations",       href: "/simulation",   icon: "terminal" },
    { label: "Interview Coach",   href: "/interview",    icon: "record_voice_over" },
  ];

  const prepNavItems: NavItem[] = [
    { label: "Study Planner",     href: "/planner",      icon: "event_note" },
    { label: "Assessment",        href: assessmentHref,  icon: "assignment" },
    { label: "Tests & Practice",  href: "/tests",        icon: "quiz" },
    { label: "Roadmap",           href: "/roadmap",      icon: "alt_route" },
    { label: "Analytics",         href: "/analytics",    icon: "monitoring" },
  ];

  const identityNavItems: NavItem[] = [
    { label: "Profile",           href: "/profile",      icon: "person_outline" },
  ];

  const adminNavItems: NavItem[] = [
    { label: "Question Bank",     href: "/admin/questions",    icon: "inventory_2" },
    { label: "Tests",             href: "/admin/tests",        icon: "quiz" },
    { label: "Test Builder",      href: "/admin/tests/new",    icon: "build" },
    { label: "Analytics",         href: "/admin/analytics",    icon: "insights" },
    { label: "Companies",         href: "/admin/companies",    icon: "domain" },
    { label: "Roles",             href: "/admin/roles",        icon: "badge" },
  ];

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
    <div className={`${showDivider ? "pt-4 border-t border-outline-variant/60" : ""}`}>
      {/* Group label */}
      <div className="px-3 mb-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted font-medium">
          {title}
        </span>
      </div>
      <nav className="flex flex-col gap-0.5" role="navigation" aria-label={title}>
        {items.map((item) => {
          const active = isActive(item);

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
                  ? "bg-white/15 text-white border border-white/30 shadow-sm"
                  : "border border-transparent hover:bg-white/5 hover:border-white/10 text-text-secondary hover:text-white"
                }
              `}
            >
              {/* Icon */}
              <span
                className={`
                  material-symbols-outlined text-[17px] shrink-0 transition-colors
                  ${active
                    ? "text-white"
                    : "text-text-muted group-hover:text-white"
                  }
                `}
              >
                {item.icon}
              </span>

              {/* Label */}
              <span
                className={`flex-1 truncate transition-colors ${
                  active
                    ? "text-white font-semibold"
                    : "text-text-secondary group-hover:text-white"
                }`}
              >
                {item.label}
              </span>

              {/* Active dot */}
              {active && (
                <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 shadow-sm" />
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
        <NexoraLogo size="sm" className="group-hover:border-white transition-colors" />
        <div>
          <div className="font-heading font-semibold text-[15px] text-white leading-none tracking-tight">
            Naira
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted mt-0.5">
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
      <div className="mt-3 pt-3 border-t border-outline-variant/60 space-y-2">
        {/* User Profile Card */}
        {session?.user && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-surface-container border border-outline-variant/60">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center font-mono text-[11px] font-semibold text-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-white truncate leading-tight">
                {session.user.name || session.user.email}
              </p>
              <p className="text-[10px] font-mono text-text-muted truncate">
                {session.user.email}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1 rounded-md text-text-muted hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[15px]">logout</span>
            </button>
          </div>
        )}

        {/* UI 2.0 Motivation Card (Monochrome) */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-surface-container-high via-surface-container to-surface-container-low border border-outline-variant/80 mb-3 shadow-md">
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] font-mono text-white uppercase tracking-widest font-semibold">Momentum</span>
            </div>
            <p className="text-[11px] text-zinc-300 font-medium leading-tight">
              Discipline today.<br/>Placement tomorrow.
            </p>
          </div>
          {/* Decorative orbs */}
          <div className="absolute -right-3 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-lg pointer-events-none" />
          <div className="absolute right-1 bottom-1 w-12 h-12 rounded-full border border-white/10 bg-gradient-to-tr from-white/10 to-transparent" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-void-black border-b border-outline-variant backdrop-blur-sm">
        <Link href="/dashboard" className="flex items-center gap-2">
          <NexoraLogo size={24} />
          <span className="font-heading font-semibold text-[14px] text-white">Naira</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-text-muted hover:text-white transition-colors cursor-pointer"
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
        className="hidden md:flex flex-col fixed left-0 top-0 h-screen z-30 bg-void-black border-r border-outline-variant w-60"
        aria-label="Main navigation"
      >
        {navContent}
      </aside>

    </>
  );
}
