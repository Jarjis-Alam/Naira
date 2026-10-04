import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getResumeVariant,
  getResumeWorkspace,
  type ResumeVariantDetail,
  type ResumeWorkspace,
} from "@/server/resume-intelligence";
import { searchCompanies, searchRoles } from "@/server/company-role-intelligence";
import { ResumeDossierView } from "@/components/resume/resume-dossier-view";

export default async function ResumeIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ variantId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/resume");

  const userId = session.user.id;
  const { variantId } = await searchParams;

  const workspace: ResumeWorkspace = await getResumeWorkspace(userId);

  let activeVariant: ResumeVariantDetail | null = workspace.primaryVariant;
  if (variantId) {
    try {
      activeVariant = await getResumeVariant(variantId, userId);
    } catch {
      activeVariant = workspace.primaryVariant;
    }
  }

  const [companies, roles] = await Promise.all([
    searchCompanies({ limit: 60 }).catch(() => []),
    searchRoles({ limit: 60 }).catch(() => []),
  ]);

  return (
    <ResumeDossierView
      workspace={workspace}
      activeVariant={activeVariant}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      roles={roles.map((r) => ({ id: r.id, name: r.name }))}
    />
  );
}
