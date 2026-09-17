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
    <header className="sticky top-0 z-30 h-16 bg-[#111413]/85 backdrop-blur-xl border-b border-[#3f4a38]/30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Search Input Bar */}
      <div className="flex-1 max-w-md md:max-w-lg mr-4">
        <div className="h-10 w-full rounded-full bg-[#191c1b] border border-[#3f4a38]/40 px-3.5 flex items-center justify-between shadow-inner focus-within:border-lime-pulse/50 transition-colors">
          <div className="flex items-center gap-2 text-sage-40 flex-1 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-deep-fern flex-shrink-0">
              search
            </span>
            <input
              type="text"
              placeholder="Search anything... (companies, skills, tests, etc.)"
              className="bg-transparent border-none outline-none text-[13px] text-phosphor-white placeholder:text-sage-40/60 w-full"
              readOnly
            />
          </div>
          <div className="hidden sm:flex items-center px-2 py-0.5 rounded-full bg-[#282b29] border border-[#3f4a38]/40 text-sage-40 text-[11px] font-mono select-none">
            ⌘ K
          </div>
        </div>
      </div>

      {/* Right Controls & Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
        {/* Notifications Icon Button */}
        <Link
          href="/dashboard"
          title="Notifications"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#191c1b] border border-[#3f4a38]/40 flex items-center justify-center text-sage-40 hover:text-phosphor-white hover:border-lime-pulse/40 transition-colors relative"
        >
          <span className="material-symbols-outlined text-[18px] sm:text-[20px]">
            notifications
          </span>
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ffb4ab] ring-2 ring-[#111413]" />
        </Link>

        {/* Roadmap / Calendar Icon Button */}
        <Link
          href="/roadmap"
          title="Roadmap Schedule"
          className="hidden sm:flex w-10 h-10 rounded-full bg-[#191c1b] border border-[#3f4a38]/40 items-center justify-center text-sage-40 hover:text-phosphor-white hover:border-lime-pulse/40 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">
            calendar_today
          </span>
        </Link>

        {/* Profile Pill */}
        <Link
          href="/profile"
          className="flex items-center gap-2 pl-1 sm:pl-1.5 py-1 pr-3 sm:pr-3.5 rounded-full bg-[#191c1b] border border-[#3f4a38]/40 hover:border-[#88957f]/70 transition-colors group cursor-pointer"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-lime-pulse/20 border border-lime-pulse/40 flex items-center justify-center text-lime-pulse font-heading text-[13px] font-bold group-hover:scale-105 transition-transform">
            {initial}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-[12px] font-semibold text-phosphor-white leading-tight truncate max-w-[120px]">
              {userName}
            </span>
            <span className="text-[10px] font-mono text-deep-fern leading-tight truncate max-w-[120px]">
              {userEmail || "CST • Nexora"}
            </span>
          </div>
          <span className="material-symbols-outlined text-sage-40 text-[16px] ml-0.5 group-hover:text-phosphor-white transition-colors">
            expand_more
          </span>
        </Link>
      </div>
    </header>
  );
}
