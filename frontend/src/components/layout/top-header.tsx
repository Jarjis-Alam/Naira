import Link from "next/link";
import type { Session } from "next-auth";

interface TopHeaderProps {
  session: Session | null;
}

export function TopHeader({ session }: TopHeaderProps) {
  const userName = session?.user?.name || "Student";
  const userEmail = session?.user?.email || "";
  const initial = (userName.charAt(0) || "U").toUpperCase();

  return (
    <header className="sticky top-0 z-30 h-16 bg-void-black/85 backdrop-blur-xl border-b border-outline-variant flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* System Context / Breadcrumb */}
      <div className="flex-1 max-w-md md:max-w-lg mr-4 hidden sm:block">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
          <span className="text-zinc-200 font-medium">NAIRA OS</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400 truncate">Placement Intelligence System</span>
        </div>
      </div>

      {/* Right Controls & Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Notifications Icon Button */}
        <Link
          href="/dashboard"
          title="Notifications"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-surface-container-low border border-outline-variant/60 flex items-center justify-center text-text-muted hover:text-white hover:border-zinc-700 transition-colors relative"
        >
          <span className="material-symbols-outlined text-[18px]">
            notifications
          </span>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white ring-2 ring-black" />
        </Link>

        {/* Roadmap / Calendar Icon Button */}
        <Link
          href="/roadmap"
          title="Roadmap Schedule"
          className="hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-surface-container-low border border-outline-variant/60 items-center justify-center text-text-muted hover:text-white hover:border-zinc-700 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">
            calendar_today
          </span>
        </Link>

        {/* Profile Control */}
        <Link
          href="/profile"
          className="flex items-center gap-2 pl-1 sm:pl-1.5 py-1 pr-2.5 sm:pr-3 rounded-md bg-surface-container-low border border-outline-variant/60 hover:border-zinc-700 transition-colors group cursor-pointer"
        >
          <div className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-heading text-[12px] font-bold transition-transform">
            {initial}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-[12px] font-medium text-white leading-tight truncate max-w-[120px]">
              {userName}
            </span>
            <span className="text-[10px] font-mono text-text-muted leading-tight truncate max-w-[120px]">
              {userEmail || "CST • Naira"}
            </span>
          </div>
          <span className="material-symbols-outlined text-text-muted text-[15px] ml-0.5 group-hover:text-white transition-colors">
            expand_more
          </span>
        </Link>
      </div>
    </header>
  );
}
