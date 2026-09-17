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

  const coreNavItems = [
    { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
    { label: "Target Strategy", href: "/target", icon: "track_changes" },
    { label: "Resume Intelligence", href: "/resume", icon: "description" },
    { label: "Applications", href: "/applications", icon: "work" },
    { label: "Outcomes", href: "/outcomes", icon: "insights" },
    { label: "Simulations", href: "/simulation", icon: "terminal" },
  ];

  const prepNavItems = [
    { label: "Assessment", href: assessmentHref, icon: "assignment" },
    { label: "Tests & Practice", href: "/tests", icon: "quiz" },
    { label: "Roadmap", href: "/roadmap", icon: "alt_route" },
    { label: "Analytics", href: "/analytics", icon: "monitoring" },
  ];

  const identityNavItems = [
    { label: "Profile & Identity", href: "/profile", icon: "person" },
  ];

  const adminNavItems = [
    { label: "Question Bank", href: "/admin/questions", icon: "inventory_2" },
    { label: "Tests", href: "/admin/tests", icon: "quiz" },
    { label: "Test Builder", href: "/admin/tests/new", icon: "build" },
    { label: "Analytics", href: "/admin/analytics", icon: "insights" },
    { label: "Companies", href: "/admin/companies", icon: "domain" },
    { label: "Roles", href: "/admin/roles", icon: "badge" },
  ];

  const handleStartAssessment = () => {
    if (baselineTestId) {
      router.push(`/tests/${baselineTestId}`);
    } else {
      router.push("/assessment");
    }
  };

  const renderNavGroup = (
    title: string,
    items: { label: string; href: string; icon: string }[]
  ) => (
    <div className="space-y-1">
      <div className="px-3 py-1 text-[10px] font-mono tracking-widest uppercase text-deep-fern flex items-center gap-1.5">
        <span>{title}</span>
      </div>
      <nav className="flex flex-col space-y-0.5">
        {items.map((item) => {
          const isBaselineRoute = baselineTestId
            ? pathname.startsWith(`/tests/${baselineTestId}`)
            : false;
          const isActive =
            pathname === item.href ||
            (item.label === "Tests & Practice"
              ? pathname === "/tests" ||
                (pathname.startsWith("/tests/") && !isBaselineRoute)
              : item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center px-3 py-2 rounded-cards text-body-sm transition-all duration-200 group ${
                isActive
                  ? "text-phosphor-white font-medium bg-carbon-veil border-l-2 border-lime-pulse pl-2.5 shadow-none"
                  : "text-sage-60 hover:text-phosphor-white hover:bg-ground-iron border-l-2 border-transparent pl-2.5"
              }`}
            >
              <span
                className={`material-symbols-outlined mr-3 text-[17px] transition-colors ${
                  isActive ? "text-lime-pulse" : "text-sage-40 group-hover:text-sage-60"
                }`}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1 h-1 rounded-full bg-lime-pulse shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  const navContent = (
    <div className="flex flex-col h-full py-4 px-3 justify-between">
      <div className="space-y-6">
        {/* Brand / Logo */}
        <Link href="/dashboard" className="px-3 py-2 flex items-center space-x-3 group">
          <div className="w-8 h-8 rounded-lg bg-ground-iron flex items-center justify-center border border-circuit-border group-hover:border-lime-pulse transition-colors">
            <span className="material-symbols-outlined text-lime-pulse text-[18px]">
              terminal
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-title-md font-semibold text-phosphor-white leading-none">
                Nexora
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse" />
            </div>
            <span className="text-[10px] text-moss-70 font-mono tracking-wider block mt-0.5">
              PLACEMENT OS
            </span>
          </div>
        </Link>

        {/* Navigation Sections */}
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
          {renderNavGroup("Core OS", coreNavItems)}
          {renderNavGroup("Preparation", prepNavItems)}
          {renderNavGroup("Identity", identityNavItems)}

          {isAdmin && renderNavGroup("Administration", adminNavItems)}
        </div>
      </div>

      {/* Bottom Profile & Actions */}
      <div className="pt-3 border-t border-phosphor-blue-black space-y-2.5">
        {session?.user && (
          <div className="flex items-center justify-between p-2 rounded-cards bg-carbon-veil/70 border border-circuit-border/60">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-md bg-ground-iron border border-circuit-border flex items-center justify-center text-lime-pulse font-mono text-[11px] font-semibold shrink-0">
                {(session.user.name || session.user.email || "U").slice(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-caption font-medium text-phosphor-white truncate">
                  {session.user.name || session.user.email}
                </p>
                <p className="text-[10px] text-sage-40 font-mono truncate">
                  {session.user.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1 rounded-md text-sage-40 hover:text-error hover:bg-ground-iron transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
            </button>
          </div>
        )}

        <button
          onClick={handleStartAssessment}
          className="w-full bg-ground-iron text-phosphor-white font-medium text-body-sm py-2 px-3 rounded-buttons border border-circuit-border hover:border-lime-pulse transition-all flex justify-center items-center gap-2 cursor-pointer shadow-none focus-visible:ring-1 focus-visible:ring-lime-pulse"
        >
          <span className="material-symbols-outlined text-[16px] text-lime-pulse">play_arrow</span>
          <span>Calibrate Readiness</span>
        </button>

        {/* Developer Info affordance */}
        <div className="pt-1.5 flex items-center justify-between text-caption font-mono text-sage-40">
          <button
            onClick={() => setDevModalOpen(true)}
            className="text-[11px] text-moss-70 hover:text-phosphor-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-lime-pulse" />
            <span>DEV Card</span>
          </button>
          <div className="flex items-center gap-1">
            <a
              href="https://github.com/Jarjis-Alam"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:text-phosphor-white transition-colors"
              title="GitHub"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/jarjisalam/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:text-phosphor-white transition-colors"
              title="LinkedIn"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
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
      {/* Mobile Top Navigation */}
      <div className="md:hidden flex items-center justify-between p-3.5 bg-ground-iron/95 border-b border-circuit-border sticky top-0 z-40 backdrop-blur-md">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-md bg-carbon-veil flex items-center justify-center border border-circuit-border">
            <span className="material-symbols-outlined text-lime-pulse text-[16px]">terminal</span>
          </div>
          <span className="font-heading font-semibold text-phosphor-white text-title-md">Nexora</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-sage-60 hover:text-phosphor-white cursor-pointer"
          aria-label="Toggle Navigation Menu"
        >
          <span className="material-symbols-outlined">{mobileMenuOpen ? "close" : "menu"}</span>
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[57px] z-50 bg-void-black/95 backdrop-blur-md p-4 overflow-y-auto">
          {navContent}
        </div>
      )}

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen z-30 bg-ground-iron border-r border-phosphor-blue-black w-64 shadow-none">
        {navContent}
      </aside>

      {/* 3D Developer Profile Modal */}
      <DevModal isOpen={devModalOpen} onClose={() => setDevModalOpen(false)} />
    </>
  );
}
