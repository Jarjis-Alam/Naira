import { Sidebar } from "@/components/layout/sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tests } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin ?? false;

  // Fetch baseline test ID if available
  const baseline = await db
    .select({ id: tests.id })
    .from(tests)
    .where(eq(tests.type, "baseline"))
    .limit(1);

  const baselineTestId = baseline[0]?.id || null;

  return (
    <div className="flex min-h-screen bg-void-black text-sage-60 tech-grid">
      <Sidebar baselineTestId={baselineTestId} isAdmin={isAdmin} />
      <div className="flex-1 md:ml-60 min-h-screen flex flex-col overflow-x-hidden">
        <TopHeader session={session} />
        <main
          className="flex-1 flex flex-col"
          id="main-content"
        >
          <div className="container-fluid py-6 md:py-8 flex-1">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
