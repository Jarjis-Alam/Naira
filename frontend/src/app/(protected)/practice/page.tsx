import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  selectPersonalizedQuestions,
  type PracticeObjective,
} from "@/server/practice-question-intelligence";
import { PracticeLauncherView } from "@/components/practice/practice-launcher-view";

export default async function PracticeLauncherPage({
  searchParams,
}: {
  searchParams: Promise<{
    topicId?: string;
    subjectCode?: string;
    testId?: string;
    objective?: string;
    planItemId?: string;
    direct?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/practice");
  }

  const { topicId, subjectCode, testId, objective, planItemId, direct } =
    await searchParams;

  if (testId) {
    redirect(`/tests/${testId}`);
  }

  const selection = await selectPersonalizedQuestions({
    userId: session.user.id,
    topicId,
    subjectCode,
    objective: (objective as PracticeObjective) || undefined,
    planItemId,
  });

  return (
    <PracticeLauncherView
      initialSelection={selection}
      topicId={topicId}
      subjectCode={subjectCode}
      planItemId={planItemId}
    />
  );
}
